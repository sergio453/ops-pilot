import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SqliteRequestTraceStore } from "./sqlite-request-trace-store.js";
import { RequestIdCollisionError } from "../obs/errors.js";

const now = new Date().toISOString();
const base = { requestId: "req", conversationId: null, userId: "user", strategy: "react", route: "react", reflect: false, startedAt: now };
const event = (eventIndex: number) => ({ requestId: "req", eventIndex, eventType: "thought", node: "react",
  content: null, payloadJson: null, metadataJson: JSON.stringify({ timestamp: now }), createdAt: now });

test("store validates lifecycle, constraints and deterministic snapshot ordering", () => {
  const store = new SqliteRequestTraceStore({ dbPath: ":memory:" });
  try {
    store.create(base);
    assert.throws(() => store.create(base), RequestIdCollisionError);
    assert.throws(() => store.create({ ...base, requestId: " " }));
    assert.equal(store.get("req")?.request.status, "running");
    assert.equal(store.get("req")?.request.llCalls, null);
    assert.equal(store.get("missing"), null);
    assert.throws(() => store.append({ ...event(0), requestId: "missing" }));
    assert.throws(() => store.append({ ...event(0), node: "" }));
    assert.throws(() => store.append({ ...event(0), eventIndex: -1 }));
    assert.throws(() => store.append({ ...event(0), metadataJson: "bad" }));
    store.append(event(1));
    store.append(event(0));
    assert.throws(() => store.append(event(0)));
    const snapshot = store.get("req")!;
    assert.deepEqual(snapshot.trace.map((e) => e.eventIndex), [0, 1]);
    assert.equal(snapshot.request.traceCount, 2);
    assert.throws(() => store.finish("req", { status: "success", finishedAt: now, llCalls: -1 }));
    store.finish("req", { status: "timeout", finishedAt: now, latencyMs: 20 });
    assert.equal(store.finish("req", { status: "success", finishedAt: now }), false);
    assert.equal(store.append(event(2)), false);
    assert.equal(store.get("req")?.request.status, "timeout");
    assert.equal(store.get("req")?.request.traceCount, 2);
  } finally { store.close(); }
});

test("store persists metrics and payloads across reopen and local lookup is bounded", () => {
  const dir = mkdtempSync(join(tmpdir(), "ops-trace-"));
  const dbPath = join(dir, "ops.db");
  try {
    const store = new SqliteRequestTraceStore({ dbPath });
    store.create(base);
    store.append({ ...event(0), content: "", payloadJson: JSON.stringify({ action: { tool: "x", args: {} } }) });
    store.finish("req", { status: "success", finishedAt: now, llCalls: 2, latencyMs: 5, promptTokens: 42, modelUsed: "test-model" });
    store.close();
    const reopened = new SqliteRequestTraceStore({ dbPath });
    try {
      const start = performance.now();
      const snapshot = reopened.get("req")!;
      assert.ok(performance.now() - start < 500);
      assert.equal(snapshot.request.promptTokens, 42);
      assert.equal(snapshot.request.userId, "user");
      assert.equal(snapshot.request.modelUsed, "test-model");
      assert.equal(snapshot.trace[0].content, "");
      assert.deepEqual(JSON.parse(snapshot.trace[0].payloadJson!), { action: { tool: "x", args: {} } });
    } finally { reopened.close(); }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
