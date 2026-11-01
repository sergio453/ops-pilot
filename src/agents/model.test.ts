import test from "node:test";
import assert from "node:assert/strict";

import { createModel } from "./model.js";

test("createModel accepts legacy OPENROUTER_API-KEY env names", () => {
  const previousEnv = {
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    OPENROUTER_MODEL: process.env.OPENROUTER_MODEL,
    "OPENROUTER_API-KEY": process.env["OPENROUTER_API-KEY"],
  };

  try {
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.OPENROUTER_MODEL;
    process.env["OPENROUTER_API-KEY"] = "test-key";
    process.env["OPENROUTER_MODEL"] = "openrouter/auto";

    const model = createModel();
    assert.ok(model);
  } finally {
    Object.entries(previousEnv).forEach(([key, value]) => {
      if (value === undefined) {
        delete process.env[key];
        return;
      }

      process.env[key] = value;
    });
  }
});
