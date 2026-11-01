<!--
Sync Impact Report
- Version change: 1.0.0 -> 1.1.0
- Modified principles:
  - None
- Added sections:
  - None
- Removed sections:
  - None
- Follow-up TODOs:
  - None
-->
# OpsPilot Constitution

## Core Principles

### I. Type-safe architecture and boundary validation
All external entry points must validate input and output with zod. Domain logic must be isolated from raw HTTP/CLI data, and every new contract must be explicitly typed. The system must favor clear schemas over implicit assumptions.

### II. MVC structure and responsibility separation
The codebase must follow the standard MVC layers: Model, Service, and Controller. Business rules belong to services, persistence and data access belong to models, and protocol-specific concerns remain at the controller boundary. Avoid mixing responsibilities across layers.

### III. Pure logic and explicit error handling
New logic must be implemented as pure functions whenever possible. Domain errors should be represented as classes and translated at the edge, preserving clear semantics and making behavior easier to test and reason about.

### IV. Test-first quality gates
Every new feature or behavior must be backed by tests. The project requires `npm test` to remain green and `npm run typecheck` to remain green. No logic should be introduced without a focused test that exercises the intended behavior.

### V. Secure and operationally safe development
Secrets must never be committed and `.env` files must not be read directly by the application flow. The platform must be designed for production operations, with operational safety, conservative defaults, and a clear separation between runtime config and source control.

## Stack and Constraints

The project is built on:
- Node.js 22 LTS
- TypeScript ESM with `strict: true`
- Express as the HTTP layer
- SQLite as the persistence layer via `node:sqlite` (`DatabaseSync`)
- LangChain / LangGraph over OpenRouter for the agentic workflow
- `zod` at system boundaries for schema validation

Operational persistence must be configured via `OPSPILOT_DB`, with `./data/opspilot.db` as
the default path and `:memory:` for deterministic test/benchmark execution.

The project commands are the source of truth for local execution and validation:
- `npm run dev`
- `npm run dev:env`
- `npm run arena`
- `npm run bench`
- `npm test`
- `npm run typecheck`

## Development Workflow

Follow the Spec Kit workflow in order:
/speckit.specify -> plan -> task -> implement

Specifications must be versioned and maintained as part of the project history. Changes should be traceable through the planning and implementation workflow rather than emerging ad hoc from code changes alone.

## Governance

This constitution governs all project decisions and supersedes informal or legacy practices that conflict with it. Any amendment must be documented, aligned with the current stack and execution commands, and reflected in the project guidance before being considered active.

**Version**: 1.1.0 | **Ratified**: 2026-09-14 | **Last Amended**: 2026-10-14
