import { pathToFileURL } from "node:url";

import { hasOpenRouterEnv } from "./agents/model.js";
import { runArena } from "./arena.js";
import { printSeedStory } from "./scripts/seed-story.js";

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  if (argv[0] === "seed-story") {
    printSeedStory();
    return;
  }

  if (!hasOpenRouterEnv()) {
    printSeedStory();
    return;
  }

  await runArena(argv);
}

const isMainModule = process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isMainModule) {
  main().catch((error: unknown) => {
    console.error("OpsPilot dev entry failed:", error);
    process.exitCode = 1;
  });
}
