---

description: "Task list for Core Reasoning Engine for OpsPilot"
---

# Tasks: Core Reasoning Engine for OpsPilot

**Input**: Design documents from `/specs/001-core-reasoning/`

**Prerequisites**: [plan.md](./plan.md) (required), [spec.md](./spec.md) (required for user stories), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/)

**Tests**: Include focused test tasks because the feature spec requires independently testable user stories and the constitution requires coverage for new behavior.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story the task belongs to (`US1`, `US2`, `US3`)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Align the feature workspace, shared types, and core error surface before story implementation begins

- [X] T001 [P] Establish the shared reasoning domain error module in `src/agents/errors.ts` and wire the exported classes into the existing agent/tool imports
- [X] T002 [P] Normalize the shared reasoning run contract in `src/agents/types.ts` so `ReasoningInput`, `ReasoningResult`, `ReasoningMetrics`, and `TraceEvent` stay consistent across strategies
- [X] T003 [P] Update the CLI entrypoints in `src/arena.ts`, `src/index.ts`, and `src/scripts/seed-story.ts` to use reusable functions for arena execution and story seeding

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared runtime behavior that all user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 [P] Harden tool validation and story mutation boundaries in `src/agents/tools.ts` with zod schemas for alert status, severity, incident creation, and incident resolution
- [X] T005 [P] Correct the incident-resolution tool name and ensure unknown service/incident failures raise explicit domain errors in `src/agents/tools.ts` and `src/agents/errors.ts`
- [X] T006 [P] Make arena argument parsing reject empty strategy selections and keep the default prompt/strategy set in `src/arena.ts`
- [X] T007 [P] Preserve deterministic trace formatting in `src/agents/trace.ts` so answer, plan, critique, observation, and action events render consistently

**Checkpoint**: Shared reasoning infrastructure is ready - user story implementation can now proceed

---

## Phase 3: User Story 1 - Run a reasoning session end to end (Priority: P1) 🎯 MVP

**Goal**: A valid prompt and strategy combination produces a final answer, trace, and metrics block from the CLI

**Independent Test**: Run `npm run arena -- --input "Quais alertas firing devemos tratar primeiro?" --strategies react,plan-and-execute --max-iterations 6` and confirm both strategies print an answer, trace, and metrics

### Tests for User Story 1

- [X] T008 [P] [US1] Add parser and arena contract coverage in `src/arena.test.ts` for default strategy selection, empty strategy rejection, and positive iteration validation
- [X] T009 [P] [US1] Add strategy-result coverage in `src/agents/trace.test.ts` or a dedicated reasoning test file to verify trace ordering and formatted output remain stable

### Implementation for User Story 1

- [X] T010 [US1] Implement the shared arena execution flow in `src/arena.ts` so both `react` and `plan-and-execute` strategies run through the same prompt, iteration limit, and metrics pipeline
- [X] T011 [US1] Ensure `src/agents/react.ts` returns the last non-tool AI message as the answer candidate and emits trace events for thoughts, actions, and observations
- [X] T012 [US1] Ensure `src/agents/plan-and-execute.ts` returns a structured answer, trace, and latency/LLM-call metrics for the plan/execution/replan cycle

**Checkpoint**: User Story 1 is fully functional and independently testable

---

## Phase 4: User Story 2 - Operate on alerts and incidents safely (Priority: P2)

**Goal**: The reasoning core can list alerts, open incidents, and resolve incidents against the deterministic in-memory story

**Independent Test**: Seed the story with `npm run seed:story`, then verify alert counts, incident creation, and incident resolution from `src/agents/tools.test.ts`

### Tests for User Story 2

- [X] T013 [P] [US2] Add story-store coverage in `src/agents/tools.test.ts` for firing/resolved alert counts, incident creation, incident resolution, and unknown-service/incident failures
- [X] T014 [P] [US2] Add tool-name coverage in `src/agents/tools.test.ts` to verify the resolved incident tool is exposed as `resolve_incident`

### Implementation for User Story 2

- [X] T015 [US2] Implement the deterministic alert and incident operations in `src/agents/tools.ts` so `StoryStore` remains reproducible across runs
- [X] T016 [US2] Keep domain validation pure and explicit in `src/agents/tools.ts` by rejecting malformed tool inputs with zod and translating unknown IDs to domain errors

**Checkpoint**: User Story 2 works independently of the arena CLI flow

---

## Phase 5: User Story 3 - Compare reasoning strategies deterministically (Priority: P3)

**Goal**: The arena can execute multiple supported strategies and present comparable results for each

**Independent Test**: Run the arena with `--strategies react,plan-and-execute` and verify each strategy emits its own answer, trace, and metrics block

### Tests for User Story 3

- [X] T017 [P] [US3] Add strategy-registry coverage in `src/arena.test.ts` to verify supported strategy names map to runnable factories
- [X] T018 [P] [US3] Add tool-and-strategy coverage in `src/agents/tools.test.ts` to verify both strategies share the same deterministic story store

### Implementation for User Story 3

- [X] T019 [US3] Keep the strategy registry in `src/arena.ts` limited to the supported `react` and `plan-and-execute` implementations
- [X] T020 [US3] Ensure `src/index.ts` dispatches to the arena flow or story seeding entrypoint without duplicating strategy logic

**Checkpoint**: The reasoning engine supports multiple strategies with consistent results

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, verification, and consistency updates that affect the whole feature

- [X] T021 [P] Update `specs/001-core-reasoning/quickstart.md` so it matches the finalized CLI behavior and verification commands
- [X] T022 [P] Update `specs/001-core-reasoning/contracts/reasoning-cli.md` to reflect the final `arena` and `seed:story` command contract
- [X] T023 [P] Reconcile `specs/001-core-reasoning/data-model.md` and `specs/001-core-reasoning/research.md` with the implemented reasoning core and story-tool boundaries
- [X] T024 Run `npm test`, `npm run typecheck`, and the quickstart validation commands from `specs/001-core-reasoning/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - blocks all user stories
- **User Stories (Phase 3+)**: Depend on Foundational completion
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - no dependency on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - may reuse US1 infrastructure but remains independently testable
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - may reuse US1/US2 infrastructure but remains independently testable

### Within Each User Story

- Tests are written before implementation tasks for that story
- Shared core behavior is implemented before integration wiring
- A story is complete before moving to the next priority

### Parallel Opportunities

- Setup tasks `T001`-`T003` can run in parallel because they touch different files
- Foundational tasks `T004`-`T007` can run in parallel where the touched files do not overlap
- Story 1 test tasks `T008`-`T009` can run in parallel
- Story 2 test tasks `T013`-`T014` can run in parallel
- Story 3 test tasks `T017`-`T018` can run in parallel
- Polish tasks `T021`-`T023` can run in parallel

---

## Parallel Example: User Story 1

```bash
# Run the arena parser coverage and trace coverage together:
Task: "Add parser and arena contract coverage in src/arena.test.ts for default strategy selection, empty strategy rejection, and positive iteration validation"
Task: "Add strategy-result coverage in src/agents/trace.test.ts or a dedicated reasoning test file to verify trace ordering and formatted output remain stable"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. Validate `npm test`, `npm run typecheck`, and the arena command from the quickstart
5. Stop and demo if the core reasoning flow is stable

### Incremental Delivery

1. Deliver the reasoning run pipeline first (US1)
2. Add deterministic story operations and error handling next (US2)
3. Finish multi-strategy comparison and CLI dispatch consistency (US3)
4. Polish the documentation and run the quickstart checks
