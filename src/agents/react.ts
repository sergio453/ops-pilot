import { HumanMessage, isAIMessage, isToolMessage } from "@langchain/core/messages";
import { createReactAgent } from "@langchain/langgraph/prebuilt";

import { createModel } from "./model.js";
import { createAgentTools } from "./tools.js";
import type { ReasoningInput, ReasoningResult, ReasoningStrategy, TraceEvent } from "./types.js";
import type { OpsStore } from "./tools.js";
import { SqliteOpsStore } from "../store/sqlite-ops-store.js";
import { extractPromptTokens } from "../context/tokens.js";
import { createTraceEmitter } from "./trace.js";

function contentToString(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
  return JSON.stringify(content);
}

export class ReactReasoningStrategy implements ReasoningStrategy {
  public readonly name = "react";
  private readonly store: OpsStore;

  constructor(store?: OpsStore, private readonly options?: {
    createModel?: typeof createModel;
    createAgent?: typeof createReactAgent;
  }) {
    this.store = store ?? new SqliteOpsStore();
  }

  async run(input: ReasoningInput): Promise<ReasoningResult> {
    if (input.maxIterations <= 0) {
      throw new Error("maxIterations must be greater than zero");
    }

    const startedAt = Date.now();
    const llm = (this.options?.createModel ?? createModel)();
    const tools = createAgentTools(this.store);
    const agent = (this.options?.createAgent ?? createReactAgent)({
      llm,
      tools,
      prompt:
        "Você é um plantonista de incidentes. Use ferramentas quando necessário e finalize com uma recomendação objetiva.",
    });

    const stream = await agent.stream(
      {
        messages: [new HumanMessage(input.prompt)],
      },
      {
        recursionLimit: input.maxIterations,
        streamMode: "updates",
      },
    );

    const trace = createTraceEmitter(input).collect("react");
    const messages = [];
    const answerCandidates: string[] = [];
    let llCalls = 0;

    for await (const update of stream) {
      for (const [node, value] of Object.entries(update)) {
        for (const message of value.messages ?? []) {
      messages.push(message);
      if (isAIMessage(message)) {
        llCalls += 1;
        const aiContent = contentToString(message.content);
        if (aiContent.trim().length > 0) {
          trace.push({ type: "thought", content: aiContent, node });
        }

        for (const toolCall of message.tool_calls ?? []) {
          trace.push({
            type: "action",
            node,
            content: `Calling ${toolCall.name}`,
            action: {
              tool: toolCall.name,
              args: (toolCall.args ?? {}) as Record<string, unknown>,
            },
          });
        }

        if ((message.tool_calls ?? []).length === 0 && aiContent.trim().length > 0) {
          answerCandidates.push(aiContent);
        }
      } else if (isToolMessage(message)) {
        trace.push({
          type: "observation",
          node,
          content: contentToString(message.content),
        });
      }
        }
      }
    }

    const answer = answerCandidates.at(-1) ?? "Sem resposta final gerada.";
    trace.push({ type: "answer", content: answer, node: "resposta" });

    const promptTokens = extractPromptTokens(messages, input.prompt);

    return {
      answer,
      trace,
      metrics: {
        llCalls,
        latencyMs: Date.now() - startedAt,
        promptTokens,
        modelUsed: llm.model,
      },
    };
  }
}
