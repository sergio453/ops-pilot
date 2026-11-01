# Implementation Plan: Core Reasoning Engine for OpsPilot

**Branch**: `001-core-reasoning` | **Date**: 2026-09-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `spec.md`

## Summary

Build a unified reasoning core around the existing OpsPilot strategies so the project can run deterministic incident-handling scenarios end to end. Keep the current in-memory story data for v1, harden the strategy and tool boundaries with zod validation and explicit domain errors, and preserve the existing CLI entrypoints while making the reasoning flow reusable for future surfaces.

## Technical Context

- **Language/Version**: TypeScript ESM on Node.js 22 LTS
- **Primary Dependencies**: Express 5, LangChain, LangGraph, OpenRouter ChatOpenAI, zod, Sequelize
- **Storage**: In-memory story store for the feature scope; no new persistence layer in v1
- **Testing**: `node --test` via `tsx`, plus `npm run typecheck`
- **Target Platform**: Node.js CLI/runtime on developer workstations and CI
- **Project Type**: Single-package Node.js web-service/CLI codebase
- **Performance Goals**: Produce a complete reasoning run with trace and metrics in a single invocation; no throughput target yet
- **Constraints**: Strict TypeScript, zod at boundaries, explicit domain errors, no silent fallbacks, keep `npm test` and `npm run typecheck` green
- **Scale/Scope**: Small internal reasoning core with a handful of strategies, tools, and deterministic demo data

## Constitution Check

- **I. Type-safe architecture and boundary validation**: Pass
- **II. MVC structure and responsibility separation**: Pass
- **III. Pure logic and explicit error handling**: Pass
- **IV. Test-first quality gates**: Pass
- **V. Secure and operationally safe development**: Pass

## Project Structure

### Documentation (this feature)

```text
specs/001-core-reasoning/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    └── reasoning-cli.md
```

### Source Code (repository root)

```text
src/
├── agents/
│   ├── errors.ts
│   ├── model.ts
│   ├── plan-and-execute.ts
│   ├── react.ts
│   ├── tools.ts
│   ├── trace.ts
│   └── types.ts
├── arena.ts
├── bench.ts
├── index.ts
└── scripts/
    └── seed-story.ts
```

**Structure Decision**: Keep the repo as a single Node.js package and evolve the existing `src/agents` area into the shared reasoning core, while preserving the current CLI entrypoints in `src/arena.ts`, `src/index.ts`, and `src/scripts/seed-story.ts`.

## Implementation Workstreams

- Consolidate the reasoning strategy contract and shared result shape so both strategies emit the same trace and metrics structure.
- Tighten the story tool layer with schema validation, domain errors, and the corrected incident-resolution tool name.
- Keep the in-memory story store deterministic and reusable for tests, arena runs, and future controllers.
- Add contract, quickstart, and data-model documentation so the reasoning flow is easy to validate end to end.
- Expand or adjust tests around the reasoning core, trace formatting, and story mutations to cover the feature scope.

## Complexity Tracking

No constitution exceptions are required for this feature.
