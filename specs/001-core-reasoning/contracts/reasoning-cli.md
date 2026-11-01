# Contract: Reasoning CLI and Run Output

## Command: `arena`

Runs one or more reasoning strategies against a shared prompt and prints their results.

### Inputs

- `--input <text>`: Prompt to send to the reasoning engine
- `--strategies <comma-separated>`: Strategy names to run
- `--max-iterations <number>`: Positive integer limit for reasoning steps

### Defaults

- Prompt: `Quais alertas firing devemos tratar primeiro?`
- Strategies: `react,plan-and-execute`
- Max iterations: `6`

### Success Output

The command should print:

1. A header identifying the arena run
2. The resolved input prompt
3. The max iteration value
4. One block per strategy containing:
   - strategy name
   - final answer
   - formatted trace
   - metrics with `llCalls` and `latencyMs`

### Error Cases

- Missing `--input` value
- Missing `--strategies` value
- Missing `--max-iterations` value
- Invalid or unsupported strategy name
- Non-positive `maxIterations`
- Missing OpenRouter environment variables for live model execution

## Supporting Script: `seed:story`

Seeds the deterministic story data used by the arena.

### Expected Output

- Seed file path for `src/agents/story-seed.json`
- Seed confirmation
- Service count
- Alert count split by `firing` and `resolved`
- Incident count
