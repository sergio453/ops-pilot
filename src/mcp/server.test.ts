import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { JSONRPCMessage, MessageExtraInfo } from "@modelcontextprotocol/sdk/types.js";

import { SqliteOpsStore } from "../store/sqlite-ops-store.js";
import { createOpsPilotMcpServer, OPSPILOT_MCP_TOOL_NAMES, startOpsPilotMcpServer } from "./server.js";

class FakeTransport {
  started = false;
  sent: JSONRPCMessage[] = [];
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: <T extends JSONRPCMessage>(message: T, extra?: MessageExtraInfo) => void;

  async start(): Promise<void> {
    this.started = true;
  }

  async send(message: JSONRPCMessage): Promise<void> {
    this.sent.push(message);
  }

  async close(): Promise<void> {
    this.onclose?.();
  }
}

function getBinding(name: (typeof OPSPILOT_MCP_TOOL_NAMES)[number]) {
  const runtime = createOpsPilotMcpServer({ store: new SqliteOpsStore({ dbPath: ":memory:" }) });
  const binding = runtime.bindings.find((candidate) => candidate.name === name);
  assert.ok(binding, `binding ${name} should exist`);
  return { runtime, binding };
}

test("server exposes only MCP tools in scope", () => {
  const runtime = createOpsPilotMcpServer({ store: new SqliteOpsStore({ dbPath: ":memory:" }) });
  assert.deepEqual(runtime.toolCatalog, ["list_alerts", "open_incident", "resolve_incident"]);
  assert.equal(runtime.bindings.length, 3);
  assert.deepEqual(
    runtime.bindings.map((binding) => binding.name),
    ["list_alerts", "open_incident", "resolve_incident"],
  );
});

test("list_alerts call returns serialized alerts collection", async () => {
  const { binding } = getBinding("list_alerts");
  const output = await binding.call({ status: "firing" });

  assert.equal(output.isError, undefined);
  const text = output.content[0]?.text ?? "";
  const parsed = JSON.parse(text) as { alerts: unknown[] };
  assert.ok(Array.isArray(parsed.alerts));
});

test("open_incident + resolve_incident share store state", async () => {
  const store = new SqliteOpsStore({ dbPath: ":memory:" });
  const runtime = createOpsPilotMcpServer({ store });
  const open = runtime.bindings.find((binding) => binding.name === "open_incident");
  const resolve = runtime.bindings.find((binding) => binding.name === "resolve_incident");
  assert.ok(open);
  assert.ok(resolve);

  const opened = await open.call({ title: "Erro 500 no checkout", service: "checkout", severity: "high" });
  const openedIncident = JSON.parse(opened.content[0]?.text ?? "{}") as { incident?: { id: string } };
  assert.ok(openedIncident.incident?.id);

  const resolved = await resolve.call({ id: openedIncident.incident.id });
  const resolvedIncident = JSON.parse(resolved.content[0]?.text ?? "{}") as {
    incident?: { id: string; status: string; resolvedAt: string | null };
  };
  assert.equal(resolvedIncident.incident?.id, openedIncident.incident.id);
  assert.equal(resolvedIncident.incident?.status, "resolved");
  assert.ok(resolvedIncident.incident?.resolvedAt);
});

test("invalid open_incident input returns explicit validation error", async () => {
  const { binding } = getBinding("open_incident");
  const output = await binding.call({ title: "", service: "checkout", severity: "urgent" as "high" });

  assert.equal(output.isError, true);
  assert.match(output.content[0]?.text ?? "", /open_incident falhou/i);
});

test("resolve_incident unknown id returns explicit error", async () => {
  const { binding } = getBinding("resolve_incident");
  const output = await binding.call({ id: "inc-999" });

  assert.equal(output.isError, true);
  assert.match(output.content[0]?.text ?? "", /resolve_incident falhou/i);
});

test("list_alerts invalid status returns explicit error", async () => {
  const { binding } = getBinding("list_alerts");
  const output = await binding.call({ status: "invalid" as "firing" });

  assert.equal(output.isError, true);
  assert.match(output.content[0]?.text ?? "", /list_alerts falhou/i);
});

test("server source does not use console.log", () => {
  const source = readFileSync(new URL("./server.ts", import.meta.url), "utf-8");
  assert.equal(source.includes("console.log("), false);
});

test("startup diagnostics are written through error channel", async () => {
  const diagnosticsCalls: unknown[][] = [];
  const diagnostics = {
    error: (...args: unknown[]) => {
      diagnosticsCalls.push(args);
    },
  };

  const transport = new FakeTransport();
  const runtime = await startOpsPilotMcpServer({
    store: new SqliteOpsStore({ dbPath: ":memory:" }),
    transport,
    diagnostics,
  });
  await runtime.server.close();

  assert.equal(transport.started, true);
  assert.equal(diagnosticsCalls.length, 1);
  assert.match(String(diagnosticsCalls[0]?.[0]), /opspilot MCP server: pronto/i);
});
