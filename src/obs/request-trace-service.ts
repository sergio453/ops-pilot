import { randomUUID } from "node:crypto";
import type { TraceEvent } from "../agents/types.js";
import { RequestIdCollisionError, RequestNotFoundError, TracePersistenceError } from "./errors.js";
import { historicalResponseSchema, type RequestTraceStore, type RequestStart, type RequestFinish } from "./types.js";
import type { Logger } from "./logger.js";

export class RequestTraceService {
  constructor(private readonly store: RequestTraceStore, private readonly logger: Logger, private readonly nextId: () => string = randomUUID) {}
  start(input: RequestStart) {
    const route = input.route;
    let requestId = input.requestId;
    for (let attempt = 0; ; attempt++) {
      try { this.store.create({ ...input, requestId }); break; }
      catch (error) {
        if (!(error instanceof RequestIdCollisionError) || attempt >= 3) throw error;
        requestId = this.nextId();
      }
    }
    let eventIndex = 0;
    let closed = false;
    let failure: unknown;
    return {
      requestId,
      get eventCount() { return eventIndex; },
      assertHealthy() { if (failure) throw failure; },
      append: (event: TraceEvent) => {
        if (closed) return;
        if (failure) throw failure;
        try {
          const timestamp = new Date().toISOString();
          const payloadJson = JSON.stringify(event);
          const node = event.node ?? input.strategy;
          const metadata = { timestamp, requestId, eventIndex, eventType: event.type, node, status: "running" as const, payloadSize: Buffer.byteLength(payloadJson) };
          if (this.store.append({ requestId, eventIndex, eventType: event.type, node, content: event.content ?? null,
            payloadJson, metadataJson: JSON.stringify(metadata), createdAt: timestamp })) {
            eventIndex++;
            this.logger.info(metadata);
          }
        } catch (error) { failure = new TracePersistenceError({ cause: error }); throw failure; }
      },
      finish: (input: RequestFinish) => {
        if (closed) return false;
        closed = true;
        const saved = this.store.finish(requestId, input);
        if (saved) this.logger.info({ timestamp: new Date().toISOString(), requestId, eventIndex,
          eventType: "done", node: "resposta", status: input.status, route, tokens: input.promptTokens ?? undefined });
        return saved;
      },
    };
  }
  get(requestId: string) {
    const snapshot = this.store.get(requestId);
    if (!snapshot) throw new RequestNotFoundError();
    const { llCalls, latencyMs, historyMessages, memoryHits, promptTokens, modelUsed, ...request } = snapshot.request;
    return historicalResponseSchema.parse({ request: { ...request, metrics: { llCalls, latencyMs, historyMessages, memoryHits, promptTokens, modelUsed } },
      trace: snapshot.trace.map((event) => ({ eventIndex: event.eventIndex, eventType: event.eventType, node: event.node,
        metadata: JSON.parse(event.metadataJson), payload: event.payloadJson === null ? null : JSON.parse(event.payloadJson) })) });
  }
}
