import { z } from "zod";

export const requestIdSchema = z.string().trim().min(1);
const count = z.number().int().nonnegative();
const date = z.iso.datetime();
const json = z.string().refine((value) => { try { JSON.parse(value); return true; } catch { return false; } }, "Invalid JSON");
export const requestRecordSchema = z.object({
  requestId: requestIdSchema, conversationId: z.string().nullable(), userId: z.string().nullable(),
  strategy: z.string().min(1), route: z.string().min(1), reflect: z.boolean(),
  status: z.enum(["running", "success", "timeout", "error"]), startedAt: date, finishedAt: date.nullable(),
  latencyMs: count.nullable(), llCalls: count.nullable(), historyMessages: count.nullable(), memoryHits: count.nullable(),
  promptTokens: count.nullable(), modelUsed: z.string().nullable(), traceCount: count.default(0),
  errorCode: z.string().nullable(), errorMessage: z.string().nullable(),
}).superRefine((record, ctx) => {
  if ((record.status === "running") !== (record.finishedAt === null)) {
    ctx.addIssue({ code: "custom", path: ["finishedAt"], message: "Only running requests have null finishedAt" });
  }
});
export const traceEventRecordSchema = z.object({
  id: count.optional(), requestId: requestIdSchema, eventIndex: count, eventType: z.string().min(1),
  node: z.string().trim().min(1), content: z.string().nullable(), payloadJson: json.nullable(), metadataJson: json,
  createdAt: date,
});
export const logEventSchema = z.object({
  timestamp: date, requestId: requestIdSchema, eventIndex: count, eventType: z.string().min(1), node: z.string().min(1),
  status: z.enum(["running", "success", "timeout", "error"]).optional(), payloadSize: count.optional(),
  route: z.string().min(1).optional(), tokens: count.optional(),
});
export type RequestRecord = z.infer<typeof requestRecordSchema>;
export type TraceEventRecord = z.infer<typeof traceEventRecordSchema>;
export type LogEventLine = z.infer<typeof logEventSchema>;
export type RequestStart = Pick<RequestRecord, "requestId" | "conversationId" | "userId" | "strategy" | "route" | "reflect" | "startedAt">;
export type RequestFinish = Pick<RequestRecord, "finishedAt"> & { status: "success" | "timeout" | "error" } &
  Partial<Pick<RequestRecord, "latencyMs" | "llCalls" | "historyMessages" | "memoryHits" | "promptTokens" | "modelUsed" | "errorCode" | "errorMessage">>;
export interface RequestSnapshot { request: RequestRecord; trace: TraceEventRecord[] }
export interface RequestTraceStore {
  create(input: RequestStart): void;
  append(input: TraceEventRecord): boolean;
  finish(requestId: string, input: RequestFinish): boolean;
  get(requestId: string): RequestSnapshot | null;
}
export const historicalResponseSchema = z.object({
  request: z.object({
    requestId: requestIdSchema, conversationId: z.string().nullable(), userId: z.string().nullable(), strategy: z.string(), route: z.string(),
    reflect: z.boolean(), status: z.enum(["running", "success", "timeout", "error"]), startedAt: date, finishedAt: date.nullable(),
    traceCount: count, errorCode: z.string().nullable(), errorMessage: z.string().nullable(),
    metrics: z.object({ llCalls: count.nullable(), latencyMs: count.nullable(), historyMessages: count.nullable(), memoryHits: count.nullable(), promptTokens: count.nullable(), modelUsed: z.string().nullable() }),
  }),
  trace: z.array(z.object({ eventIndex: count, eventType: z.string(), node: z.string().min(1), metadata: z.unknown(), payload: z.unknown() })),
});
