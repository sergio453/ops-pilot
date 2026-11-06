import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";

import express, { type Request, type Response, type NextFunction } from "express";
import { z } from "zod";

import { createStrategyRegistry } from "../arena.js";
import { withReflection } from "../agents/reflection.js";
import type { ReasoningStrategy } from "../agents/types.js";
import { SqliteMemoryStore, type MemoryRecord, type MemoryStore } from "../memory/memory-store.js";
import {
  SqliteConversationStore,
  type ConversationMessage,
  type ConversationStore,
  defaultRecentMessagesLimit,
} from "../store/sqlite-conversation-store.js";
import { buildContext } from "../context/builder.js";
import { SqliteRequestTraceStore } from "../store/sqlite-request-trace-store.js";
import { RequestTraceService } from "../obs/request-trace-service.js";
import { createLogger, type Logger } from "../obs/logger.js";
import { RequestNotFoundError, TracePersistenceError } from "../obs/errors.js";
import { requestIdSchema, type RequestTraceStore } from "../obs/types.js";
import { createTraceEmitter } from "../agents/trace.js";
import {
  type ConversationSummarizer,
  LlmConversationSummarizer,
  maybeSummarizeConversation,
} from "../conversation/summarizer.js";

const requestSchema = z
  .object({
    message: z.string().trim().min(1),
    strategy: z.string().trim().min(1).default("react"),
    reflect: z.boolean().optional().default(false),
    maxIterations: z.number().int().positive().max(32).optional().default(6),
    conversationId: z.string().trim().min(1).optional(),
    userId: z.string().trim().min(1).optional(),
  })
  .strict();

class TimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Request timed out after ${timeoutMs}ms`);
    this.name = "TimeoutError";
  }
}

function safeErrorDetails(error: unknown) {
  if (!(error instanceof Error)) {
    return { name: typeof error };
  }

  const details: { name: string; code?: string; status?: number; causeName?: string } = {
    name: error.name,
  };
  if ("code" in error && typeof error.code === "string") details.code = error.code;
  if ("status" in error && typeof error.status === "number") details.status = error.status;
  if ("cause" in error && error.cause instanceof Error) details.causeName = error.cause.name;
  return details;
}

type StrategyFactory = () => ReasoningStrategy;
type StrategyRegistry = Record<string, StrategyFactory>;

export interface ServerOptions {
  createRequestTraceStore?: () => RequestTraceStore;
  logger?: Logger;
  timeoutMs?: number;
  createRegistry?: () => StrategyRegistry;
  createConversationStore?: () => ConversationStore;
  createMemoryStore?: () => MemoryStore;
  createSummarizer?: () => ConversationSummarizer;
  eventEmitter?: EventEmitter;
}

function resolveStrategy(
  strategyName: string,
  reflect: boolean,
  registry: StrategyRegistry,
): ReasoningStrategy | null {
  const factory = registry[strategyName];
  if (!factory) {
    return null;
  }

  if (!reflect || strategyName.startsWith("reflect:")) {
    return factory();
  }

  const reflectiveName = `reflect:${strategyName}`;
  const reflectiveFactory = registry[reflectiveName];
  if (reflectiveFactory) {
    return reflectiveFactory();
  }

  return withReflection(factory(), { name: reflectiveName });
}

export function createApp(options?: ServerOptions) {
  const app = express();
  const timeoutMs = options?.timeoutMs ?? 60_000;
  const buildRegistry = options?.createRegistry ?? createStrategyRegistry;
  const conversationStore = options?.createConversationStore?.() ?? new SqliteConversationStore();
  const memoryStore = options?.createMemoryStore?.() ?? new SqliteMemoryStore();
  const summarizer = options?.createSummarizer?.() ?? new LlmConversationSummarizer();
  const eventEmitter = options?.eventEmitter;
  const traceService = new RequestTraceService(options?.createRequestTraceStore?.() ?? new SqliteRequestTraceStore(), options?.logger ?? createLogger());

  // Establish correlation before the JSON parser, including malformed JSON errors.
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method === "POST" && req.path.replace(/\/+$/, "").toLowerCase() === "/chat") {
      res.locals.requestId = randomUUID();
      res.setHeader("X-Request_Id", res.locals.requestId);
      const json = res.json.bind(res);
      res.json = (body: unknown) => json(z.object({ requestId: requestIdSchema }).passthrough().parse({
        ...(typeof body === "object" && body !== null ? body : {}), requestId: res.locals.requestId,
      }));
    }
    next();
  });

  app.use(express.json());

  app.post("/chat", async (req: Request, res: Response) => {
    let session: ReturnType<RequestTraceService["start"]> | undefined;
    let timeoutHandle: NodeJS.Timeout | undefined;
    const startedAt = Date.now();
    try {
    const parsedBody = requestSchema.safeParse(req.body);
    if (!parsedBody.success) {
      res.status(400).json({
        error: "validation_error",
        issues: parsedBody.error.issues,
      });
      return;
    }

    const body = parsedBody.data;
    const conversationId = body.conversationId ?? randomUUID();
    const strategy = resolveStrategy(body.strategy, body.reflect, buildRegistry());
    if (!strategy) {
      res.status(422).json({ error: "unknown_strategy", strategy: body.strategy });
      return;
    }
    session = traceService.start({ requestId: res.locals.requestId, conversationId, userId: body.userId ?? null,
      strategy: strategy.name, route: body.strategy, reflect: body.reflect, startedAt: new Date(startedAt).toISOString() });
    res.locals.requestId = session.requestId;
    res.setHeader("X-Request_Id", session.requestId);
    conversationStore.create(conversationId);

    // Recupera resumo existente e as mensagens mais recentes
    const existingSummary = conversationStore.summaryOf(conversationId);
    const historyMessages = conversationStore.lastMessages(conversationId, defaultRecentMessagesLimit);
    const memoryContext = body.userId ? await memoryStore.recall(body.userId, body.message, 3) : [];

    // Constrói o contexto com orçamento por seção e breakdown granular
    const context = buildContext({
      conversationId,
      userId: body.userId,
      message: body.message,
      summary: existingSummary,
      history: historyMessages,
      memories: memoryContext,
    });

    const contextBreakdown = {
      memories: context.breakdown.memories,
      history: context.breakdown.history,
      userMessage: context.breakdown.userMessage,
      totalEstimated: context.breakdown.totalEstimated,
    };

      conversationStore.append({
        conversationId,
        role: "user",
        content: body.message,
      });

      if (body.userId) {
        await memoryStore.remember(body.userId, body.message);
      }

      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => reject(new TimeoutError(timeoutMs)), timeoutMs);
      });

      const result = await Promise.race([
        strategy.run({
          prompt: context.prompt,
          maxIterations: body.maxIterations,
          onTrace: session.append,
        }),
        timeoutPromise,
      ]);
      session.assertHealthy();
      // Legacy/custom strategies may return a final trace without streaming.
      if (session.eventCount < result.trace.length) {
        const emitter = createTraceEmitter({ prompt: context.prompt, maxIterations: body.maxIterations, onTrace: session.append });
        emitter.publish(result.trace.slice(session.eventCount), strategy.name);
      }

      conversationStore.append({
        conversationId,
        role: "assistant",
        content: result.answer,
      });

      // Avalia poda e sumarização em lote fora da janela recente
      try {
        await maybeSummarizeConversation(conversationId, {
          conversationStore,
          summarizer,
          eventEmitter,
          recentLimit: defaultRecentMessagesLimit,
        });
      } catch (sumErr) {
        console.error("Falha na sumarização de histórico");
      }

      const responseBody = chatResponseSchema.parse({
        ...result,
        conversationId,
        metrics: {
          ...result.metrics,
          historyMessages: historyMessages.length,
          memoryHits: memoryContext.length,
          contextBreakdown,
        },
      });
      session.finish({ status: "success", finishedAt: new Date().toISOString(),
        llCalls: result.metrics.llCalls, latencyMs: result.metrics.latencyMs,
        promptTokens: result.metrics.promptTokens ?? null, modelUsed: result.metrics.modelUsed ?? null,
        historyMessages: historyMessages.length, memoryHits: memoryContext.length });
      res.status(200).json(responseBody);
    } catch (error: unknown) {
      console.error("Chat request failed", {
        requestId: session?.requestId ?? res.locals.requestId,
        ...safeErrorDetails(error),
      });
      let persistenceFailed = error instanceof TracePersistenceError;
      try {
        session?.finish({ status: error instanceof TimeoutError ? "timeout" : "error", finishedAt: new Date().toISOString(),
          latencyMs: Date.now() - startedAt, errorCode: error instanceof TimeoutError ? "timeout" : "internal_error",
          errorMessage: error instanceof TimeoutError ? "Request timed out" : "Request failed" });
      } catch { persistenceFailed = true; }
      if (persistenceFailed) {
        res.status(500).json({ error: "persistence_error", message: "Unable to persist request trace" });
        return;
      }
      if (error instanceof TimeoutError) {
        res.status(504).json({
          error: "timeout",
          timeoutMs,
        });
        return;
      }

      res.status(500).json({
        error: "internal_error",
        message: "Request failed",
      });
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  });

  app.get("/requests/:id", (req: Request, res: Response) => {
    const parsed = requestIdSchema.safeParse(req.params.id);
    if (!parsed.success) { res.status(400).json({ error: "validation_error" }); return; }
    try { res.json(traceService.get(parsed.data)); }
    catch (error) {
      if (error instanceof RequestNotFoundError) { res.status(404).json({ error: "request_not_found" }); return; }
      res.status(500).json({ error: "internal_error", message: "Unable to read request trace" });
    }
  });
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const badJson = error instanceof SyntaxError && "body" in error;
    res.status(badJson ? 400 : 500).json({ error: badJson ? "validation_error" : "internal_error" });
  });

  return app;
}

const chatResponseSchema = z.object({
  answer: z.string(), conversationId: z.string().min(1),
  trace: z.array(z.object({ type: z.string().min(1), content: z.string(), node: z.string().min(1).optional(),
    action: z.object({ tool: z.string(), args: z.record(z.string(), z.unknown()) }).optional() }).passthrough()),
  metrics: z.object({ llCalls: z.number().int().nonnegative(), latencyMs: z.number().nonnegative(),
    historyMessages: z.number().int().nonnegative(), memoryHits: z.number().int().nonnegative(),
    promptTokens: z.number().int().nonnegative().optional(), modelUsed: z.string().optional(),
    contextBreakdown: z.object({ memories: z.number().nonnegative(), history: z.number().nonnegative(), userMessage: z.number().nonnegative(), totalEstimated: z.number().nonnegative() }),
  }).passthrough(),
}).passthrough();

export async function startServer(port = Number(process.env.PORT ?? "3000")) {
  const app = createApp();
  await new Promise<void>((resolve) => {
    app.listen(port, () => resolve());
  });
}

const isMainModule = process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isMainModule) {
  startServer().catch((error: unknown) => {
    console.error("HTTP server failed to start:", error);
    process.exitCode = 1;
  });
}
