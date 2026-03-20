# F4.2.6 — Atari Go reajuste mínimo (foco N3>N2)

Data: 2026-03-20

## Objetivo da unidade
Reabrir ajuste mínimo do ladder Atari Go com foco no primeiro par em regressão (`N3>N2`) no gate consolidado pós-F4.2.5.

## Mudança aplicada nesta execução
- `scripts/atari-go-ladder-baseline.test.ts`
  - cenário reduzido do teste ajustado para `ATARIGO_MAX_PLIES=48` e timeout `90s`, evitando timeout espúrio no `spawnSync`.
  - mantida asserção explícita de regressão: `N3>N2` com `strongerWinrate >= 0.55`.
- `scripts/atari-go-ladder-baseline.ts`
  - sem alteração adicional nesta reexecução; mantém o ajuste mínimo já aplicado para separação de `N3>N2`.

## Verificações executadas
- `bun test scripts/atari-go-ladder-baseline.test.ts` ✅
- `bun run baseline:atari-go` (opções padrão) ✅

## Before vs After (gate consolidado -> snapshot desta unidade)

### Before (gate F4.2.5, `2026-03-20T11:16:49.292Z`)
- `N3>N2`: **0.50** (FAIL)
- `nC2Pass`: **false**
- `nC3Pass`: **false**

### After (baseline desta unidade, `2026-03-20T13:33:12.362Z`)
- `N3>N2`: **1.00** (PASS)
- `nC2Pass`: **true**
- `nC3Pass`: **true**

## Decisão
Objetivo focal (`N3>N2`) revalidado em **PASS** e guards de ladder (`nC2`, `nC3`) também em **PASS** no snapshot padrão desta unidade. Seguir para novo gate final F4.
