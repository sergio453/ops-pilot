import test from "node:test";
import assert from "node:assert/strict";

import { main } from "./index.js";

test("main supports the seed-story shortcut without invoking the LLM", async () => {
  await assert.doesNotReject(async () => {
    await main(["seed-story"]);
  });
});

test("main falls back to the local seeded story when OpenRouter env is missing", async () => {
  const previousApiKey = process.env.OPENROUTER_API_KEY;
  const previousModel = process.env.OPENROUTER_MODEL;

  delete process.env.OPENROUTER_API_KEY;
  delete process.env.OPENROUTER_MODEL;

  try {
    await assert.doesNotReject(async () => {
      await main([]);
    });
  } finally {
    if (previousApiKey !== undefined) {
      process.env.OPENROUTER_API_KEY = previousApiKey;
    }
    if (previousModel !== undefined) {
      process.env.OPENROUTER_MODEL = previousModel;
    }
  }
});
