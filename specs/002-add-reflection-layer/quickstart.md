# Quickstart: Add Reflection Layer

## Prerequisites

- Node.js 22 LTS
- Dependencies installed with `npm install`
- OpenRouter environment configured (`OPENROUTER_API_KEY`, `OPENROUTER_MODEL`) for live arena runs

## 1) Validate baseline quality gates

```bash
npm test
npm run typecheck
```

**Expected outcome**: All tests pass and typecheck finishes with zero errors.

## 2) Run standard arena modes (control group)

```bash
npm run arena -- --input "Quais alertas firing devemos tratar primeiro?" --strategies react,plan-and-execute --max-iterations 6
```

**Expected outcome**:

- Both strategies execute successfully.
- Output contains answer, trace, and metrics blocks for each strategy.

## 3) Run reflective arena presets

```bash
npm run arena -- --input "Quais alertas firing devemos tratar primeiro?" --strategies reflect:react,reflect:plan-and-execute --max-iterations 6
```

**Expected outcome**:

- Both reflective presets execute successfully.
- Trace includes `critique` events.
- Metrics reflect additional calls from critique/regeneration when retries happen.

## 4) Validate reflection unit behavior

```bash
npm test -- src/agents/reflection.test.ts
```

**Expected outcome**:

- Tests cover approval-on-first-pass, rejection with regeneration, retry-limit termination, `maxReflections=0`, and malformed critique payload handling.

## 5) Validate retry-bound behavior

Run a scenario that triggers at least one critique rejection and verify:

- Regeneration uses critique feedback before next critique pass.
- Loop stops when approved or when max retry limit is reached.
- Final answer is always returned.

## 6) Validate contract conformance

- Confirm reflective strategy names and output expectations in [contracts/reflection-arena.md](./contracts/reflection-arena.md).
- Confirm entity/state rules in [data-model.md](./data-model.md).
