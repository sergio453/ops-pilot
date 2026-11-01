import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

import { UnknownIncidentError, UnknownRunbookError, UnknownServiceError } from "./errors.js";
import { PlanAndExecuteReasoningStrategy } from "./plan-and-execute.js";
import { ReactReasoningStrategy } from "./react.js";
import { StoryStore, createAgentTools, fetchProviderStatus, getStorySeedPath } from "./tools.js";
import { SqliteOpsStore } from "../store/sqlite-ops-store.js";

test("StoryStore starts with five services and six alerts", () => {
  const store = new StoryStore();
  const snapshot = store.snapshot();

  assert.equal(snapshot.services.length, 5);
  assert.equal(snapshot.alerts.length, 6);
  assert.equal(snapshot.alerts.filter((alert) => alert.status === "firing").length, 3);
  assert.equal(snapshot.alerts.filter((alert) => alert.status === "resolved").length, 3);
  assert.equal(snapshot.runbooks.length, 3);
});

test("SqliteOpsStore :memory: seeds Mercadinho scenario idempotently", () => {
  const store = new SqliteOpsStore({ dbPath: ":memory:" });
  store.seedDefault();

  const snapshot = store.snapshot();
  assert.equal(snapshot.services.length, 5);
  assert.equal(snapshot.alerts.length, 6);
  assert.equal(snapshot.alerts.filter((alert) => alert.status === "firing").length, 3);
  assert.equal(snapshot.alerts.filter((alert) => alert.status === "resolved").length, 3);
  assert.equal(snapshot.runbooks.length, 3);
});

test("listAlerts filters by status", () => {
  const store = new StoryStore();

  const firing = store.listAlerts("firing");
  const resolved = store.listAlerts("resolved");

  assert.equal(firing.length, 3);
  assert.equal(resolved.length, 3);
  assert.equal(firing.every((alert) => alert.status === "firing"), true);
  assert.equal(resolved.every((alert) => alert.status === "resolved"), true);
});

test("listAlerts supports all status filter", () => {
  const store = new StoryStore();
  const all = store.listAlerts("all");

  assert.equal(all.length, 6);
});

test("open, list and resolve incidents on sqlite memory store", () => {
  const store = new SqliteOpsStore({ dbPath: ":memory:" });

  const incident = store.openIncident({
    title: "Teste de incidente",
    service: "payments",
    severity: "critical",
  });
  assert.equal(incident.status, "open");
  assert.equal(incident.id, "inc-001");
  assert.equal(incident.resolvedAt, null);

  const openOnly = store.listIncidents("open");
  assert.equal(openOnly.length, 1);

  const resolved = store.resolveIncidentById(incident.id);
  assert.equal(resolved.status, "resolved");
  assert.equal(typeof resolved.resolvedAt, "string");

  const resolvedOnly = store.listIncidents("resolved");
  assert.equal(resolvedOnly.length, 1);
  assert.equal(store.listIncidents("all").length, 1);
});

test("openIncident rejects unknown services with a domain error", () => {
  const store = new SqliteOpsStore({ dbPath: ":memory:" });

  assert.throws(
    () =>
      store.openIncident({
        title: "Teste",
        service: "missing-service",
        severity: "high",
      }),
    UnknownServiceError,
  );
});

test("consultar runbook rejects unknown service and unknown runbook explicitly", () => {
  const store = new SqliteOpsStore({ dbPath: ":memory:" });

  assert.throws(() => store.getRunbookByService("missing-service"), UnknownServiceError);
  assert.throws(() => store.getRunbookByService("notifications"), UnknownRunbookError);
  assert.equal(store.getRunbookByService("payments").service, "payments");
});

test("resolveIncidentById rejects missing incidents with a domain error", () => {
  const store = new StoryStore();

  assert.throws(() => store.resolveIncidentById("inc-999"), UnknownIncidentError);
});

test("sqlite schema enforces CHECK constraints for severity and tier", () => {
  const store = new SqliteOpsStore({ dbPath: ":memory:" });
  const db = (store as unknown as { db: DatabaseSync }).db;

  assert.throws(
    () => db.prepare("INSERT INTO services (id, name, tier) VALUES (?, ?, ?)").run("svc-x", "svc-x", "tier9"),
    /CHECK constraint failed/,
  );

  assert.throws(
    () =>
      store.openIncident({
        title: "Incidente inválido",
        service: "payments",
        severity: "invalid" as never,
      }),
    /CHECK constraint failed/,
  );
});

test("fetchProviderStatus returns one-line compact status for github", async () => {
  const fakeFetch: typeof fetch = async (url, init) => {
    assert.equal(url, "https://www.githubstatus.com/api/v2/status.json");
    assert.ok(init?.signal);

    return new Response(
      JSON.stringify({
        status: {
          indicator: "none",
          description: "All Systems Operational",
        },
      }),
      { status: 200 },
    );
  };

  const output = await fetchProviderStatus("github", fakeFetch);
  assert.equal(output, "github está none - All Systems Operational");
  assert.equal(output.includes("\n"), false);
});

test("fetchProviderStatus retries once on network error then succeeds", async () => {
  let attempt = 0;
  const fakeFetch: typeof fetch = async () => {
    attempt += 1;
    if (attempt === 1) {
      throw new Error("fetch failed");
    }
    return new Response(
      JSON.stringify({
        status: {
          indicator: "minor",
          description: "Minor Service Outage",
        },
      }),
      { status: 200 },
    );
  };

  const output = await fetchProviderStatus("cloudflare", fakeFetch);
  assert.equal(output, "cloudflare está minor - Minor Service Outage");
  assert.equal(attempt, 2);
});

test("fetchProviderStatus retries once on upstream 5xx then succeeds", async () => {
  let attempt = 0;
  const fakeFetch: typeof fetch = async () => {
    attempt += 1;
    if (attempt === 1) {
      return new Response("temporary failure", { status: 503 });
    }
    return new Response(
      JSON.stringify({
        status: {
          indicator: "none",
          description: "Operational",
        },
      }),
      { status: 200 },
    );
  };

  const output = await fetchProviderStatus("github", fakeFetch);
  assert.equal(output, "github está none - Operational");
  assert.equal(attempt, 2);
});

test("fetchProviderStatus returns readable timeout error after retry limit", async () => {
  let attempt = 0;
  const fakeFetch: typeof fetch = async () => {
    attempt += 1;
    const error = new Error("timeout");
    error.name = "TimeoutError";
    throw error;
  };

  const output = await fetchProviderStatus("github", fakeFetch);
  assert.match(output, /não consegui consultar o status de github \(timeout\)/);
  assert.equal(attempt, 2);
  assert.equal(output.includes("\n"), false);
});

test("fetchProviderStatus returns readable invalid-response error without retry", async () => {
  let attempt = 0;
  const fakeFetch: typeof fetch = async () => {
    attempt += 1;
    return new Response(JSON.stringify({ status: { indicator: "none" } }), { status: 200 });
  };

  const output = await fetchProviderStatus("github", fakeFetch);
  assert.match(output, /não consegui consultar o status de github/);
  assert.equal(attempt, 1);
});

test("createAgentTools keeps existing tool names and adds new sqlite-backed tools", () => {
  const store = new SqliteOpsStore({ dbPath: ":memory:" });
  const tools = createAgentTools(store);

  assert.equal(tools[0]?.name, "list_alerts");
  assert.equal(tools[1]?.name, "open_incident");
  assert.equal(tools[2]?.name, "resolve_incident");
  assert.equal(tools[3]?.name, "list_incidents");
  assert.equal(tools[4]?.name, "consultar_runbook");
  assert.equal(tools[5]?.name, "check_provider_status");
});

test("both strategies can be bound to the same deterministic story store", () => {
  const store = new StoryStore();
  const react = new ReactReasoningStrategy(store);
  const planAndExecute = new PlanAndExecuteReasoningStrategy(store);

  assert.equal(react.name, "react");
  assert.equal(planAndExecute.name, "plan-and-execute");
  assert.deepEqual(store.snapshot().alerts.length, 6);
});

test("story seed file path points to project json seed", () => {
  const seedPath = getStorySeedPath();
  assert.equal(seedPath.endsWith("src\\agents\\story-seed.json"), true);
});
