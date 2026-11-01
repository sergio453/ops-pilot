# Feature Specification: Add Reflection Layer

**Feature Branch**: `002-add-reflection-layer`

**Created**: 2026-09-30

**Status**: Draft

**Input**: User description: "Camada reflection : withReflection(streategy, opts) decora qualquer ReasoningStrategy: executo a base; um crítico (mesmo modelo, saída estruturada{approved, feedback}) avalia a resposta contra as observações do trace; se o crítico reprovar, regenera com o feedback no contexto; para em approved ou maxReflections (default 2). Evento "critique" no trace; métricas somam as chamadas extras. Arena: reflect:react e reflect:plan-and-execute"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Improve strategy outcomes through critique (Priority: P1)

As an on-call operator, I want a strategy run to self-critique and retry when needed so that the final recommendation is more reliable before I act.

**Why this priority**: Reflection quality is the core value of this feature and directly affects production incident decisions.

**Independent Test**: Execute a reflection-enabled strategy and verify initial answer generation, critique evaluation, and optional regeneration loop until approval or retry limit.

**Acceptance Scenarios**:

1. **Given** a reflection-enabled strategy run, **When** the critic approves the first answer, **Then** the run returns that answer without retrying.
2. **Given** a reflection-enabled strategy run, **When** the critic rejects an answer, **Then** the system regenerates with feedback in context and reevaluates.
3. **Given** repeated rejections, **When** the maximum reflection retries are reached, **Then** the run stops and returns the most recent answer.

---

### User Story 2 - Keep reflection behavior observable in traces and metrics (Priority: P2)

As a developer, I want critique outcomes and additional calls recorded so that I can inspect quality/cost behavior and trust the reflection loop.

**Why this priority**: Reflection introduces extra calls and decisions that must remain transparent for operation and debugging.

**Independent Test**: Run one approved flow and one retry flow, then verify trace and metrics include critique events and added calls.

**Acceptance Scenarios**:

1. **Given** a reflection-enabled run, **When** a critic evaluation occurs, **Then** a `critique` event is added to the trace.
2. **Given** a run with retries, **When** additional generation and critique calls are executed, **Then** metrics include those extra calls.

---

### User Story 3 - Compare reflective presets in arena (Priority: P3)

As a developer, I want dedicated reflective arena modes so that I can benchmark reflective behavior for both existing reasoning styles.

**Why this priority**: This is valuable for tuning and adoption but depends on the generic wrapper and observability being complete first.

**Independent Test**: Run arena modes `reflect:react` and `reflect:plan-and-execute` and verify both complete with reflection semantics.

**Acceptance Scenarios**:

1. **Given** reflective presets are available, **When** `reflect:react` runs, **Then** it executes the ReAct strategy wrapped with reflection.
2. **Given** reflective presets are available, **When** `reflect:plan-and-execute` runs, **Then** it executes the Plan-and-Execute strategy wrapped with reflection.

### Edge Cases

- What happens when critic output is malformed or missing required fields?
- How does the loop behave when `maxReflections` is set to zero?
- What happens when the critic rejects but provides empty feedback?
- How does the run report failures if critique evaluation itself fails?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide `withReflection(strategy, opts)` that decorates any existing reasoning strategy without changing that strategy's external result contract.
- **FR-002**: The wrapper MUST execute the base strategy once before the first critique.
- **FR-003**: After each generated answer, the wrapper MUST run a critic evaluation that returns structured output with `approved` and `feedback`.
- **FR-004**: If critique returns `approved = false` and retry budget remains, the wrapper MUST regenerate using critique feedback as contextual guidance.
- **FR-005**: The loop MUST stop immediately when critique returns `approved = true`.
- **FR-006**: The loop MUST stop when `maxReflections` is reached and return the latest generated answer.
- **FR-007**: If not provided, `maxReflections` MUST default to 2.
- **FR-008**: Every critique pass MUST append a `critique` event to the trace.
- **FR-009**: Metrics MUST include all additional critique and regeneration calls introduced by reflection.
- **FR-010**: The arena MUST expose `reflect:react` and `reflect:plan-and-execute` modes backed by the reflection wrapper.
- **FR-011**: The system MUST surface explicit errors when critique output cannot be parsed into the required structured fields.

### Key Entities

- **Reflection Wrapper**: Decorator that augments a reasoning strategy with critique-regenerate behavior.
- **Critique Result**: Structured critic decision containing approval status and textual feedback.
- **Reflection Attempt**: A single critique decision plus optional regeneration.
- **Critique Trace Event**: Trace entry describing critique decision details for one attempt.
- **Reflective Arena Mode**: Arena selector that binds a base strategy to reflection behavior.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of critique evaluations in reflection-enabled runs emit a corresponding `critique` trace event.
- **SC-002**: Reflection-enabled runs always stop within configured retry bounds, with default behavior capped at 2 retries.
- **SC-003**: In scenarios with at least one rejection, regeneration with critique feedback occurs before the next critique pass in 100% of runs.
- **SC-004**: Reported metrics always include extra calls from reflection loops.
- **SC-005**: Arena runs for `reflect:react` and `reflect:plan-and-execute` complete successfully with final outputs.

## Assumptions

- Reflection is opt-in and does not alter behavior of non-reflective strategy modes.
- Critique uses the same model family already selected for the wrapped strategy run.
- Critique feedback is short improvement guidance, not a full answer replacement.
- Existing trace/metrics structures can be extended without changing consumer entrypoints.
