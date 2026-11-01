import assert from "node:assert/strict";
import test from "node:test";
import { AIMessage, ToolMessage, type BaseMessage } from "@langchain/core/messages";
import { ReactReasoningStrategy } from "./react.js";
import { PlanAndExecuteReasoningStrategy } from "./plan-and-execute.js";
import { SqliteOpsStore } from "../store/sqlite-ops-store.js";
import type { TraceEvent } from "./types.js";

test("react streams graph nodes in order and preserves metrics without a provider", async () => {
  const emitted: TraceEvent[] = [];
  const messages = [new AIMessage({ content: "checking", tool_calls: [{ name: "list_alerts", args: {}, id: "call", type: "tool_call" }] }),
    new ToolMessage({ content: "no alerts", tool_call_id: "call" }), new AIMessage("ok")];
  const strategy = new ReactReasoningStrategy(new SqliteOpsStore({ dbPath: ":memory:" }), {
    createModel: () => ({ model: "fake-model" } as never),
    createAgent: () => ({ invoke: async () => ({ messages }), stream: async () => (async function* (): AsyncGenerator<Record<string, { messages: BaseMessage[] }>> {
      yield { agent: { messages: [messages[0]] } };
      assert.equal(emitted.length, 2, "thought and action must be emitted before the tool completes");
      yield { tools: { messages: [messages[1]] } };
      yield { agent: { messages: [messages[2]] } };
    })() }),
  });
  const result = await strategy.run({ prompt: "status", maxIterations: 6, onTrace: (event) => { emitted.push(event); } });
  assert.equal(result.answer, "ok");
  assert.deepEqual(emitted, [...result.trace]);
  assert.deepEqual(emitted.map((event) => event.node), ["agent", "agent", "tools", "agent", "resposta"]);
  assert.equal(result.metrics.llCalls, 2);
  assert.equal(result.metrics.modelUsed, "fake-model");
});

test("react preserves emitted events when graph execution fails", async () => {
  const emitted: TraceEvent[] = [];
  const strategy = new ReactReasoningStrategy(new SqliteOpsStore({ dbPath: ":memory:" }), {
    createModel: () => ({ model: "fake" } as never),
    createAgent: () => ({ invoke: async () => ({ messages: [] }), stream: async () => (async function* () {
      yield { agent: { messages: [new AIMessage("partial")] } };
      throw new Error("provider failed");
    })() }),
  });
  await assert.rejects(strategy.run({ prompt: "status", maxIterations: 6, onTrace: (event) => { emitted.push(event); } }), /provider failed/);
  assert.equal(emitted.length, 1);
});

test("plan executor publishes node traces incrementally without duplicate events", async () => {
  const emitted: TraceEvent[] = [];
  const strategy = new PlanAndExecuteReasoningStrategy(new SqliteOpsStore({ dbPath: ":memory:" }), {
    createModel: () => ({ model: "fake-model",
      withStructuredOutput: () => ({ invoke: async () => ({ steps: ["inspect"] }) }),
      bindTools: () => ({ invoke: async () => {
        assert.equal(emitted[0]?.node, "planner");
        return new AIMessage("healthy");
      } }),
    } as never),
  });
  const result = await strategy.run({ prompt: "status", maxIterations: 6, onTrace: (event) => { emitted.push(event); } });
  assert.equal(result.answer, "healthy");
  assert.deepEqual(emitted, result.trace);
  assert.deepEqual(emitted.map((event) => event.node), ["planner", "executor", "replanner"]);
});
