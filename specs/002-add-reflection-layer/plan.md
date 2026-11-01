# Implementation Plan: Add Reflection Layer

**Branch**: `master` | **Date**: 2026-09-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/002-add-reflection-layer/spec.md`

## Summary

Add a reusable reflection decorator (`withReflection`) that wraps any reasoning strategy and introduces a critique-regenerate loop. The wrapper must preserve the existing strategy contract while adding `critique` trace events, bounded retries (`maxReflections`, default 2), and aggregated metrics that include all additional calls. Arena must expose reflective presets for both existing strategies.

## Technical Context

- **Language/Version**: TypeScript ESM on Node.js 22 LTS
- **Primary Dependencies**: LangChain/LangGraph, OpenRouter Chat model client, zod
- **Storage**: In-memory story seed/state only (no new persistence)
- **Testing**: `node --test` via `tsx` (`npm test`) and `npm run typecheck`
- **Target Platform**: Node.js CLI runtime (local and CI)
- **Project Type**: Single-package TypeScript backend/CLI project
- **Performance Goals**: Reflection adds bounded extra calls but must always terminate within configured limits and return a final answer
- **Constraints**: Strict typing, boundary validation with zod, explicit errors (no silent fallback), deterministic trace/metrics shape for tests
- **Scale/Scope**: Two existing strategies (`react`, `plan-and-execute`) plus two reflective arena presets in this feature

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Phase 0 Gate

- **I. Type-safe architecture and boundary validation**: Pass — reflection options and critique output contract will be explicitly typed and validated.
- **II. MVC structure and responsibility separation**: Pass — work is contained in agent/reasoning orchestration layer, without leaking concerns across boundaries.
- **III. Pure logic and explicit error handling**: Pass — loop logic is deterministic and explicit errors are required for invalid critique output.
- **IV. Test-first quality gates**: Pass — plan includes unit and integration validation scenarios for loop behavior and arena presets.
- **V. Secure and operationally safe development**: Pass — no secrets handling changes; feature remains within existing runtime config model.

### Post-Phase 1 Re-check

- **I. Type-safe architecture and boundary validation**: Pass — data model and contract define validated critique result and reflection options.
- **II. MVC structure and responsibility separation**: Pass — design keeps reflection as strategy decorator, avoiding controller/model coupling.
- **III. Pure logic and explicit error handling**: Pass — state transitions and error paths are explicitly modeled.
- **IV. Test-first quality gates**: Pass — quickstart includes verifiable scenarios for tests/typecheck and reflective arena runs.
- **V. Secure and operationally safe development**: Pass — no new sensitive-data paths or unsafe defaults introduced.

## Project Structure

### Documentation (this feature)

```text
specs/002-add-reflection-layer/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    └── reflection-arena.md
```

### Source Code (repository root)

```text
src/
├── agents/
│   ├── model.ts
│   ├── plan-and-execute.ts
│   ├── react.ts
│   ├── trace.ts
│   ├── tools.ts
│   └── types.ts
├── arena.ts
├── arena.test.ts
├── bench.ts
└── index.ts
```

**Structure Decision**: Keep a single-package layout and implement reflection as an agent-layer decorator in `src/agents`, then wire preset selection in `src/arena.ts` without changing CLI entrypoint structure.

## Phase Plan

### Phase 0 - Research

- Define critique output contract and validation behavior for malformed responses.
- Define retry/termination semantics for approval and max retry boundaries.
- Define strategy registry/preset composition approach for reflective arena modes.
- Define metrics aggregation behavior so reflective calls are included consistently.

### Phase 1 - Design & Contracts

- Model reflection-specific entities and state transitions (`data-model.md`).
- Define CLI-level contract additions for reflective arena presets (`contracts/reflection-arena.md`).
- Document runnable validation scenarios for reflection behavior (`quickstart.md`).

## Complexity Tracking

No constitution exceptions are required for this feature.
