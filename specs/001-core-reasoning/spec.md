# Feature Specification: Core Reasoning Engine for OpsPilot

**Feature Branch**: `001-core-reasoning`

**Created**: 2026-09-23

**Status**: Draft

**Input**: User description: "Nucleo de raciocinio do OpsPilot"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Run a reasoning session end to end (Priority: P1)

As an operator, I want to send a prompt to OpsPilot and receive a final recommendation with traceable reasoning steps so I can understand why the system chose a response.

**Why this priority**: This is the core value of the product and the main reason the reasoning engine exists.

**Independent Test**: Execute the reasoning flow from the CLI and verify that it returns an answer, a trace, and execution metrics.

**Acceptance Scenarios**:

1. **Given** a valid prompt and a supported strategy, **When** the operator runs the reasoning flow, **Then** the system returns a final answer, trace events, and metrics.
2. **Given** an invalid prompt or invalid max iteration value, **When** the operator submits the request, **Then** the system rejects it with a validation error before any model call occurs.

---

### User Story 2 - Operate on alerts and incidents safely (Priority: P2)

As an operator, I want the reasoning engine to list alerts, open incidents, and resolve incidents against a deterministic scenario so I can validate incident-handling behavior.

**Why this priority**: These actions are the primary tools used by the reasoning flow and the simplest way to prove the engine can perform useful work.

**Independent Test**: Run the built-in story scenario and verify that alert and incident operations change the in-memory story as expected.

**Acceptance Scenarios**:

1. **Given** the default story, **When** the engine lists firing alerts, **Then** it returns only the firing subset.
2. **Given** a valid service, **When** the engine opens an incident, **Then** a new open incident is created and can be resolved by ID.
3. **Given** an unknown service, **When** the engine tries to open an incident, **Then** it fails with a domain error.

---

### User Story 3 - Compare reasoning strategies deterministically (Priority: P3)

As a developer, I want to compare the existing ReAct and Plan-and-Execute strategies so I can validate that the engine supports multiple reasoning modes.

**Why this priority**: Strategy comparison is important for quality and future growth, but it depends on the core reasoning flow being stable first.

**Independent Test**: Run the arena command with both strategies and verify that each strategy returns its own answer, trace, and metrics.

**Acceptance Scenarios**:

1. **Given** both strategies are available, **When** the arena runs with a shared prompt, **Then** each strategy produces a structured result.
2. **Given** an unsupported strategy name, **When** the arena is started, **Then** it fails fast with a clear error.

---

### Edge Cases

- What happens when the LLM returns no final answer?
- How does the engine behave when the recursion or iteration limit is reached?
- What happens when a tool call references an unknown service or incident ID?
- How should the system surface malformed tool input from a strategy?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST accept a non-empty prompt and a positive iteration limit before starting a reasoning run.
- **FR-002**: System MUST support the existing `react` and `plan-and-execute` strategies behind a shared reasoning interface.
- **FR-003**: System MUST return a final answer, ordered trace events, and runtime metrics for each reasoning run.
- **FR-004**: System MUST expose deterministic story operations for listing alerts, opening incidents, and resolving incidents.
- **FR-005**: System MUST validate all external inputs at the CLI boundary with zod.
- **FR-006**: System MUST reject invalid tool inputs and unknown services/incident IDs with explicit domain errors.
- **FR-007**: System MUST keep the seeded story reproducible so the arena and tests can run without external dependencies.
- **FR-008**: System MUST keep existing CLI entrypoints working while the reasoning core is refactored.
- **FR-009**: System MUST preserve trace formatting so reasoning output remains readable and stable for tests.

### Key Entities

- **Service**: A named application or subsystem that can emit alerts and host incidents.
- **Alert**: A service-level signal with severity and firing/resolved status.
- **Incident**: A tracked operational event opened from the story data and resolved by ID.
- **Reasoning Run**: A single prompt execution that produces an answer, trace, and metrics.
- **Trace Event**: A structured event describing thought, action, observation, plan, critique, or answer output.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A valid arena run produces a final answer, trace, and metrics for every configured strategy.
- **SC-002**: Invalid prompts, invalid iteration counts, and unsupported strategy names fail before any model invocation.
- **SC-003**: The seeded story always contains the same services and alerts across repeated runs.
- **SC-004**: The test suite and typecheck command remain green after the feature is implemented.

## Assumptions

- The first release focuses on the CLI and internal reasoning core rather than a new persistence layer.
- The default story remains in memory for deterministic testing and demo usage.
- Existing model access continues to use OpenRouter through the current environment-based configuration.
- Future HTTP exposure, if needed, will reuse the same reasoning core rather than duplicating logic.
