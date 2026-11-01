import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { RequestIdCollisionError, RequestNotFoundError, TracePersistenceError } from "../obs/errors.js";
import { requestRecordSchema, traceEventRecordSchema, requestIdSchema,
  type RequestStart, type RequestFinish, type RequestTraceStore, type RequestSnapshot, type TraceEventRecord } from "../obs/types.js";

const columns = {
  requestId: "request_id", conversationId: "conversation_id", userId: "user_id", strategy: "strategy", route: "route",
  reflect: "reflect", status: "status", startedAt: "started_at", finishedAt: "finished_at", latencyMs: "latency_ms",
  llCalls: "ll_calls", historyMessages: "history_messages", memoryHits: "memory_hits", promptTokens: "prompt_tokens",
  modelUsed: "model_used", traceCount: "trace_count", errorCode: "error_code", errorMessage: "error_message",
} as const;
const projection = Object.entries(columns).map(([key, column]) => `${column} AS "${key}"`).join(", ");

export class SqliteRequestTraceStore implements RequestTraceStore {
  private readonly db: DatabaseSync;
  constructor(options?: { dbPath?: string }) {
    const configured = options?.dbPath ?? process.env.OPSPILOT_DB ?? "./data/opspilot.db";
    const dbPath = configured === ":memory:" ? configured : resolve(configured);
    if (dbPath !== ":memory:") mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.db.exec(`
      PRAGMA foreign_keys = ON;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS requests (
        request_id TEXT PRIMARY KEY CHECK(length(trim(request_id)) > 0), conversation_id TEXT, user_id TEXT,
        strategy TEXT NOT NULL, route TEXT NOT NULL, reflect INTEGER NOT NULL CHECK(reflect IN (0,1)),
        status TEXT NOT NULL CHECK(status IN ('running','success','timeout','error')),
        started_at TEXT NOT NULL, finished_at TEXT,
        latency_ms INTEGER CHECK(latency_ms >= 0), ll_calls INTEGER CHECK(ll_calls >= 0),
        history_messages INTEGER CHECK(history_messages >= 0), memory_hits INTEGER CHECK(memory_hits >= 0),
        prompt_tokens INTEGER CHECK(prompt_tokens >= 0), model_used TEXT,
        trace_count INTEGER NOT NULL DEFAULT 0 CHECK(trace_count >= 0), error_code TEXT, error_message TEXT,
        CHECK((status = 'running' AND finished_at IS NULL) OR (status <> 'running' AND finished_at IS NOT NULL))
      );
      CREATE TABLE IF NOT EXISTS trace_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT, request_id TEXT NOT NULL REFERENCES requests(request_id),
        event_index INTEGER NOT NULL CHECK(event_index >= 0), event_type TEXT NOT NULL,
        node TEXT NOT NULL CHECK(length(trim(node)) > 0), content TEXT, payload_json TEXT CHECK(payload_json IS NULL OR json_valid(payload_json)),
        metadata_json TEXT NOT NULL CHECK(json_valid(metadata_json)), created_at TEXT NOT NULL,
        UNIQUE(request_id, event_index)
      );
      CREATE INDEX IF NOT EXISTS idx_requests_started ON requests(started_at);
      CREATE INDEX IF NOT EXISTS idx_trace_events_request ON trace_events(request_id);
    `);
  }
  close(): void { this.db.close(); }
  private transaction<T>(fn: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try { const value = fn(); this.db.exec("COMMIT"); return value; }
    catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }
  private readRequest(requestId: string) {
    const row = this.db.prepare(`SELECT ${projection} FROM requests WHERE request_id = ?`).get(requestId);
    return row ? requestRecordSchema.parse({ ...row, reflect: row.reflect === 1 }) : null;
  }
  create(input: RequestStart): void {
    const record = requestRecordSchema.parse({ ...input, status: "running", finishedAt: null, latencyMs: null,
      llCalls: null, historyMessages: null, memoryHits: null, promptTokens: null, modelUsed: null, traceCount: 0, errorCode: null, errorMessage: null });
    try {
      this.transaction(() => {
        if (this.readRequest(record.requestId)) throw new RequestIdCollisionError();
        const keys = Object.keys(columns) as (keyof typeof columns)[];
        this.db.prepare(`INSERT INTO requests (${keys.map((key) => columns[key]).join(",")}) VALUES (${keys.map(() => "?").join(",")})`)
          .run(...keys.map((key): SQLInputValue => typeof record[key] === "boolean" ? Number(record[key]) : record[key]));
      });
    } catch (error) { if (error instanceof RequestIdCollisionError) throw error; throw new TracePersistenceError({ cause: error }); }
  }
  append(input: TraceEventRecord): boolean {
    const event = traceEventRecordSchema.parse(input);
    try {
      return this.transaction(() => {
        const request = this.readRequest(event.requestId);
        if (!request) throw new RequestNotFoundError();
        if (request.status !== "running") return false;
        this.db.prepare(`INSERT INTO trace_events (request_id,event_index,event_type,node,content,payload_json,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?)`)
          .run(event.requestId, event.eventIndex, event.eventType, event.node, event.content, event.payloadJson, event.metadataJson, event.createdAt);
        this.db.prepare("UPDATE requests SET trace_count = trace_count + 1 WHERE request_id = ?").run(event.requestId);
        return true;
      });
    } catch (error) { throw new TracePersistenceError({ cause: error }); }
  }
  finish(requestId: string, input: RequestFinish): boolean {
    requestId = requestIdSchema.parse(requestId);
    try {
      return this.transaction(() => {
        const request = this.readRequest(requestId);
        if (!request) throw new RequestNotFoundError();
        if (request.status !== "running") return false;
        const record = requestRecordSchema.parse({ ...request, ...input });
        const keys = Object.keys(columns).filter((key) => key !== "requestId") as Exclude<keyof typeof columns, "requestId">[];
        this.db.prepare(`UPDATE requests SET ${keys.map((key) => `${columns[key]} = ?`).join(",")} WHERE request_id = ?`)
          .run(...keys.map((key): SQLInputValue => typeof record[key] === "boolean" ? Number(record[key]) : record[key]), requestId);
        return true;
      });
    } catch (error) { throw new TracePersistenceError({ cause: error }); }
  }
  get(requestId: string): RequestSnapshot | null {
    requestId = requestIdSchema.parse(requestId);
    try {
      // One transaction keeps metrics, count and events in the same snapshot.
      return this.transaction(() => {
        const request = this.readRequest(requestId);
        if (!request) return null;
        const trace = this.db.prepare(`SELECT id,request_id AS requestId,event_index AS eventIndex,event_type AS eventType,
          node,content,payload_json AS payloadJson,metadata_json AS metadataJson,created_at AS createdAt
          FROM trace_events WHERE request_id = ? ORDER BY event_index ASC`).all(requestId).map((row) => traceEventRecordSchema.parse(row));
        return { request, trace };
      });
    } catch (error) { throw new TracePersistenceError({ cause: error }); }
  }
}
