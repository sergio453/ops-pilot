import { z } from "zod";

import { InvalidCritiqueResultError } from "./errors.js";
import { createStructuredModel } from "./model.js";
import { createTraceEmitter } from "./trace.js";
import type {
  CritiqueVerdict,
  ReasoningInput,
  ReasoningResult,
  ReasoningStrategy,
  ReflectionOptions,
  TraceEvent,
} from "./types.js";

const reflectionOptionsSchema = z.object({
  maxReflections: z.number().int().min(0).optional(),
  name: z.string().min(1).optional(),
});

const verdictSchema = z.object({
  approved: z.boolean(),
  feedback: z.string().min(1).describe("se reprovado: o que corrigir, em específico e acionável"),
});

const CRITIC_PROMPT =
  "Avalie APENAS contra as observações do trace e do pedido. " +
  "Aprove apenas quando a resposta estiver aderente e acionável.";

function observationsOf(trace: TraceEvent[]): string {
  const observations = trace
    .filter((event) => event.type === "observation")
    .map((event, index) => `${index + 1}. ${event.content.trim()}`)
    .filter((content) => content.length > 0);

  if (observations.length === 0) {
    return "Sem observações registradas no trace.";
  }

  return observations.join("\n");
}

function critiqueEventContent(verdict: CritiqueVerdict): string {
  return `approved=${verdict.approved}; feedback=${verdict.feedback}`;
}

function createRetryPrompt(
  originalInput: string,
  latestResult: ReasoningResult,
  feedback: string,
  retryCount: number,
): string {
  return [
    `Pedido original: ${originalInput}`,
    `Resposta anterior: ${latestResult.answer}`,
    `Observações do trace:`,
    observationsOf(latestResult.trace),
    `Feedback do crítico (tentativa ${retryCount}): ${feedback}`,
    "Regere uma nova resposta final incorporando o feedback e mantendo objetividade operacional.",
  ].join("\n\n");
}

async function critique(input: string, result: ReasoningResult): Promise<unknown> {
  return createStructuredModel(verdictSchema).invoke([
    ["system", CRITIC_PROMPT],
    [
      "user",
      `Pedido: ${input}\nObservações: ${observationsOf(result.trace)}\nResposta: ${result.answer}`,
    ],
  ]);
}

type CritiqueFunction = (input: string, result: ReasoningResult) => Promise<unknown>;

function parseVerdict(rawVerdict: unknown): CritiqueVerdict {
  const parsedVerdict = verdictSchema.safeParse(rawVerdict);
  if (!parsedVerdict.success) {
    const details = parsedVerdict.error.issues
      .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
      .join("; ");
    throw new InvalidCritiqueResultError(details);
  }
  return parsedVerdict.data;
}

export function withReflection(
  strategy: ReasoningStrategy,
  opts: ReflectionOptions & { critique?: CritiqueFunction } = {},
): ReasoningStrategy {
  const parsedOptions = reflectionOptionsSchema.parse(opts);
  const maxReflections = parsedOptions.maxReflections ?? 2;
  const critiqueFn = opts.critique ?? critique;

  return {
    name: parsedOptions.name ?? `reflect:${strategy.name}`,
    async run(input: ReasoningInput): Promise<ReasoningResult> {
      const emitter = createTraceEmitter(input);
      const runBase = async (current: ReasoningInput) => {
        const attempt = createTraceEmitter(input);
        const result = await strategy.run({ ...current, onTrace: (event) => { attempt.publish([event], strategy.name); } });
        attempt.publish(result.trace, strategy.name);
        return result;
      };
      let reflectionsUsed = 0;
      let currentInput: ReasoningInput = { ...input };
      let latestResult = await runBase(currentInput);
      const aggregateTrace: TraceEvent[] = [...latestResult.trace];
      let aggregateLlCalls = latestResult.metrics.llCalls;
      let aggregateLatencyMs = latestResult.metrics.latencyMs;

      while (true) {
        const critiqueStart = Date.now();
        const rawVerdict = await critiqueFn(input.prompt, latestResult);
        const critiqueLatencyMs = Date.now() - critiqueStart;
        const verdict = parseVerdict(rawVerdict);

        aggregateLlCalls += 1;
        aggregateLatencyMs += critiqueLatencyMs;
        const critiqueEvent: TraceEvent = {
          type: "critique",
          content: critiqueEventContent(verdict),
          node: "reflector",
        };
        emitter.publish([critiqueEvent], "reflector");
        aggregateTrace.push(critiqueEvent);

        if (verdict.approved) {
          break;
        }

        if (reflectionsUsed >= maxReflections) {
          break;
        }

        reflectionsUsed += 1;
        currentInput = {
          ...input,
          prompt: createRetryPrompt(input.prompt, latestResult, verdict.feedback, reflectionsUsed),
        };
        latestResult = await runBase(currentInput);
        aggregateTrace.push(...latestResult.trace);
        aggregateLlCalls += latestResult.metrics.llCalls;
        aggregateLatencyMs += latestResult.metrics.latencyMs;
      }

      return {
        answer: latestResult.answer,
        trace: aggregateTrace,
        metrics: {
          llCalls: aggregateLlCalls,
          latencyMs: aggregateLatencyMs,
          modelUsed: latestResult.metrics.modelUsed,
          promptTokens: latestResult.metrics.promptTokens,
        },
      };
    },
  };
}
