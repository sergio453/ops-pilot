import { pathToFileURL } from "node:url";

import { z } from "zod";

import { PlanAndExecuteReasoningStrategy } from "./agents/plan-and-execute.js";
import { withReflection } from "./agents/reflection.js";
import { ReactReasoningStrategy } from "./agents/react.js";
import { formatTrace } from "./agents/trace.js";
import type { ReasoningInput, ReasoningStrategy } from "./agents/types.js";

const arenaArgsSchema = z.object({
  prompt: z.string().min(1),
  strategyNames: z.array(z.string().min(1)).min(1, "At least one strategy is required"),
  maxIterations: z.number().int().positive(),
});

export function parseArgs(argv: string[]) {
  const positionalPromptParts: string[] = [];
  let hasExplicitInput = false;

  const input: {
    prompt: string;
    strategyNames: string[];
    maxIterations: number;
  } = {
    prompt: "Quais alertas firing devemos tratar primeiro?",
    strategyNames: ["react", "plan-and-execute"],
    maxIterations: 6,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--strategies") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("Missing value for --strategies");
      }
      input.strategyNames = value.split(",").map((item) => item.trim()).filter(Boolean);
      index += 1;
      continue;
    }

    if (arg === "--max-iterations") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("Missing value for --max-iterations");
      }
      input.maxIterations = Number(value);
      index += 1;
      continue;
    }

    if (arg === "--input") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("Missing value for --input");
      }
      hasExplicitInput = true;
      input.prompt = value;
      index += 1;
      continue;
    }

    // Backward-compatible UX: support prompt as positional args.
    if (!arg.startsWith("--")) {
      positionalPromptParts.push(arg);
      continue;
    }
  }

  if (!hasExplicitInput && positionalPromptParts.length > 0) {
    input.prompt = positionalPromptParts.join(" ").trim();
  }

  return arenaArgsSchema.parse(input);
}

export function createStrategyRegistry(): Record<string, () => ReasoningStrategy> {
  return {
    react: () => new ReactReasoningStrategy(),
    "plan-and-execute": () => new PlanAndExecuteReasoningStrategy(),
    "reflect:react": () =>
      withReflection(new ReactReasoningStrategy(), {
        name: "reflect:react",
      }),
    "reflect:plan-and-execute": () =>
      withReflection(new PlanAndExecuteReasoningStrategy(), {
        name: "reflect:plan-and-execute",
      }),
  };
}

export async function runArena(argv: string[] = process.argv.slice(2)): Promise<void> {
  const args = parseArgs(argv);
  const registry = createStrategyRegistry();

  const strategies = args.strategyNames.map((strategyName: string) => {
    const factory = registry[strategyName];
    if (!factory) {
      throw new Error(`Unknown strategy "${strategyName}"`);
    }
    return factory();
  });

  const strategyInput: ReasoningInput = {
    prompt: args.prompt,
    maxIterations: args.maxIterations,
  };

  console.log("== OpsPilot Arena ==");
  console.log(`Input: ${strategyInput.prompt}`);
  console.log(`Max iterations: ${strategyInput.maxIterations}`);
  console.log(
    `Strategies: ${strategies.map((strategy: ReasoningStrategy) => strategy.name).join(", ")}`,
  );
  console.log("");

  for (const strategy of strategies) {
    const result = await strategy.run(strategyInput);
    console.log(`--- Strategy: ${strategy.name} ---`);
    console.log(`Answer: ${result.answer}`);
    console.log("Trace:");
    console.log(formatTrace(result.trace));
    console.log(
      `Metrics: llCalls=${result.metrics.llCalls} latencyMs=${result.metrics.latencyMs}`,
    );
    console.log("");
  }
}

const isMainModule = process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isMainModule) {
  runArena().catch((error: unknown) => {
    console.error("Arena execution failed:", error);
    process.exitCode = 1;
  });
}
