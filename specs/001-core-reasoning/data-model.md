# Data Model: Core Reasoning Engine for OpsPilot

## Entities

### Service

- **Fields**: `id`, `name`
- **Purpose**: Represents a production service that can emit alerts and host incidents.
- **Validation rules**:
  - `id` must be non-empty
  - `name` must be non-empty

### Alert

- **Fields**: `id`, `service`, `title`, `severity`, `status`
- **Purpose**: Represents an alert in the seeded scenario.
- **Relationships**: Belongs to one `Service` by `service`
- **Validation rules**:
  - `severity` must be one of `critical`, `high`, `medium`, or `low`
  - `status` must be one of `firing` or `resolved`
  - `service` must reference a known service in the story

### Incident

- **Fields**: `id`, `title`, `service`, `severity`, `status`
- **Purpose**: Represents an operational incident opened by the reasoning engine.
- **Relationships**: Belongs to one `Service` by `service`
- **Validation rules**:
  - `status` must be `open` or `resolved`
  - `severity` must match the alert severity enum
  - opening an incident requires a known service
  - resolving an incident requires a known incident ID

### Reasoning Run

- **Fields**: `strategyName`, `prompt`, `maxIterations`, `answer`, `trace`, `metrics`
- **Purpose**: Captures the result of a single reasoning execution.
- **Relationships**: Contains many `TraceEvent` entries
- **Validation rules**:
  - `prompt` must be non-empty
  - `maxIterations` must be a positive integer
  - `strategyName` must identify a supported strategy

### TraceEvent

- **Fields**: `type`, `content`, `action?`
- **Purpose**: Structured trace entry for reasoning execution.
- **Validation rules**:
  - `type` must be one of `thought`, `action`, `observation`, `plan`, `critique`, or `answer`
  - `action`, when present, must include a tool name and JSON-safe args object

## State Transitions

### Alert

- `firing -> resolved`
- Resolved alerts remain readable but should not be reclassified silently.

### Incident

- `open -> resolved`
- Resolving an already resolved incident is idempotent.

## Aggregate Notes

- `StoryStore` acts as the aggregate root for services, alerts, and incidents.
- The seeded baseline is stored in `src/agents/story-seed.json` and loaded at store initialization.
- Reasoning strategies should not mutate story state directly except through the tool layer.
- Trace construction stays separate from business mutation so test assertions remain deterministic.
