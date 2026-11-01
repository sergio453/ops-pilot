# Quickstart: Core Reasoning Engine for OpsPilot

## Prerequisites

- Node.js 22 LTS
- Project dependencies installed with `npm install`
- OpenRouter environment variables available for live reasoning runs:
  - `OPENROUTER_API_KEY`
  - `OPENROUTER_MODEL`

## Validate the codebase

```bash
npm test
npm run typecheck
```

**Expected outcome**: Both commands complete successfully with no failing tests or TypeScript errors.

## Seed the demo story

```bash
npm run seed:story
```

**Expected outcome**: The command rewrites `src/agents/story-seed.json`, then prints the seeded service and alert counts, plus an empty incident count.

## Run the arena

```bash
npm run arena -- --input "Quais alertas firing devemos tratar primeiro?" --strategies react,plan-and-execute --max-iterations 6
```

**Expected outcome**:

- The command prints the configured strategies.
- Each strategy returns an answer, trace, and metrics block.
- The trace includes structured steps rather than a single opaque response.

## Related contract

- See [contracts/reasoning-cli.md](./contracts/reasoning-cli.md) for the command-level input and output contract.
