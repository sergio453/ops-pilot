import { pathToFileURL } from "node:url";

import {
  StoryStore,
  createDefaultStoryData,
  getStorySeedPath,
  writeStorySeedData,
} from "../agents/tools.js";

export function printSeedStory(): void {
  writeStorySeedData(createDefaultStoryData());

  const store = new StoryStore();
  const snapshot = store.snapshot();
  const firing = snapshot.alerts.filter((alert) => alert.status === "firing").length;
  const resolved = snapshot.alerts.filter((alert) => alert.status === "resolved").length;

  console.log("Story seed concluído.");
  console.log(`Arquivo seed: ${getStorySeedPath()}`);
  console.log(`Serviços: ${snapshot.services.length}`);
  console.log(`Alertas: ${snapshot.alerts.length} (firing=${firing}, resolved=${resolved})`);
  console.log(`Incidentes: ${snapshot.incidents.length}`);
}

const isMainModule = process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isMainModule) {
  printSeedStory();
}
