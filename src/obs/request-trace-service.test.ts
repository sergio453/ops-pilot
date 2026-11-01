import assert from "node:assert/strict";
import test from "node:test";
import { RequestTraceService } from "./request-trace-service.js";
import { RequestIdCollisionError, TracePersistenceError } from "./errors.js";
import { SqliteRequestTraceStore } from "../store/sqlite-request-trace-store.js";
import { createLogger } from "./logger.js";

const start = { requestId: "collision", conversationId: null, userId: null, strategy: "react", route: "react", reflect: false, startedAt: new Date().toISOString() };
test("service retries only ID collisions and closes terminal state once", () => {
  const store = new SqliteRequestTraceStore({ dbPath: ":memory:" });
  try {
    store.create(start);
    const lines: string[] = [];
    const service = new RequestTraceService(store, createLogger((line) => lines.push(line)), () => "replacement");
    const session = service.start(start);
    assert.equal(session.requestId, "replacement");
    session.append({ type: "thought", content: "SECRET", node: "planner" });
    session.finish({ status: "success", finishedAt: new Date().toISOString() });
    assert.equal(session.finish({ status: "error", finishedAt: new Date().toISOString() }), false);
    session.append({ type: "answer", content: "late" });
    assert.equal(lines.length, 2);
    assert.equal(store.get("replacement")?.trace.length, 1);
    assert.equal(store.get("collision")?.request.status, "running");
    assert.ok(!lines.join("").includes("SECRET"));
    assert.throws(() => new RequestTraceService(store, createLogger(() => {}), () => "collision").start(start), RequestIdCollisionError);
  } finally { store.close(); }
});

test("service exposes callback failures even if the strategy swallows them", () => {
  const store = new SqliteRequestTraceStore({ dbPath: ":memory:" });
  try {
    const service = new RequestTraceService(store, createLogger(() => { throw new Error("sink failed"); }));
    const session = service.start(start);
    assert.throws(() => session.append({ type: "answer", content: "ok" }), TracePersistenceError);
    assert.throws(() => session.assertHealthy(), TracePersistenceError);
    assert.throws(() => session.finish({ status: "error", finishedAt: new Date().toISOString() }), /sink failed/);
    const broken = new RequestTraceService({ create: () => { throw new Error("disk failed"); }, append: () => false, finish: () => false, get: () => null }, createLogger(() => {}), () => { throw new Error("must not retry"); });
    assert.throws(() => broken.start(start), /disk failed/);
  } finally { store.close(); }
});
