import assert from "node:assert/strict";
import test from "node:test";
import { createLogger } from "./logger.js";

test("logger emits only allowlisted metadata, one JSON line per event", () => {
  const lines: string[] = [];
  const log = createLogger((line) => lines.push(line));
  log.info({ timestamp: new Date().toISOString(), requestId: "id", eventIndex: 0,
    eventType: "answer", node: "resposta", payload: "SECRET\nPASSWORD", request: "SECRET" } as never);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].split("\n").length, 2);
  assert.ok(!lines[0].includes("SECRET"));
  assert.deepEqual(Object.keys(JSON.parse(lines[0])), ["timestamp", "requestId", "eventIndex", "eventType", "node"]);
});
