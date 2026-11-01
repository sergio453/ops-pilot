import { EventEmitter } from "node:events";
import { HumanMessage } from "@langchain/core/messages";

import { createModel } from "../agents/model.js";
import type { ConversationMessageWithId, ConversationStore } from "../store/sqlite-conversation-store.js";

export const SUMMARIZER_PROMPT =
  "Comprima o trecho de conversa a seguir em no máximo 150 tokens, preservando obrigatoriamente: decisões tomadas, fatos estabelecidos (nomes, datas, prazos, preferências), incidentes abertos/resolvidos e pendências abertas. Descarte cumprimentos e conversa social. Se houver um resumo anterior incorpore-o. Responda só o resumo, em tópicos telegráficos.";

export const PRUNE_BATCH_SIZE = 8;
export const RECENT_WINDOW_SIZE = 8;

export interface SummarizerInput {
  previousSummary?: string;
  messagesToSummarize: Array<{ role: string; content: string }>;
}

export interface ConversationSummarizer {
  summarize(input: SummarizerInput): Promise<string>;
}

export interface SummarizeEventPayload {
  conversationId: string;
  previousSummary?: string;
  messagesSummarized: ConversationMessageWithId[];
  newSummary: string;
}

export class FakeConversationSummarizer implements ConversationSummarizer {
  public callCount = 0;
  public lastInput?: SummarizerInput;

  async summarize(input: SummarizerInput): Promise<string> {
    this.callCount += 1;
    this.lastInput = input;
    const prev = input.previousSummary ? `[Anterior: ${input.previousSummary}] ` : "";
    const facts = input.messagesToSummarize
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join("; ");
    return `${prev}- Resumo (${input.messagesToSummarize.length} msgs): ${facts}`.slice(0, 300);
  }
}

export class LlmConversationSummarizer implements ConversationSummarizer {
  async summarize(input: SummarizerInput): Promise<string> {
    const model = createModel();

    let contentToSummarize = "";
    if (input.previousSummary) {
      contentToSummarize += `RESUMO ANTERIOR:\n${input.previousSummary}\n\n`;
    }

    contentToSummarize += "NOVAS MENSAGENS A SUMARIZAR:\n";
    for (const msg of input.messagesToSummarize) {
      contentToSummarize += `${msg.role.toUpperCase()}: ${msg.content}\n`;
    }

    const fullPrompt = `${SUMMARIZER_PROMPT}\n\n${contentToSummarize}`;
    const response = await model.invoke([new HumanMessage(fullPrompt)]);

    if (typeof response.content === "string") {
      return response.content.trim();
    }
    return JSON.stringify(response.content).trim();
  }
}

export interface MaybeSummarizeOptions {
  conversationStore: ConversationStore;
  summarizer: ConversationSummarizer;
  eventEmitter?: EventEmitter;
  recentLimit?: number;
  batchSize?: number;
}

/**
 * Avalia se há mensagens podadas suficientes para disparar a sumarização em lote.
 * Dispara SOMENTE quando o número de mensagens não-sumarizadas fora da janela recente
 * atinge ou supera batchSize (padrão 8). Nunca dispara a cada request.
 */
export async function maybeSummarizeConversation(
  conversationId: string,
  options: MaybeSummarizeOptions,
): Promise<{ summarized: boolean; summary?: string }> {
  const recentLimit = options.recentLimit ?? RECENT_WINDOW_SIZE;
  const batchSize = options.batchSize ?? PRUNE_BATCH_SIZE;

  const unsummarized = options.conversationStore.getUnsummarizedPrunedMessages(
    conversationId,
    recentLimit,
  );

  // Gatilho estrito: só roda quando atingir um lote completo de mensagens podadas
  if (unsummarized.length < batchSize) {
    return { summarized: false };
  }

  // Pega exatamente o lote mais antigo de batchSize
  const messagesToProcess = unsummarized.slice(0, batchSize);
  const lastMessage = messagesToProcess[messagesToProcess.length - 1];
  if (!lastMessage) {
    return { summarized: false };
  }

  const existingRecord = options.conversationStore.getSummary(conversationId);
  const previousSummary = existingRecord ? existingRecord.summary : undefined;

  const newSummary = await options.summarizer.summarize({
    previousSummary,
    messagesToSummarize: messagesToProcess.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  });

  options.conversationStore.saveSummary({
    conversationId,
    summary: newSummary,
    lastSummarizedMessageId: lastMessage.id,
  });

  const payload: SummarizeEventPayload = {
    conversationId,
    previousSummary,
    messagesSummarized: messagesToProcess,
    newSummary,
  };

  if (options.eventEmitter) {
    options.eventEmitter.emit("summarize", payload);
  }

  return { summarized: true, summary: newSummary };
}

