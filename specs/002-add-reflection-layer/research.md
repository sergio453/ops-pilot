# Research Notes: Add Reflection Layer

## Decision 1: Implement reflection as a higher-order strategy wrapper

- **Decision**: Introduce `withReflection(strategy, opts)` as a decorator that returns another `ReasoningStrategy` with identical external output shape (`answer`, `trace`, `metrics`).
- **Rationale**: This keeps reflection generic and composable across current and future strategies while minimizing strategy-specific branching.
- **Alternatives considered**:
  - Add reflection logic separately inside each strategy class.
  - Implement reflection only in arena orchestration.
  - Create dedicated reflective strategy classes per base strategy.

## Decision 2: Critique output must be structured and validated

- **Decision**: Treat critique as structured output containing `approved` (boolean) and `feedback` (string), and fail explicitly when output is malformed.
- **Rationale**: Reflection control flow depends on deterministic approval decisions; permissive parsing would create unsafe hidden behavior.
- **Alternatives considered**:
  - Parse free-form critique text heuristically.
  - Default malformed critique to `approved=true`.
  - Ignore missing feedback and continue with empty context silently.

## Decision 3: Retry loop is bounded and defaulted

- **Decision**: Execute base answer first, then critique; retry only while not approved and retries remain; default `maxReflections` to 2 when absent.
- **Rationale**: Bounded retries preserve operational predictability and align with feature scope defined in specification.
- **Alternatives considered**:
  - Unlimited retries until approval.
  - Zero retries by default.
  - Run critique before first generated answer.

## Decision 4: Trace and metrics must expose reflection cost

- **Decision**: Append a `critique` trace event per critique pass and include all critique/regeneration calls in aggregate metrics.
- **Rationale**: Observability is required for trust, debugging, and cost assessment in production operations.
- **Alternatives considered**:
  - Keep trace unchanged and log critiques separately.
  - Count only base strategy calls in metrics.
  - Expose critique outcomes only when retries occur.

## Decision 5: Reflective arena modes should be presets, not a new CLI

- **Decision**: Add `reflect:react` and `reflect:plan-and-execute` as strategy registry aliases that compose existing strategies with the reflection wrapper.
- **Rationale**: Presets preserve current CLI UX and allow side-by-side comparison with non-reflective modes.
- **Alternatives considered**:
  - Add new arena flags to toggle reflection globally.
  - Replace base modes with reflective behavior by default.
  - Introduce a separate command for reflective runs.
