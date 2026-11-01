import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { z } from "zod";

import { createModel } from "./model.js";
import { createAgentTools } from "./tools.js";
import type { OpsStore } from "./tools.js";
import type { ReasoningInput, ReasoningResult, ReasoningStrategy, TraceEvent } from "./types.js";
import { SqliteOpsStore } from "../store/sqlite-ops-store.js";
import { createTraceEmitter } from "./trace.js";

const maxPlanSteps = 8;

const plannerPrompt = `
Você é o planner de um agente de incidentes.
Crie um plano curto, ordenado e executável com no máximo 8 passos.
Use apenas passos que o executor possa cumprir com as ferramentas disponíveis.
`;

const replannerPrompt = `
Você é o replanner.
Com base no input original, no plano atual e no que já foi feito:
- decision=continue: manter plano atual
- decision=adjust: ajustar os próximos passos
- decision=end: encerrar com resposta final
Nunca ultrapasse o teto total de 8 passos.
`;

type ReplanDecision = "continue" | "adjust" | "end";

interface DoneStep {
  step: string;
  result: string;
}

interface PlanExecuteState {
  [key: string]: unknown;
  input: string;
  maxIterations: number;
  plan: string[];
  done: DoneStep[];
  answer: string | null;
  nextDecision: ReplanDecision;
  trace: TraceEvent[];
  llCalls: number;
}

const planExecuteState = Annotation.Root<PlanExecuteState>({
  input: Annotation<string>,
  maxIterations: Annotation<number>,
  plan: Annotation<string[]>({
    reducer: (_left: string[], right: string[]) => right,
    default: () => [],
  }),
  done: Annotation<DoneStep[]>({
    reducer: (left: DoneStep[], right: DoneStep[]) => left.concat(right),
    default: () => [],
  }),
  answer: Annotation<string | null>({
    reducer: (_left: string | null, right: string | null) => right,
    default: () => null,
  }),
  nextDecision: Annotation<ReplanDecision>({
    reducer: (_left: ReplanDecision, right: ReplanDecision) => right,
    default: () => "continue",
  }),
  trace: Annotation<TraceEvent[]>({
    reducer: (left: TraceEvent[], right: TraceEvent[]) => left.concat(right),
    default: () => [],
  }),
  llCalls: Annotation<number>({
    reducer: (left: number, right: number) => left + right,
    default: () => 0,
  }),
});

const planSchema = z.object({
  steps: z
    .array(z.string().min(1))
    .max(maxPlanSteps)
    .describe("Passos curtos, ordenados e executáveis com as ferramentas disponíveis"),
});

const replannerSchema = z.object({
  decision: z.enum(["continue", "adjust", "end"]),
  steps: z.array(z.string().min(1)).max(maxPlanSteps).optional(),
  answer: z.string().min(1).optional(),
});

function contentToString(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  return JSON.stringify(content);
}

function toRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export class PlanAndExecuteReasoningStrategy implements ReasoningStrategy {
  public readonly name = "plan-and-execute";
  private readonly store: OpsStore;
  private readonly replannerEnabled: boolean;
  private readonly modelFactory: typeof createModel;

  constructor(store?: OpsStore, options?: { replannerEnabled?: boolean; createModel?: typeof createModel }) {
    this.store = store ?? new SqliteOpsStore();
    this.replannerEnabled = options?.replannerEnabled ?? true;
    this.modelFactory = options?.createModel ?? createModel;
  }

  async run(input: ReasoningInput): Promise<ReasoningResult> {
    if (input.maxIterations <= 0) {
      throw new Error("maxIterations must be greater than zero");
    }

    const startedAt = Date.now();
    const emitter = createTraceEmitter(input);
    const llm = this.modelFactory();
    const tools = createAgentTools(this.store);
    const toolsByName = new Map(tools.map((currentTool) => [currentTool.name, currentTool]));
    const executionLimit = Math.min(input.maxIterations, maxPlanSteps);

    const plannerNode = async (state: PlanExecuteState) => {
      const planner = llm.withStructuredOutput(planSchema);
      const planResult = await planner.invoke([
        new SystemMessage(plannerPrompt),
        new HumanMessage(state.input),
      ]);

      const trimmedPlan = planResult.steps.slice(0, maxPlanSteps);
      return {
        plan: trimmedPlan,
        trace: [
          {
            type: "plan" as const,
            content: `Plano inicial (${trimmedPlan.length} passo(s)): ${trimmedPlan.join(" | ")}`,
          },
        ],
        llCalls: 1,
      };
    };

    const executorNode = async (state: PlanExecuteState) => {
      if (state.plan.length === 0) {
        return { nextDecision: "end" as const };
      }

      if (state.done.length >= executionLimit) {
        const cappedAnswer =
          state.answer ??
          `Execução encerrada por limite de ${executionLimit} passo(s). Restaram ${state.plan.length} passo(s).`;
        return {
          answer: cappedAnswer,
          nextDecision: "end" as const,
          trace: [{ type: "critique" as const, content: `Teto de ${executionLimit} passos atingido.` }],
        };
      }

      const [currentStep, ...remainingPlan] = state.plan;
      const boundModel = llm.bindTools(tools);
      const decision = (await boundModel.invoke([
        new SystemMessage(
          "Execute o passo atual usando ferramentas quando necessário e responda com resumo objetivo.",
        ),
        new HumanMessage(
          `Input original: ${state.input}\n` +
            `Passo atual: ${currentStep}\n` +
            `Passos concluídos: ${state.done.length}\n`,
        ),
      ])) as AIMessage;

      const trace = emitter.collect("executor");
      const thought = contentToString(decision.content);
      if (thought.trim().length > 0) {
        trace.push({ type: "thought", content: thought });
      }

      let resultSummary = thought.trim().length > 0 ? thought : "Passo executado sem resumo textual.";
      for (const toolCall of decision.tool_calls ?? []) {
        const selectedTool = toolsByName.get(toolCall.name);
        if (!selectedTool) {
          throw new Error(`Tool "${toolCall.name}" is not available`);
        }

        trace.push({
          type: "action",
          content: `Chamando ${toolCall.name}`,
          action: {
            tool: toolCall.name,
            args: toRecord(toolCall.args),
          },
        });

        const toolResult = await selectedTool.invoke(toRecord(toolCall.args));
        const observation = contentToString(toolResult);
        resultSummary = observation;
        trace.push({
          type: "observation",
          content: observation,
        });
      }

      const doneEntry: DoneStep = { step: currentStep, result: resultSummary };
      return {
        plan: remainingPlan,
        done: [doneEntry],
        trace,
        llCalls: 1,
      };
    };

    const replannerNode = async (state: PlanExecuteState) => {
      if (!this.replannerEnabled) {
        return {
          nextDecision: "continue" as const,
          plan: state.plan,
          answer: state.answer,
          trace: [{ type: "critique" as const, content: "Replanner desativado para esta execução." }],
          llCalls: 0,
        };
      }

      if (state.done.length >= executionLimit) {
        const answer =
          state.answer ??
          `Execução encerrada no limite de ${executionLimit} passo(s).`;
        return {
          answer,
          nextDecision: "end" as const,
          trace: [{ type: "answer" as const, content: answer }],
        };
      }

      if (state.plan.length === 0) {
        const answer =
          state.answer ??
          state.done.at(-1)?.result ??
          "Execução concluída sem passos restantes.";
        return {
          answer,
          nextDecision: "end" as const,
          trace: [{ type: "answer" as const, content: answer }],
        };
      }

      const replanner = llm.withStructuredOutput(replannerSchema);
      const replanResult = await replanner.invoke([
        new SystemMessage(replannerPrompt),
        new HumanMessage(
          `Input original: ${state.input}\n` +
            `Plano atual: ${state.plan.join(" | ")}\n` +
            `Concluído:\n${state.done.map((item) => `- ${item.step} => ${item.result}`).join("\n")}`,
        ),
      ]);

      const remainingBudget = maxPlanSteps - state.done.length;
      const adjustedSteps = (replanResult.steps ?? state.plan).slice(0, Math.max(remainingBudget, 0));
      const answer = replanResult.answer ?? state.answer;

      const critique =
        replanResult.decision === "adjust"
          ? `Replanner ajustou para ${adjustedSteps.length} passo(s) restante(s).`
          : replanResult.decision === "continue"
            ? `Replanner decidiu seguir com ${adjustedSteps.length} passo(s) restante(s).`
            : "Replanner decidiu encerrar a execução.";

      const trace: TraceEvent[] = [{ type: "critique", content: critique }];
      if (replanResult.decision === "end") {
        const finalAnswer =
          answer ??
          state.done.at(-1)?.result ??
          "Execução encerrada pelo replanner sem resposta explícita.";
        trace.push({ type: "answer", content: finalAnswer });
        return {
          nextDecision: "end" as const,
          answer: finalAnswer,
          trace,
          llCalls: 1,
        };
      }

      return {
        plan: adjustedSteps,
        nextDecision: replanResult.decision,
        answer,
        trace,
        llCalls: 1,
      };
    };

    const observe = (node: string, handler: (state: PlanExecuteState) => Promise<Partial<PlanExecuteState>>) =>
      async (state: PlanExecuteState) => {
        const update = await handler(state);
        emitter.publish(update.trace ?? [], node);
        return update;
      };
    const graph = new StateGraph<PlanExecuteState>(planExecuteState)
      .addNode("planner", observe("planner", plannerNode))
      .addNode("executor", observe("executor", executorNode))
      .addNode("replanner", observe("replanner", replannerNode))
      .addEdge(START, "planner")
      .addEdge("planner", "executor")
      .addEdge("executor", "replanner")
      .addConditionalEdges("replanner", (state: PlanExecuteState) => {
        if (state.nextDecision === "end" || state.done.length >= executionLimit || state.plan.length === 0) {
          return END;
        }
        return "executor";
      })
      .compile();

    const finalState = await graph.invoke({
      input: input.prompt,
      maxIterations: input.maxIterations,
      plan: [],
      done: [],
      answer: null,
      nextDecision: "continue",
      trace: [],
      llCalls: 0,
    });

    const answer =
      finalState.answer ??
      finalState.done.at(-1)?.result ??
      "Execução encerrada sem resposta final explícita.";

    if (finalState.trace.at(-1)?.type !== "answer") {
      const event: TraceEvent = { type: "answer", content: answer, node: "resposta" };
      emitter.publish([event], "resposta");
      finalState.trace.push(event);
    }

    return {
      answer,
      trace: finalState.trace,
      metrics: {
        llCalls: finalState.llCalls,
        latencyMs: Date.now() - startedAt,
        modelUsed: llm.model,
      },
    };
  }
}
