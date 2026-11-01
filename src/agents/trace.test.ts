import test from "node:test";
import assert from "node:assert/strict";

import { formatTrace, formatTraceEvent, createTraceEmitter } from "./trace.js";
import { withReflection } from "./reflection.js";
import type { TraceEvent } from "./types.js";

test("incremental emitter preserves order, node and callback errors", () => {
  const emitted: TraceEvent[] = [];
  const emitter = createTraceEmitter({ prompt: "", maxIterations: 1, onTrace: (event) => { emitted.push(event); } });
  const trace = emitter.collect("executor");
  trace.push({ type: "action", content: "call" });
  assert.equal(emitted.length, 1);
  emitter.publish(trace, "executor");
  trace.push({ type: "observation", content: "done" });
  assert.deepEqual(emitted, [...trace]);
  assert.equal(emitted[0].node, "executor");
  const broken = createTraceEmitter({ prompt: "", maxIterations: 1, onTrace: () => { throw new Error("sink failed"); } });
  assert.throws(() => broken.collect("node").push({ type: "answer", content: "x" }), /sink failed/);
});

test("reflection publishes each base and critique event once, including retries", async () => {
  const emitted: TraceEvent[] = [];
  let attempts = 0;
  const strategy = withReflection({ name: "fake", run: async (input) => {
    const event: TraceEvent = { type: "answer", content: `answer-${++attempts}`, node: "resposta" };
    input.onTrace?.(event);
    return { answer: event.content, trace: [event], metrics: { llCalls: 1, latencyMs: 1 } };
  } }, { critique: async () => ({ approved: attempts === 2, feedback: "review" }) });
  const result = await strategy.run({ prompt: "hi", maxIterations: 2, onTrace: (event) => { emitted.push(event); } });
  assert.deepEqual(emitted, result.trace);
  assert.deepEqual(emitted.map((event) => event.node), ["resposta", "reflector", "resposta", "reflector"]);
});

test("failure after an emitted event retains the incremental observation", async () => {
  const emitted: TraceEvent[] = [];
  const strategy = withReflection({ name: "fake", run: async (input) => {
    input.onTrace?.({ type: "thought", content: "partial", node: "react" });
    throw new Error("failed");
  } }, { critique: async () => ({ approved: true, feedback: "ok" }) });
  await assert.rejects(strategy.run({ prompt: "hi", maxIterations: 1, onTrace: (event) => { emitted.push(event); } }), /failed/);
  assert.equal(emitted.length, 1);
});

test("formatTraceEvent formats action events with tool payload", () => {
  const event: TraceEvent = {
    type: "action",
    content: "Calling tool",
    action: {
      tool: "list_alerts",
      args: { status: "firing" },
    },
  };

  assert.equal(
    formatTraceEvent(event, 0),
    '1. [ACTION] list_alerts {"status":"firing"}',
  );
});

test("formatTrace returns deterministic multi-line output", () => {
  const trace: TraceEvent[] = [
    { type: "plan", content: "Verificar alertas ativos" },
    {
      type: "action",
      content: "Call tool",
      action: { tool: "list_alerts", args: { status: "firing" } },
    },
    { type: "observation", content: '{"alerts":[{"id":"alert-001"}]}' },
    { type: "critique", content: "approved=false; feedback=detalhar impacto" },
    { type: "answer", content: "Tratar alert-001 primeiro." },
  ];

  const expected =
    "  1. [PLAN] Verificar alertas ativos\n" +
    '  2. [ACTION] list_alerts {"status":"firing"}\n' +
    '  3. [OBSERVATION] {"alerts":[{"id":"alert-001"}]}\n' +
    "  4. [CRITIQUE] approved=false; feedback=detalhar impacto\n" +
    "  5. [ANSWER] Tratar alert-001 primeiro.";

  assert.equal(formatTrace(trace), expected);
});
