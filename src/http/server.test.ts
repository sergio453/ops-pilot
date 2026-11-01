import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter } from "node:events";

import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

import { createApp } from "./server.js";
import type { ReasoningInput, ReasoningResult, ReasoningStrategy } from "../agents/types.js";
import { SqliteConversationStore } from "../store/sqlite-conversation-store.js";
import { SqliteRequestTraceStore } from "../store/sqlite-request-trace-store.js";
import { createLogger } from "../obs/logger.js";
import { FakeConversationSummarizer, type SummarizeEventPayload } from "../conversation/summarizer.js";

function makeStrategy(handler: (input: ReasoningInput) => Promise<ReasoningResult>): ReasoningStrategy {
  return {
    name: "fake",
    run: handler,
  };
}

async function withServer(
  handler: (baseUrl: string) => Promise<void>,
  options?: Parameters<typeof createApp>[0],
) {
  const traces = new SqliteRequestTraceStore({ dbPath: ":memory:" });
  const app = createApp({ createRequestTraceStore: () => traces, logger: createLogger(() => {}), ...options });
  const server = await new Promise<Server>((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await handler(baseUrl);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    traces.close();
  }
}

test("POST /chat returns answer for valid request", async () => {
  await withServer(
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "status?" }),
      });

      assert.equal(response.status, 200);
      const body = (await response.json()) as ReasoningResult & {
        conversationId: string;
      };
      assert.equal(body.answer, "ok");
      assert.equal(body.metrics.llCalls, 1);
      assert.equal(body.metrics.historyMessages, 0);
      assert.match(body.conversationId, /^[a-f0-9-]{36}$/);
    },
    {
      createRegistry: () => ({
        react: () =>
          makeStrategy(async () => ({
            answer: "ok",
            trace: [{ type: "answer", content: "ok" }],
            metrics: { llCalls: 1, latencyMs: 5 },
          })),
      }),
      createConversationStore: () => new SqliteConversationStore({ dbPath: ":memory:" }),
    },
  );
});

test("POST /chat returns validation errors for invalid body", async () => {
  await withServer(
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ strategy: "react" }),
      });

      assert.equal(response.status, 400);
      const body = (await response.json()) as { error: string; issues: unknown[] };
      assert.equal(body.error, "validation_error");
      assert.ok(Array.isArray(body.issues));
      assert.ok(body.issues.length > 0);
    },
    {
      createRegistry: () => ({
        react: () =>
          makeStrategy(async () => ({
            answer: "ok",
            trace: [{ type: "answer", content: "ok" }],
            metrics: { llCalls: 1, latencyMs: 1 },
          })),
      }),
      createConversationStore: () => new SqliteConversationStore({ dbPath: ":memory:" }),
    },
  );
});

test("POST /chat returns 422 for unknown strategy", async () => {
  await withServer(
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "hi", strategy: "does-not-exist" }),
      });

      assert.equal(response.status, 422);
      const body = (await response.json()) as { error: string; strategy: string };
      assert.equal(body.error, "unknown_strategy");
      assert.equal(body.strategy, "does-not-exist");
    },
    {
      createRegistry: () => ({
        react: () =>
          makeStrategy(async () => ({
            answer: "ok",
            trace: [{ type: "answer", content: "ok" }],
            metrics: { llCalls: 1, latencyMs: 1 },
          })),
      }),
      createConversationStore: () => new SqliteConversationStore({ dbPath: ":memory:" }),
    },
  );
});

test("POST /chat returns 504 when execution exceeds timeout", async () => {
  await withServer(
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "hi", strategy: "react" }),
      });

      assert.equal(response.status, 504);
      const body = (await response.json()) as { error: string };
      assert.equal(body.error, "timeout");
    },
    {
      timeoutMs: 10,
      createRegistry: () => ({
        react: () =>
          makeStrategy(
            async () =>
              await new Promise<ReasoningResult>((resolve) => {
                setTimeout(
                  () =>
                    resolve({
                      answer: "late",
                      trace: [{ type: "answer", content: "late" }],
                      metrics: { llCalls: 1, latencyMs: 100 },
                    }),
                  30,
                );
              }),
          ),
      }),
      createConversationStore: () => new SqliteConversationStore({ dbPath: ":memory:" }),
    },
  );
});

test("POST /chat composes history from prior conversation and returns history metric", async () => {
  const prompts: string[] = [];

  await withServer(
    async (baseUrl) => {
      const firstResponse = await fetch(`${baseUrl}/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: "primeira pergunta",
          conversationId: "conv-123",
        }),
      });
      assert.equal(firstResponse.status, 200);
      const firstBody = (await firstResponse.json()) as ReasoningResult & {
        conversationId: string;
      };
      assert.equal(firstBody.conversationId, "conv-123");
      assert.equal(firstBody.metrics.historyMessages, 0);

      const secondResponse = await fetch(`${baseUrl}/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: "segunda pergunta",
          conversationId: "conv-123",
        }),
      });
      assert.equal(secondResponse.status, 200);
      const secondBody = (await secondResponse.json()) as ReasoningResult & {
        conversationId: string;
      };
      assert.equal(secondBody.conversationId, "conv-123");
      assert.equal(secondBody.metrics.historyMessages, 2);

      assert.equal(prompts[0], "primeira pergunta");
      assert.equal(
        prompts[1],
        "USER: primeira pergunta\nASSISTANT: resposta padrao\nUSER: segunda pergunta",
      );
    },
    {
      createRegistry: () => ({
        react: () =>
          makeStrategy(async (input) => {
            prompts.push(input.prompt);
            return {
              answer: "resposta padrao",
              trace: [{ type: "answer", content: "resposta padrao" }],
              metrics: { llCalls: 1, latencyMs: 1 },
            };
          }),
      }),
      createConversationStore: () => new SqliteConversationStore({ dbPath: ":memory:" }),
    },
  );
});

test("POST /chat injects user memory recall into the prompt when userId is present", async () => {
  const prompts: string[] = [];

  await withServer(
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: "Where is the user based?",
          userId: "user-32",
        }),
      });

      assert.equal(response.status, 200);
      const body = (await response.json()) as ReasoningResult & {
        conversationId: string;
        metrics: { memoryHits: number };
      };
      assert.ok(body.metrics.memoryHits > 0);
      assert.equal(prompts[0], "MEMORY: The user lives in Berlin\nUSER: Where is the user based?");
    },
    {
      createRegistry: () => ({
        react: () =>
          makeStrategy(async (input) => {
            prompts.push(input.prompt);
            return {
              answer: "Berlin",
              trace: [{ type: "answer", content: "Berlin" }],
              metrics: { llCalls: 1, latencyMs: 1 },
            };
          }),
      }),
      createConversationStore: () => new SqliteConversationStore({ dbPath: ":memory:" }),
      createMemoryStore: () => ({
        remember: async () => ({
          id: "memory-1",
          userId: "user-32",
          fact: "The user lives in Berlin",
          embedding: new Float32Array([1, 0, 0]),
          createdAt: new Date().toISOString(),
        }),
        recall: async (_userId: string, query: string) => {
          if (query.toLowerCase().includes("based") || query.toLowerCase().includes("where")) {
            return [{
              id: "memory-1",
              userId: "user-32",
              fact: "The user lives in Berlin",
              embedding: new Float32Array([1, 0, 0]),
              createdAt: new Date().toISOString(),
            }];
          }
          return [];
        },
        forget: async () => true,
      }),
    },
  );
});

test("POST /chat persists only user and assistant messages in order", async () => {
  const store = new SqliteConversationStore({ dbPath: ":memory:" });

  await withServer(
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: "quero status",
          conversationId: "conv-persist",
        }),
      });

      assert.equal(response.status, 200);
      const persisted = store.lastMessages("conv-persist", 12);
      assert.equal(persisted.length, 2);
      assert.equal(persisted[0]?.role, "user");
      assert.equal(persisted[0]?.content, "quero status");
      assert.equal(persisted[1]?.role, "assistant");
      assert.equal(persisted[1]?.content, "resposta final");
    },
    {
      createRegistry: () => ({
        react: () =>
          makeStrategy(async () => ({
            answer: "resposta final",
            trace: [{ type: "answer", content: "resposta final" }],
            metrics: { llCalls: 1, latencyMs: 1 },
          })),
      }),
      createConversationStore: () => store,
    },
  );
});

test("POST /chat returns promptTokens as a non-negative number in metrics", async () => {
  await withServer(
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "Quantos tokens?" }),
      });

      assert.equal(response.status, 200);
      const body = (await response.json()) as {
        metrics: { promptTokens?: number };
      };
      assert.ok(
        typeof body.metrics.promptTokens === "number" && body.metrics.promptTokens >= 0,
        `expected promptTokens >= 0, got ${String(body.metrics.promptTokens)}`,
      );
    },
    {
      createRegistry: () => ({
        react: () =>
          makeStrategy(async () => ({
            answer: "ok",
            trace: [{ type: "answer", content: "ok" }],
            metrics: { llCalls: 1, latencyMs: 1, promptTokens: 42 },
          })),
      }),
      createConversationStore: () => new SqliteConversationStore({ dbPath: ":memory:" }),
    },
  );
});

test("POST /chat returns contextBreakdown with all required fields in metrics", async () => {
  await withServer(
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "Status do cluster?" }),
      });

      assert.equal(response.status, 200);
      const body = (await response.json()) as {
        metrics: {
          contextBreakdown?: {
            memories: number;
            history: number;
            userMessage: number;
            totalEstimated: number;
          };
        };
      };

      const cb = body.metrics.contextBreakdown;
      assert.ok(cb !== undefined, "contextBreakdown deve estar presente");
      assert.ok(typeof cb.memories === "number" && cb.memories >= 0);
      assert.ok(typeof cb.history === "number" && cb.history >= 0);
      assert.ok(typeof cb.userMessage === "number" && cb.userMessage > 0);
      assert.ok(typeof cb.totalEstimated === "number" && cb.totalEstimated > 0);
    },
    {
      createRegistry: () => ({
        react: () =>
          makeStrategy(async () => ({
            answer: "ok",
            trace: [{ type: "answer", content: "ok" }],
            metrics: { llCalls: 1, latencyMs: 1 },
          })),
      }),
      createConversationStore: () => new SqliteConversationStore({ dbPath: ":memory:" }),
    },
  );
});

test("POST /chat injects SUMMARY into prompt when summary exists in store", async () => {
  const prompts: string[] = [];
  const store = new SqliteConversationStore({ dbPath: ":memory:" });
  store.create("conv-with-summary");
  store.saveSummary({
    conversationId: "conv-with-summary",
    summary: "Decisão: cluster auth reiniciado com sucesso.",
    lastSummarizedMessageId: 8,
  });

  await withServer(
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: "Qual o status agora?",
          conversationId: "conv-with-summary",
        }),
      });

      assert.equal(response.status, 200);
      assert.equal(prompts.length, 1);
      assert.ok(prompts[0]?.startsWith("SUMMARY: Decisão: cluster auth reiniciado com sucesso."));
      assert.ok(prompts[0]?.includes("USER: Qual o status agora?"));
    },
    {
      createRegistry: () => ({
        react: () =>
          makeStrategy(async (input) => {
            prompts.push(input.prompt);
            return {
              answer: "Tudo normalizado.",
              trace: [{ type: "answer", content: "Tudo normalizado." }],
              metrics: { llCalls: 1, latencyMs: 1 },
            };
          }),
      }),
      createConversationStore: () => store,
    },
  );
});

test("POST /chat triggers summarize event when batch of 8 messages is pruned", async () => {
  const store = new SqliteConversationStore({ dbPath: ":memory:" });
  const emitter = new EventEmitter();
  const summarizer = new FakeConversationSummarizer();
  const events: SummarizeEventPayload[] = [];
  emitter.on("summarize", (payload: SummarizeEventPayload) => {
    events.push(payload);
  });

  await withServer(
    async (baseUrl) => {
      const convId = "conv-pruning-flow";
      // 8 requisições = 16 mensagens (8 user + 8 assistant)
      // Com janela de 8 recentes, na 8ª requisição exatamente 8 mensagens saíram da janela
      for (let i = 1; i <= 8; i++) {
        const resp = await fetch(`${baseUrl}/chat`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            message: `pergunta turno ${i}`,
            conversationId: convId,
          }),
        });
        assert.equal(resp.status, 200);
      }

      // Ao completar 16 mensagens, o evento summarize deve ter sido emitido exatamente 1 vez
      assert.equal(events.length, 1);
      assert.equal(events[0]?.conversationId, convId);
      assert.equal(events[0]?.messagesSummarized.length, 8);
      assert.ok(events[0]?.newSummary.includes("pergunta turno 1"));

      const saved = store.getSummary(convId);
      assert.ok(saved !== null);
      assert.equal(saved.summary, events[0]?.newSummary);
    },
    {
      createRegistry: () => ({
        react: () =>
          makeStrategy(async () => ({
            answer: "resposta automática",
            trace: [{ type: "answer", content: "resposta automática" }],
            metrics: { llCalls: 1, latencyMs: 1 },
          })),
      }),
      createConversationStore: () => store,
      createSummarizer: () => summarizer,
      eventEmitter: emitter,
    },
  );
});
