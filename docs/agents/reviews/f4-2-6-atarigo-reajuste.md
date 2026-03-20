# F4.2.6 — Atari Go reajuste mínimo (foco N3>N2)

Data: 2026-03-20

## Objetivo da unidade
Reabrir ajuste mínimo do ladder Atari Go com foco no primeiro par em regressão (`N3>N2`) no gate consolidado pós-F4.2.5.

## Mudança aplicada
- Ficheiro: `scripts/atari-go-ladder-baseline.ts`
- Ajuste de separação mínima:
  - `level 2` passou de rank alvo `2` para `3` (ligeiramente mais fraco)
  - `level 3` mantido em rank alvo `0` (mais forte)

Racional: aumentar o contraste direto entre N3 e N2 sem refactor do motor.

## Verificações executadas
- `bun test ./scripts/atari-go-ladder-baseline.test.ts` ✅
- `ATARIGO_GAMES_PER_MIRROR=1 ATARIGO_MAX_PLIES=32 ATARIGO_BUDGET_SCALE=0.05 bun run baseline:atari-go` ✅

## Before vs After (snapshot latest)

### Before (2026-03-20T11:16:49Z)
- `N3>N2`: **0.50** (FAIL)
- `nC2Pass`: **false** (failed: `N3>N2`, `N4>N3`, `N5>N4`)
- `nC3Pass`: **false** (failedLevels: `[5]`)

### After (2026-03-20T12:16:20Z)
- `N3>N2`: **1.00** (PASS)
- `nC2Pass`: **false** (failed: `N2>N1`, `N4>N3`, `N5>N4`)
- `nC3Pass`: **false** (failedLevels: `[5]`)

## Decisão
- Objetivo focal da unidade (**N3>N2**) foi atingido.
- Gate Atari Go continua **FAIL** porque houve regressão no par `N2>N1` e permanecem falhas em `N4>N3` e `N5>N4`.

## Próxima unidade mínima sugerida
- `NEXT-F4.2.7`: corrigir regressão introduzida em `N2>N1` mantendo `N3>N2 >= 0.60`.
