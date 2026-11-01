import assert from "node:assert/strict";
import test from "node:test";

import { InvalidCritiqueResultError } from "./errors.js";
import { withReflection } from "./reflection.js";
import type { ReasoningInput, ReasoningResult, ReasoningStrategy } from "./types.js";

class FakeStrategy implements ReasoningStrategy {
  public readonly name = "fake";
  public readonly calls: ReasoningInput[] = [];
  private readonly queue: ReasoningResult[];

  constructor(queue: ReasoningResult[]) {
    this.queue = queue;
  }

  async run(input: ReasoningInput): Promise<ReasoningResult> {
    this.calls.push(input);
    const index = Math.min(this.calls.length - 1, this.queue.length - 1);
    return this.queue[index];
  }
}

test("withReflection stops when first critique approves", async () => {
  const strategy = new FakeStrategy([
    {
      answer: "Resposta inicial",
      trace: [{ type: "answer", content: "Resposta inicial" }],
      metrics: { llCalls: 2, latencyMs: 10 },
    },
  ]);

  const reflective = withReflection(strategy, {
    critique: async () => ({
      approved: true,
      feedback: "Resposta adequada",
    }),
  });

  const result = await reflective.run({
    prompt: "Priorize alertas",
    maxIterations: 6,
  });

  assert.equal(strategy.calls.length, 1);
  assert.equal(result.answer, "Resposta inicial");
  assert.equal(result.metrics.llCalls, 3);
  assert.equal(result.trace.at(-1)?.type, "critique");
});

test("withReflection regenerates when critique rejects and passes feedback in prompt", async () => {
  const strategy = new FakeStrategy([
    {
      answer: "Resposta incompleta",
      trace: [
        { type: "observation", content: "alert-001 critical" },
        { type: "answer", content: "Resposta incompleta" },
      ],
      metrics: { llCalls: 1, latencyMs: 5 },
    },
    {
      answer: "Resposta corrigida",
      trace: [{ type: "answer", content: "Resposta corrigida" }],
      metrics: { llCalls: 2, latencyMs: 8 },
    },
  ]);

  let critiqueCount = 0;
  const reflective = withReflection(strategy, {
    critique: async () => {
      critiqueCount += 1;
      if (critiqueCount === 1) {
        return { approved: false, feedback: "Detalhar impacto no serviço payments" };
      }
      return { approved: true, feedback: "Agora está acionável" };
    },
  });

  const result = await reflective.run({
    prompt: "Avalie os alertas firing",
    maxIterations: 6,
  });

  assert.equal(strategy.calls.length, 2);
  assert.match(strategy.calls[1].prompt, /Detalhar impacto no serviço payments/);
  assert.equal(result.answer, "Resposta corrigida");
  assert.equal(result.metrics.llCalls, 5);
});

test("withReflection stops at maxReflections and returns latest answer", async () => {
  const strategy = new FakeStrategy([
    {
      answer: "Resposta v1",
      trace: [{ type: "answer", content: "Resposta v1" }],
      metrics: { llCalls: 1, latencyMs: 4 },
    },
    {
      answer: "Resposta v2",
      trace: [{ type: "answer", content: "Resposta v2" }],
      metrics: { llCalls: 1, latencyMs: 4 },
    },
  ]);

  const reflective = withReflection(strategy, {
    maxReflections: 1,
    critique: async () => ({
      approved: false,
      feedback: "Ainda insuficiente",
    }),
  });

  const result = await reflective.run({
    prompt: "Priorize incidentes",
    maxIterations: 6,
  });

  assert.equal(strategy.calls.length, 2);
  assert.equal(result.answer, "Resposta v2");
  const critiqueEvents = result.trace.filter((event) => event.type === "critique");
  assert.equal(critiqueEvents.length, 2);
});

test("withReflection respects zero maxReflections by avoiding regeneration", async () => {
  const strategy = new FakeStrategy([
    {
      answer: "Resposta única",
      trace: [{ type: "answer", content: "Resposta única" }],
      metrics: { llCalls: 1, latencyMs: 3 },
    },
  ]);

  const reflective = withReflection(strategy, {
    maxReflections: 0,
    critique: async () => ({
      approved: false,
      feedback: "Corrigir prioridade",
    }),
  });

  await reflective.run({
    prompt: "Tratar alertas",
    maxIterations: 6,
  });

  assert.equal(strategy.calls.length, 1);
});

test("withReflection throws explicit error for malformed critique payload", async () => {
  const strategy = new FakeStrategy([
    {
      answer: "Resposta inicial",
      trace: [{ type: "answer", content: "Resposta inicial" }],
      metrics: { llCalls: 1, latencyMs: 3 },
    },
  ]);

  const reflective = withReflection(strategy, {
    critique: async () => ({
      approved: true,
    }),
  });

  await assert.rejects(
    reflective.run({
      prompt: "Priorize alertas",
      maxIterations: 6,
    }),
    (error: unknown) => error instanceof InvalidCritiqueResultError,
  );
});
