import assert from "node:assert/strict";
import test from "node:test";

import {
  buildContext,
  fitToBudget,
  section,
  type ContextSection,
} from "./builder.js";

test("section with cut: never preserves content even if above budget", () => {
  const longText = "a".repeat(1000); // 250 tokens
  const sec = section("system", longText, { budget: 50, cut: "never" });
  const fitted = fitToBudget(sec);
  assert.equal(fitted.items.length, 1);
  assert.equal(fitted.items[0]?.text, longText);
});

test("fitToBudget with cut: oldest-first drops oldest messages to fit budget", () => {
  const history = [
    { conversationId: "c1", role: "user" as const, content: "mensagem 1 bem longa " + "x".repeat(100), createdAt: "2026-01-01" },
    { conversationId: "c1", role: "assistant" as const, content: "resposta 1 longa " + "y".repeat(100), createdAt: "2026-01-02" },
    { conversationId: "c1", role: "user" as const, content: "mensagem recente 3", createdAt: "2026-01-03" },
  ];

  const sec = section("history", history, { budget: 20, cut: "oldest-first" });
  const fitted = fitToBudget(sec);

  // Deve ter descartado as mensagens antigas mantendo a mais recente
  assert.ok(fitted.items.length < history.length);
  assert.ok(fitted.items.some((i) => i.text.includes("mensagem recente 3")));
  assert.ok(!fitted.items.some((i) => i.text.includes("mensagem 1 bem longa")));
});

test("fitToBudget with cut: lowest-score-first drops memories with lowest score", () => {
  const memories = [
    { id: "m1", userId: "u1", fact: "Fato score alto", embedding: new Float32Array(), createdAt: "2026-01-01", score: 0.95 },
    { id: "m2", userId: "u1", fact: "Fato score baixo " + "z".repeat(120), embedding: new Float32Array(), createdAt: "2026-01-01", score: 0.35 },
    { id: "m3", userId: "u1", fact: "Fato score medio", embedding: new Float32Array(), createdAt: "2026-01-01", score: 0.75 },
  ];

  const sec = section("memories", memories, { budget: 25, cut: "lowest-score-first" });
  const fitted = fitToBudget(sec);

  // O de score 0.35 deve ser descartado primeiro
  assert.ok(!fitted.items.some((i) => i.id === "m2"));
  assert.ok(fitted.items.some((i) => i.id === "m1"));
});

test("buildContext returns assembled prompt and granular section breakdown", () => {
  const result = buildContext({
    message: "Status atual do cluster?",
    systemPrompt: "Você é um plantonista de SRE.",
    summary: "Cluster auth foi reiniciado às 10h.",
    history: [
      { conversationId: "c1", role: "user", content: "oi", createdAt: "2026-01-01" },
      { conversationId: "c1", role: "assistant", content: "olá", createdAt: "2026-01-01" },
    ],
    memories: [
      { id: "m1", userId: "u1", fact: "O usuário opera em us-east-1", embedding: new Float32Array(), createdAt: "2026-01-01", score: 0.9 },
    ],
  });

  assert.ok(result.prompt.includes("Você é um plantonista de SRE."));
  assert.ok(result.prompt.includes("SUMMARY: Cluster auth foi reiniciado às 10h."));
  assert.ok(result.prompt.includes("USER: oi"));
  assert.ok(result.prompt.includes("MEMORY: O usuário opera em us-east-1"));
  assert.ok(result.prompt.includes("USER: Status atual do cluster?"));

  assert.ok(result.breakdown.system > 0);
  assert.ok(result.breakdown.summary > 0);
  assert.ok(result.breakdown.history > 0);
  assert.ok(result.breakdown.memories > 0);
  assert.ok(result.breakdown.userMessage > 0);
  assert.ok(result.breakdown.totalEstimated > 0);
});

