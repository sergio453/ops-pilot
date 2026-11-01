---

description: "Task list for Add Reflection Layer"
---

# Tasks: Add Reflection Layer

**Input**: Design documents from `/specs/002-add-reflection-layer/`

**Prerequisites**: [plan.md](./plan.md) (required), [spec.md](./spec.md) (required for user stories), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/)

**Tests**: Include focused tests because the constitution requires new behavior coverage and each user story must remain independently testable.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (`US1`, `US2`, `US3`)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Introduce reflection module boundaries and shared types before feature behavior is implemented

- [X] T001 [P] Add reflection domain types in `src/agents/types.ts` for reflection options and critique output contracts used by all strategies
- [X] T002 [P] Create reflection error classes for invalid critique payloads in `src/agents/errors.ts`
- [X] T003 [P] Create reflection test scaffold in `src/agents/reflection.test.ts` with shared stubs/fakes for strategy and critic behavior

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core reflection infrastructure that MUST be complete before user stories

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Implement `withReflection(strategy, opts)` loop orchestration in `src/agents/reflection.ts` (base execution first, critique pass per answer, bounded retries)
- [X] T005 Implement reflection option validation in `src/agents/reflection.ts` quoting the exact constraint from data model: "`maxReflections` is an integer greater than or equal to 0" and "when omitted, default value is 2"
- [X] T006 Implement critique payload validation in `src/agents/reflection.ts` quoting exact constraints: "`approved` must be boolean" and "`feedback` must be a non-empty string", with explicit error propagation through `src/agents/errors.ts`
- [X] T007 [P] Add helper wiring for reflection critic model creation/reuse in `src/agents/model.ts` so critique uses the same model family configured for strategy execution
- [X] T008 [P] Add reflection wrapper module wiring for downstream imports in `src/agents/reflection.ts`

**Checkpoint**: Reflection foundation is ready; user story implementation can proceed

---

## Phase 3: User Story 1 - Improve strategy outcomes through critique (Priority: P1) 🎯 MVP

**Goal**: Reflection-enabled runs self-critique and regenerate until approval or retry bound

**Independent Test**: Execute wrapper tests to verify first-pass approval, rejection with feedback-based regeneration, max-retry termination, and zero-retry behavior

### Tests for User Story 1

- [X] T009 [P] [US1] Add unit test for immediate approval flow in `src/agents/reflection.test.ts` (no regeneration when approved on first critique)
- [X] T010 [P] [US1] Add unit test for rejection/regeneration flow in `src/agents/reflection.test.ts` (feedback must be passed into next attempt context)
- [X] T011 [P] [US1] Add unit test for retry-bound termination in `src/agents/reflection.test.ts` (returns latest answer when retry limit is reached)
- [X] T012 [P] [US1] Add unit test for `maxReflections = 0` behavior in `src/agents/reflection.test.ts`

### Implementation for User Story 1

- [X] T013 [US1] Implement reflection retry state handling in `src/agents/reflection.ts` with ordered `ReflectionAttempt` progression (`attemptIndex` increment per cycle)
- [X] T014 [US1] Implement regeneration context composition in `src/agents/reflection.ts` so critique feedback informs the next generation attempt
- [X] T015 [US1] Implement explicit failure path for malformed critique output in `src/agents/reflection.ts` and `src/agents/errors.ts`

**Checkpoint**: User Story 1 is fully functional and independently testable

---

## Phase 4: User Story 2 - Keep reflection behavior observable in traces and metrics (Priority: P2)

**Goal**: Reflection decisions and extra calls are transparent in trace and metrics outputs

**Independent Test**: Run reflection tests covering trace event insertion and metric aggregation for approved and retrying runs

### Tests for User Story 2

- [X] T016 [P] [US2] Add trace-event ordering test in `src/agents/reflection.test.ts` to verify one `critique` event per critique pass
- [X] T017 [P] [US2] Add metrics aggregation test in `src/agents/reflection.test.ts` to verify additional critique/regeneration calls are included in `llCalls`
- [X] T018 [P] [US2] Add formatting coverage for critique traces in `src/agents/trace.test.ts` ensuring critique events remain readable in rendered output

### Implementation for User Story 2

- [X] T019 [US2] Append critique trace events in execution order within `src/agents/reflection.ts` for every critique decision
- [X] T020 [US2] Aggregate reflection metrics in `src/agents/reflection.ts` so final metrics include base generation + critique + regeneration calls
- [X] T021 [US2] Ensure reflective result contract remains compatible with existing formatting in `src/agents/trace.ts`

**Checkpoint**: User Story 2 is independently verifiable with observability guarantees

---

## Phase 5: User Story 3 - Compare reflective presets in arena (Priority: P3)

**Goal**: Arena supports `reflect:react` and `reflect:plan-and-execute` presets using the generic reflection wrapper

**Independent Test**: Execute arena strategy-registry tests and run arena with reflective presets to confirm final outputs

### Tests for User Story 3

- [X] T022 [P] [US3] Add strategy-registry coverage in `src/arena.test.ts` for `reflect:react` and `reflect:plan-and-execute`
- [X] T023 [P] [US3] Add arena argument/selection coverage in `src/arena.test.ts` for mixed base and reflective strategy lists

### Implementation for User Story 3

- [X] T024 [US3] Register reflective strategy presets in `src/arena.ts` by composing base strategy factories with `withReflection`
- [X] T025 [US3] Keep unknown reflective strategy handling explicit in `src/arena.ts` so mistyped names fail clearly
- [X] T026 [US3] Ensure reflective presets preserve current arena output block shape in `src/arena.ts`

**Checkpoint**: User Story 3 enables side-by-side reflective strategy comparison

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final consistency, docs, and full validation across stories

- [X] T027 [P] Update reflection behavior notes and usage examples in `specs/002-add-reflection-layer/quickstart.md`
- [X] T028 [P] Reconcile CLI contract wording with implementation details in `specs/002-add-reflection-layer/contracts/reflection-arena.md`
- [X] T029 [P] Reconcile entity/state definitions with implemented behavior in `specs/002-add-reflection-layer/data-model.md`
- [X] T030 Run validation commands `npm test` and `npm run typecheck`, then execute quickstart arena scenarios from `specs/002-add-reflection-layer/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion; blocks all user stories
- **User Story phases (Phase 3-5)**: Depend on Foundational completion
- **Polish (Phase 6)**: Depends on completion of all targeted user stories

### User Story Dependencies

- **US1 (P1)**: Starts after Foundational; no dependency on other stories
- **US2 (P2)**: Starts after Foundational; depends on US1 reflection core behavior but remains independently testable
- **US3 (P3)**: Starts after Foundational; depends on wrapper availability from US1 and observability compatibility from US2

### Within Each User Story

- Write tests before implementation changes for that story
- Reflection core behavior before arena integration wiring
- Story is complete only after independent-test criteria pass

### Parallel Opportunities

- Setup tasks `T001`-`T003` can run in parallel
- Foundational tasks `T007` and `T008` can run in parallel after `T004`-`T006` definitions stabilize
- US1 test tasks `T009`-`T012` can run in parallel
- US2 test tasks `T016`-`T018` can run in parallel
- US3 test tasks `T022`-`T023` can run in parallel
- Polish doc tasks `T027`-`T029` can run in parallel

---

## Parallel Example: User Story 1

```bash
# Execute US1 tests in parallel:
Task: "T009 [US1] immediate-approval test in src/agents/reflection.test.ts"
Task: "T010 [US1] rejection/regeneration test in src/agents/reflection.test.ts"
Task: "T011 [US1] retry-bound test in src/agents/reflection.test.ts"
Task: "T012 [US1] zero-retry test in src/agents/reflection.test.ts"
```

---

## Parallel Example: User Story 2

```bash
# Execute US2 observability tests in parallel:
Task: "T016 [US2] critique trace ordering test in src/agents/reflection.test.ts"
Task: "T017 [US2] metrics aggregation test in src/agents/reflection.test.ts"
Task: "T018 [US2] critique formatting test in src/agents/trace.test.ts"
```

---

## Parallel Example: User Story 3

```bash
# Execute US3 registry and selection tests in parallel:
Task: "T022 [US3] reflective preset registry test in src/arena.test.ts"
Task: "T023 [US3] mixed strategy selection test in src/arena.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. Validate US1 independently via `src/agents/reflection.test.ts`
5. Demo reflection behavior before proceeding

### Incremental Delivery

1. Deliver MVP (US1) with bounded reflection loop
2. Add observability guarantees (US2) and validate trace/metrics behavior
3. Add arena reflective presets (US3) for operational comparison
4. Execute Phase 6 polish and full validation commands
