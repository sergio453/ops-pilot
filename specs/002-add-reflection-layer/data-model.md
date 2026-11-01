# Data Model: Add Reflection Layer

## Entities

### ReflectionOptions

- **Fields**: `maxReflections`
- **Purpose**: Configures retry bounds for reflective strategy execution.
- **Validation rules**:
  - `maxReflections` is an integer greater than or equal to 0
  - when omitted, default value is 2

### CritiqueResult

- **Fields**: `approved`, `feedback`
- **Purpose**: Structured critic decision for the latest generated answer.
- **Validation rules**:
  - `approved` must be boolean
  - `feedback` must be a non-empty string

### ReflectionAttempt

- **Fields**: `attemptIndex`, `answer`, `critique`
- **Purpose**: Captures one evaluate cycle of generated answer plus critique decision.
- **Relationships**:
  - belongs to one `ReflectiveReasoningRun`
  - references one `CritiqueResult`
- **Validation rules**:
  - `attemptIndex` starts at 0 and increments by 1 per cycle
  - each attempt must have exactly one critique result

### CritiqueTraceEvent

- **Fields**: `type`, `content`
- **Purpose**: Trace entry representing a critique pass and decision context.
- **Relationships**:
  - appended to `ReasoningResult.trace`
- **Validation rules**:
  - `type` must be `critique`
  - `content` must summarize decision and feedback context

### ReflectiveReasoningRun

- **Fields**: `baseStrategyName`, `input`, `attempts`, `finalAnswer`, `trace`, `metrics`
- **Purpose**: Represents full execution of base strategy plus reflection loop.
- **Relationships**:
  - contains many `ReflectionAttempt`
  - extends the existing `ReasoningResult` contract
- **Validation rules**:
  - must always return exactly one final answer
  - must stop when critique approves or retry limit is reached
  - metrics must include base + reflective extra calls
  - critique evaluations count as additional model calls in aggregate metrics

### ReflectiveArenaPreset

- **Fields**: `strategyKey`, `baseStrategy`, `reflectionOptions`
- **Purpose**: CLI-facing alias mapping for reflection-enabled strategy execution.
- **Validation rules**:
  - `strategyKey` must be one of `reflect:react` or `reflect:plan-and-execute`
  - `baseStrategy` must resolve to an existing strategy factory

## State Transitions

### Reflection Loop

- `initial-answer-generated -> critique-evaluated`
- `critique-evaluated (approved=true) -> completed`
- `critique-evaluated (approved=false, retries remain) -> regenerated-answer`
- `regenerated-answer -> critique-evaluated`
- `critique-evaluated (approved=false, retries exhausted) -> completed`

### Error Transitions

- `critique-evaluated -> failed` when critique output violates structured contract
- `initial-answer-generated -> failed` when critique invocation itself fails

## Aggregate Notes

- Reflection must be compositional: existing base strategies stay reusable without embedded reflection logic.
- Trace ordering matters: critique events are appended in execution order to keep deterministic diagnostics.
- Metrics aggregation should remain monotonic through retries (never decrement call counters).
