import test from "node:test";
import assert from "node:assert/strict";

import { createStrategyRegistry, parseArgs } from "./arena.js";

test("parseArgs rejects an empty strategy list", () => {
  assert.throws(() => parseArgs(["--strategies", ",", "--input", "hello"]));
});

test("parseArgs keeps the default strategies and iteration limit", () => {
  const result = parseArgs([]);

  assert.deepEqual(result.strategyNames, ["react", "plan-and-execute"]);
  assert.equal(result.maxIterations, 6);
});

test("createStrategyRegistry exposes the supported reasoning strategies", () => {
  const registry = createStrategyRegistry();

  assert.equal(typeof registry.react, "function");
  assert.equal(typeof registry["plan-and-execute"], "function");
  assert.equal(typeof registry["reflect:react"], "function");
  assert.equal(typeof registry["reflect:plan-and-execute"], "function");
});

test("parseArgs accepts mixed base and reflective strategies", () => {
  const result = parseArgs([
    "--strategies",
    "react,reflect:plan-and-execute",
    "--input",
    "hello",
  ]);

  assert.deepEqual(result.strategyNames, ["react", "reflect:plan-and-execute"]);
});
