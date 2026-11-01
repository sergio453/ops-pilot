# Research Notes: Core Reasoning Engine for OpsPilot

## Decision 1: Keep the story data in memory for v1

- **Decision**: Preserve the existing `StoryStore` as an in-memory deterministic scenario for the first release of the reasoning core.
- **Rationale**: The current repository has no persistence layer wired into the reasoning path, and the feature needs fast, reproducible tests and demo runs.
- **Alternatives considered**:
  - Wire the story to MySQL/Sequelize now
  - Persist story state to files
  - Mock the story at the strategy boundary

## Decision 2: Use a shared strategy contract for all reasoning modes

- **Decision**: Keep `react` and `plan-and-execute` behind a common `ReasoningStrategy` interface and shared result type.
- **Rationale**: The strategies already return the same conceptual payloads, so the feature should normalize them instead of duplicating orchestration logic.
- **Alternatives considered**:
  - Embed strategy selection directly in the CLI
  - Special-case each strategy in the arena runner
  - Collapse all behavior into a single reasoning implementation

## Decision 3: Validate inputs at the boundary and raise domain errors inside the core

- **Decision**: Continue using zod for CLI/tool validation and surface explicit errors for unknown services, incidents, and invalid iteration values.
- **Rationale**: This matches the project constitution and keeps the reasoning core pure and testable.
- **Alternatives considered**:
  - Accept loosely typed inputs and default silently
  - Return empty success-shaped results on invalid data
  - Throw generic errors from every layer without classification

## Decision 4: Keep the first delivery centered on CLI validation and reusable core logic

- **Decision**: Document the external contract around the reasoning CLI and its outputs rather than introducing a new HTTP surface in this feature.
- **Rationale**: The repository already exposes CLI entrypoints, and the reasoning core can be reused by future controllers without forcing a new server design into this plan.
- **Alternatives considered**:
  - Add a new Express API now
  - Split the feature into separate CLI and API tracks
  - Defer all contracts until implementation is complete
