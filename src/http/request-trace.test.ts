import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "./server.js";
import type { ReasoningInput, ReasoningResult } from "../agents/types.js";
import { SqliteRequestTraceStore } from "../store/sqlite-request-trace-store.js";
import { SqliteConversationStore } from "../store/sqlite-conversation-store.js";
import { createLogger } from "../obs/logger.js";

const result: ReasoningResult = { answer: "ok", trace: [{ type: "answer", content: "ok", node: "resposta" }],
  metrics: { llCalls: 1, latencyMs: 5, promptTokens: 12, modelUsed: "test-model" } };

async function fixture(run: (input: ReasoningInput) => Promise<ReasoningResult>, check: (url: string, store: SqliteRequestTraceStore, lines: string[]) => Promise<void>, timeoutMs = 5000, dbPath = ":memory:") {
  const store = new SqliteRequestTraceStore({ dbPath });
  const lines: string[] = [];
  const app = createApp({ timeoutMs, createRequestTraceStore: () => store,
    logger: createLogger((line) => lines.push(line)),
    createRegistry: () => ({ react: () => ({ name: "react", run }) }),
    createConversationStore: () => new SqliteConversationStore({ dbPath: ":memory:" }),
    createMemoryStore: () => ({ recall: async () => [], remember: async () => ({} as never), forget: async () => false }),
  });
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  try { await check(`http://127.0.0.1:${(server.address() as AddressInfo).port}`, store, lines); }
  finally { await new Promise<void>((resolve) => server.close(() => resolve())); store.close(); }
}
const post = (url: string, body: unknown = { message: "SECRET", userId: "u" }) => fetch(`${url}/chat`, {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
});

test("HTTP history survives server and SQLite store restart", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ops-http-trace-"));
  const dbPath = join(dir, "trace.db");
  let requestId = "";
  let saved: unknown;
  try {
    await fixture(async () => result, async (url) => {
      const response = await post(url);
      assert.equal(response.status, 200);
      requestId = (await response.json()).requestId;
      saved = await (await fetch(`${url}/requests/${requestId}`)).json();
    }, 5000, dbPath);
    await fixture(async () => { throw new Error("must not run a model during lookup"); }, async (url) => {
      const response = await fetch(`${url}/requests/${requestId}`);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), saved);
    }, 5000, dbPath);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("history can be queried from seeded records and fails safely on read errors", async () => {
  await fixture(async () => result, async (url, store) => {
    const now = new Date().toISOString();
    store.create({ requestId: "seeded", conversationId: null, userId: null, strategy: "react", route: "react", reflect: false, startedAt: now });
    const running = await (await fetch(`${url}/requests/seeded`)).json();
    assert.equal(running.request.status, "running");
    assert.equal(running.request.metrics.llCalls, null);
    assert.deepEqual(running.trace, []);
    for (const index of [1, 0]) store.append({ requestId: "seeded", eventIndex: index, eventType: "thought", node: "agent",
      content: "", payloadJson: null, metadataJson: "{}", createdAt: now });
    const history = await (await fetch(`${url}/requests/seeded`)).json();
    assert.deepEqual(history.trace.map((event: { eventIndex: number }) => event.eventIndex), [0, 1]);
    store.get = () => { throw new Error("SECRET"); };
    const failed = await fetch(`${url}/requests/seeded`);
    assert.equal(failed.status, 500);
    assert.ok(!JSON.stringify(await failed.json()).includes("SECRET"));
  });
});

test("chat never reports success when persistence fails", async () => {
  await fixture(async (input) => { input.onTrace?.(result.trace[0]); return result; }, async (url, store) => {
    store.append = () => { throw new Error("SECRET"); };
    const response = await post(url);
    assert.equal(response.status, 500);
    const body = await response.json();
    assert.equal(body.error, "persistence_error");
    assert.equal(body.requestId, response.headers.get("X-Request_Id"));
    assert.equal(store.get(body.requestId)?.request.status, "error");
    assert.ok(!JSON.stringify(body).includes("SECRET"));
  });
});

test("chat correlation, durable metrics, payloads and JSONL agree across concurrent calls", async () => {
  await fixture(async () => result, async (url, store, lines) => {
    const responses = await Promise.all([post(url), post(url)]);
    const ids = new Set<string>();
    for (const response of responses) {
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(response.headers.get("X-Request_Id"), body.requestId);
      ids.add(body.requestId);
      const snapshot = store.get(body.requestId)!;
      assert.equal(snapshot.request.status, "success");
      assert.equal(snapshot.request.userId, "u");
      assert.equal(snapshot.request.modelUsed, "test-model");
      assert.equal(snapshot.request.traceCount, 1);
      const first = await (await fetch(`${url}/requests/${body.requestId}`)).json();
      const second = await (await fetch(`${url}/requests/${body.requestId}`)).json();
      assert.deepEqual(first, second);
      assert.equal(first.request.metrics.promptTokens, 12);
      assert.equal(first.trace[0].payload.content, "ok");
      assert.equal(first.trace[0].node, "resposta");
    }
    assert.equal(ids.size, 2);
    assert.equal(lines.filter((line) => JSON.parse(line).eventType !== "done").length, 2);
    const done = lines.map((line) => JSON.parse(line)).filter((event) => event.eventType === "done");
    assert.equal(done.length, 2);
    assert.equal(done[0].node, "resposta");
    assert.equal(done[0].route, "react");
    assert.equal(done[0].tokens, 12);
    assert.ok(!lines.join("").includes("SECRET"));
    assert.equal((await fetch(`${url}/requests/unknown`)).status, 404);
    assert.equal((await fetch(`${url}/requests/%20`)).status, 400);
  });
});

test("chat correlates validation, parser and unknown-strategy errors", async () => {
  await fixture(async () => result, async (url) => {
    for (const [body, status] of [[{}, 400], [{ message: "hi", strategy: "unknown" }, 422]] as const) {
      const response = await post(url, body);
      assert.equal(response.status, status);
      assert.equal((await response.json()).requestId, response.headers.get("X-Request_Id"));
    }
    const response = await fetch(`${url}/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: "{" });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).requestId, response.headers.get("X-Request_Id"));
    const trailing = await fetch(`${url}/CHAT/`, { method: "POST", headers: { "content-type": "application/json" }, body: '{"message":"hi"}' });
    assert.equal(trailing.status, 200);
    assert.equal((await trailing.json()).requestId, trailing.headers.get("X-Request_Id"));
  });
});

test("partial trace remains visible during running and after failure", async () => {
  let release!: () => void;
  let emitted!: () => void;
  const ready = new Promise<void>((resolve) => { emitted = resolve; });
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await fixture(async (input) => {
    input.onTrace?.({ type: "thought", node: "react", content: "SECRET" });
    emitted();
    await gate;
    throw new Error("SECRET");
  }, async (url, store, lines) => {
    const pending = post(url);
    await ready;
    const id = JSON.parse(lines[0]).requestId;
    const running = await (await fetch(`${url}/requests/${id}`)).json();
    assert.equal(running.request.status, "running");
    assert.equal(running.request.finishedAt, null);
    assert.equal(running.trace.length, 1);
    release();
    const response = await pending;
    assert.equal(response.status, 500);
    assert.equal(response.headers.get("X-Request_Id"), id);
    assert.ok(!JSON.stringify(await response.json()).includes("SECRET"));
    assert.equal(store.get(id)?.request.status, "error");
    assert.equal(lines.length, 2);
  });
});

test("timeout freezes persisted partial trace and ignores late callback", async () => {
  let late!: () => void;
  await fixture(async (input) => {
    input.onTrace?.({ type: "thought", node: "react", content: "first" });
    late = () => input.onTrace?.({ type: "answer", node: "resposta", content: "late" });
    return new Promise(() => {});
  }, async (url, store, lines) => {
    const response = await post(url);
    assert.equal(response.status, 504);
    const body = await response.json();
    assert.equal(response.headers.get("X-Request_Id"), body.requestId);
    late();
    assert.equal(store.get(body.requestId)?.request.status, "timeout");
    assert.equal(store.get(body.requestId)?.trace.length, 1);
    assert.equal(lines.length, 2);
  }, 30);
});
