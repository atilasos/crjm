# Test Spec — melhoria-ai-pedagogia

## Scope
- Dominório tutor clarity
- Quelhas V1 tutor parity
- engine/fallback observability in both games

## Unit tests
1. Dominório `buildExplainText` / threat text / top-move reason generation avoid undefined jargon and keep actionable text, using fixtures/golden cases for ambiguous terms.
   - add fixtures that fail on bare “zona”, “corredor”, “paridade”, “região” when no concrete action accompanies the text.
2. Dominório adapter stats reflect real engine path rather than hardcoded fallback values, including `usedWasm`/`engine` consistency.
3. Quelhas adapter V1 maps `bestMove`, `topMoves`, `pedagogy`, `stats` correctly from worker/inline paths.
4. Difficulty bridge tests prove chosen mapping between shared difficulty and Quelhas/Dominório local presets.

## Integration tests
1. Dominório human turn renders tutor card + top moves + critical threat with updated copy.
2. Quelhas human turn renders tutor card + top moves once `src/games/quelhas/ai/v1-adapter.ts` and tutor components land.
3. Quelhas fallback/timeout path no longer silently degrades to opaque first-valid-move behavior without surfaced status.
4. Quelhas tutor components render through named local touchpoints rather than embedding all tutor copy/mapping logic inline in `QuelhasGame.tsx`.

## Build / regression
- `bun test`
- `bun run build -- --skip-wasm`
- diagnostics on touched files

## Manual probes
1. Play a short Dominório game and inspect 3 tutor messages for clarity/actionability.
2. Play a short Quelhas game and confirm tutor appears with V1 payload, surfaced trust signals, and no opaque fallback to the first valid move.
3. Record whether the UI now exposes enough trust signals for classroom trial.
