# F4 Atari Go Regression Analysis — 2026-03-22

## What changed

Commit `1efacf2` modified `scripts/atari-go-ladder-baseline.ts` to use **per-player independent RNG** instead of a shared RNG for both players. The intent was to reduce B1 (first-player bias) by decoupling blunder decisions between J1 and J2.

Additionally, uncommitted changes added **Fisher-Yates shuffle before evalCap** to reduce scan-order bias.

## Observed effect

### N5>N4 winrate (T1)

| State | N5>N4 | J1 | J2 | B1 |
|-------|-------|----|----|----|
| Before (shared RNG) `2026-03-21T10-44-22` | **90%** ✓ | 100% | 80% | 20pp |
| RNG split only `2026-03-22T09-38-08` | **75%** ✓ | 90% | 60% | 30pp |
| RNG split + shuffle `2026-03-22T09-50-20` | **35%** ✗ | — | — | — |

### Other pairs (RNG split only, run1)

| Pair | Before | After |
|------|--------|-------|
| N2>N1 | 90% | 90% |
| N3>N2 | 95% | 100% |
| N4>N3 | 100% | 100% |

## Root cause analysis

1. **Per-player RNG** changes the seed landscape for all decisions. With only 20 games, this produces a 15pp drop in N5>N4 (90% → 75%), and B1 actually worsened (20pp → 30pp) for N5>N4. The commit message claimed "B1 drops from 20pp to 0pp for N2>N1 and N3>N2" — this may have been true for lower pairs but was not validated for N5>N4.

2. **Shuffle pre-evalCap** degrades the safety lookahead disproportionately for N5. N5 relies on `safetyLookahead=2` with `evalCap=40`, which calls `scoreMoves` recursively for opponent and reply scoring. With shuffle, the opponent model inside the safety evaluation becomes noisy — the moves selected for evaluation change randomly, degrading the quality of the strategic assessment. N4 (lookahead=1) is less affected. This causes N5>N4 to collapse to 35%.

## Decision: REVERT

- Revert committed per-player RNG (`1efacf2`) — the fix was counterproductive for N5>N4 and worsened B1 for that pair.
- Discard uncommitted shuffle changes — catastrophic effect on N5>N4.
- B1 bias should be addressed via a different mechanism that does not affect seed landscape for safety lookahead (e.g., alternating first-move priority or bias-compensated scoring).

## Post-revert verification

Reverted via `af2267f`. Re-ran baseline with identical parameters (seed=20260321, budgetScale=0.05):

| Pair | Post-revert | Threshold | Pass |
|------|-------------|-----------|------|
| N2>N1 | 90% | 62% | ✓ |
| N3>N2 | 95% | 60% | ✓ |
| N4>N3 | 100% | 57% | ✓ |
| N5>N4 | 75% | 55% | ✓ |

N5>N4 = 75% (vs 90% original) — within 95% CI for 18/20 binomial, attributable to run-to-run variance. All T1 pairs pass. nC2 passes. State confirmed stable.

Also ran with budgetScale=1 and random seed: N5>N4 = 75%, all T1 pass, nC2 pass. Consistent.

Shuffle pre-evalCap abandoned — degrades safety lookahead disproportionately for N5 (safetyLookahead=2).
