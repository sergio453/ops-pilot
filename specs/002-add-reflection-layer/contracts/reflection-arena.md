# Contract: Reflective Arena Modes

## Command Surface

Reflective behavior is exposed through existing `arena` strategy selection.

### Inputs

- `--strategies <comma-separated>` accepts existing strategies and reflective presets.
- New reflective presets:
  - `reflect:react`
  - `reflect:plan-and-execute`

### Defaults

- Existing defaults remain unchanged (`react,plan-and-execute`).
- Reflection is opt-in via explicit reflective preset names.

## Reflective Execution Contract

For each reflective strategy entry:

1. Execute the mapped base strategy to produce an answer candidate.
2. Evaluate candidate with a critic that returns structured decision:
   - `approved: boolean`
   - `feedback: string`
3. If `approved=false` and retries remain, regenerate with feedback context and re-critique.
4. Stop when approved or retry limit is reached.
5. If no explicit retry limit is provided, default to `maxReflections = 2`.

## Output Contract

Each reflective strategy run must return the standard reasoning block shape:

- `answer`: final answer string (approved answer or last retry answer)
- `trace`: ordered events including one `critique` event per critique pass
- `metrics`: includes all calls from base generation + critique + regeneration

## Error Cases

- Unknown strategy name (including mistyped reflective preset)
- Critique output missing `approved` or `feedback`
- Critique output with wrong field types
- Reflection configuration with invalid `maxReflections` value
- Critique output with empty `feedback`

## Compatibility Rules

- Non-reflective strategy outputs remain unchanged.
- Arena header and per-strategy output format remain compatible with existing consumers.
