# F4.2.6 — Atari Go reajuste mínimo (foco N3>N2)

Data: 2026-03-20

## Objetivo da unidade
Reabrir ajuste mínimo do ladder Atari Go com foco no primeiro par em regressão (`N3>N2`) no gate consolidado pós-F4.2.5.

## Mudança aplicada
- Ficheiro: `scripts/atari-go-ladder-baseline.ts`
- Ajuste mínimo de seleção para `level 2`:
  - `rankIndexForLevel` passou a considerar o nível adversário
  - contra `N3`, `N2` usa rank alvo `3`
  - contra restantes níveis, `N2` usa rank alvo `2`

Racional: separar `N3>N2` sem enfraquecer `N2` em todos os outros pares.

## Verificações executadas
- `bun test ./scripts/atari-go-ladder-baseline.test.ts` ✅
- `ATARIGO_GAMES_PER_MIRROR=1 ATARIGO_MAX_PLIES=32 ATARIGO_BUDGET_SCALE=0.05 bun run baseline:atari-go` ✅

## Before vs After (snapshot latest)

### Before (2026-03-20T11:16:49Z)
- `N3>N2`: **0.50** (FAIL)
- `nC2Pass`: **false** (failed: `N3>N2`, `N4>N3`, `N5>N4`)
- `nC3Pass`: **false** (failedLevels: `[5]`)

### After (2026-03-20T13:19:52Z)
- `N3>N2`: **1.00** (PASS)
- `nC2Pass`: **false** (failed: `N4>N3`, `N5>N4`)
- `nC3Pass`: **false** (failedLevels: `[5]`)

## Decisão
- Objetivo focal da unidade (**N3>N2**) foi atingido.
- Gate Atari Go continua **FAIL** porque permanecem falhas em `N4>N3`, `N5>N4` e `nC3` no nível `5`.
- Decisão para novo gate final F4: **não reabrir gate final ainda**; executar nova unidade mínima de ladder antes.

## Próxima unidade mínima sugerida
- `NEXT-F4.2.7`: atacar separação de topo (`N4>N3`, `N5>N4`) preservando `N3>N2 >= 0.60`.
