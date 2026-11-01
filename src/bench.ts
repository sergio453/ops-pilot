import { pathToFileURL } from "node:url";

import { z } from "zod";

import { PlanAndExecuteReasoningStrategy } from "./agents/plan-and-execute.js";
import { ReactReasoningStrategy } from "./agents/react.js";
import { StoryStore } from "./agents/tools.js";
import type { ReasoningResult, ReasoningStrategy } from "./agents/types.js";
import type { StoryData } from "./agents/tools.js";

type ScenarioKey = "c1" | "c2" | "c3";
type StrategyKey = "react" | "plan-and-execute";

interface BenchScenario {
  key: ScenarioKey;
  label: string;
  prompt: string;
  initialData: StoryData;
  verify: (store: StoryStore) => boolean;
}

interface BenchRow {
  cenario: string;
  estrategia: StrategyKey;
  acerto: "SIM" | "NAO";
  llmCalls: number;
  latencyMs: number;
}

const benchArgsSchema = z.object({
  scenario: z.array(z.enum(["c1", "c2", "c3"])).default(["c1", "c2", "c3"]),
  noReplanner: z.boolean().default(false),
  maxIterations: z.number().int().positive().default(8),
});

function createScenarioData(services: string[], alerts: Array<{ id: string; service: string; severity: "critical" | "high" | "medium" | "low" }>): StoryData {
  return {
    services: services.map((service) => ({ id: service, name: service, tier: "tier1" })),
    alerts: alerts.map((alert) => ({
      ...alert,
      title: `Alert ${alert.id}`,
      status: "firing",
    })),
    incidents: [],
    runbooks: [],
    nextIncidentId: 1,
  };
}

function c1Scenario(): BenchScenario {
  const initialData = createScenarioData(
    ["checkout", "payments", "catalog"],
    [
      { id: "alert-001", service: "payments", severity: "critical" },
      { id: "alert-002", service: "checkout", severity: "critical" },
      { id: "alert-003", service: "catalog", severity: "high" },
    ],
  );

  return {
    key: "c1",
    label: "C1 direto",
    prompt: "Quantos alertas críticos estão disparando?",
    initialData,
    verify: (store) => store.snapshot().incidents.length === 0,
  };
}

function c2Scenario(): BenchScenario {
  const initialData = createScenarioData(
    ["checkout", "payment", "catalog", "auth"],
    [
      { id: "alert-001", service: "checkout", severity: "high" },
      { id: "alert-002", service: "payment", severity: "high" },
      { id: "alert-003", service: "catalog", severity: "high" },
      { id: "alert-004", service: "auth", severity: "medium" },
    ],
  );

  return {
    key: "c2",
    label: "C2 estruturado",
    prompt:
      "Abra 3 incidentes sev2 para checkout, payment e catalog, nesta mesma ordem, e resolva o primeiro.",
    initialData,
    verify: (store) => {
      const incidents = store.snapshot().incidents;
      if (incidents.length !== 3) {
        return false;
      }

      const expectedServices = ["checkout", "payment", "catalog"];
      for (let index = 0; index < expectedServices.length; index += 1) {
        if (incidents[index]?.service !== expectedServices[index]) {
          return false;
        }
      }

      return incidents[0]?.status === "resolved"
        && incidents[1]?.status === "open"
        && incidents[2]?.status === "open";
    },
  };
}

function c3Scenario(): BenchScenario {
  const initialData = createScenarioData(
    ["checkout", "catalog"],
    [
      { id: "alert-001", service: "checkout", severity: "high" },
      { id: "alert-002", service: "catalog", severity: "medium" },
    ],
  );

  return {
    key: "c3",
    label: "C3 dinâmico",
    prompt:
      "Há dois alertas disparando. Abra um incidente para o mais antigo e diga quanto sobraram.",
    initialData,
    verify: (store) => {
      const snapshot = store.snapshot();
      return snapshot.incidents.length === 1
        && snapshot.incidents[0]?.service === "checkout"
        && snapshot.incidents[0]?.status === "open";
    },
  };
}

const scenarioRegistry: Record<ScenarioKey, () => BenchScenario> = {
  c1: c1Scenario,
  c2: c2Scenario,
  c3: c3Scenario,
};

function parseArgs(argv: string[]) {
  const parsedInput = {
    scenario: ["c1", "c2", "c3"] as ScenarioKey[],
    noReplanner: false,
    maxIterations: 8,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--scenario") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("Missing value for --scenario");
      }

      parsedInput.scenario = value
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter((item): item is ScenarioKey => item === "c1" || item === "c2" || item === "c3");

      index += 1;
      continue;
    }

    if (arg === "--no-replanner") {
      parsedInput.noReplanner = true;
      continue;
    }

    if (arg === "--max-iterations") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("Missing value for --max-iterations");
      }
      parsedInput.maxIterations = Number(value);
      index += 1;
      continue;
    }
  }

  return benchArgsSchema.parse(parsedInput);
}

function createStrategies(store: StoryStore, noReplanner: boolean): Record<StrategyKey, ReasoningStrategy> {
  return {
    react: new ReactReasoningStrategy(store),
    "plan-and-execute": new PlanAndExecuteReasoningStrategy(store, {
      replannerEnabled: !noReplanner,
    }),
  };
}

async function runCase(
  scenario: BenchScenario,
  strategyKey: StrategyKey,
  noReplanner: boolean,
  maxIterations: number,
): Promise<BenchRow> {
  const store = new StoryStore(scenario.initialData);
  const strategy = createStrategies(store, noReplanner)[strategyKey];

  let result: ReasoningResult;
  try {
    result = await strategy.run({
      prompt: scenario.prompt,
      maxIterations,
    });
  } catch {
    return {
      cenario: scenario.label,
      estrategia: strategyKey,
      acerto: "NAO",
      llmCalls: 0,
      latencyMs: 0,
    };
  }

  const acerto = scenario.verify(store) ? "SIM" : "NAO";
  return {
    cenario: scenario.label,
    estrategia: strategyKey,
    acerto,
    llmCalls: result.metrics.llCalls,
    latencyMs: result.metrics.latencyMs,
  };
}

function printTable(rows: BenchRow[]): void {
  console.log("| cenário | estratégia | acerto | llmCalls | latencyMs |");
  console.log("|---|---|---|---:|---:|");
  for (const row of rows) {
    console.log(
      `| ${row.cenario} | ${row.estrategia} | ${row.acerto} | ${row.llmCalls} | ${row.latencyMs} |`,
    );
  }
}

export async function runBench(argv: string[] = process.argv.slice(2)): Promise<void> {
  const args = parseArgs(argv);
  const scenarios = args.scenario.map((key) => scenarioRegistry[key]());
  const strategies: StrategyKey[] = ["react", "plan-and-execute"];
  const rows: BenchRow[] = [];

  for (const scenario of scenarios) {
    for (const strategy of strategies) {
      const row = await runCase(scenario, strategy, args.noReplanner, args.maxIterations);
      rows.push(row);
    }
  }

  printTable(rows);
}

const isMainModule = process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isMainModule) {
  runBench().catch((error: unknown) => {
    console.error("Bench execution failed:", error);
    process.exitCode = 1;
  });
}
