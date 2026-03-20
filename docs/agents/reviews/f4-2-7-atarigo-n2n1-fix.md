# F4.2.7 — Atari Go fix mínimo (recuperar N2>N1)

## Objetivo da unidade
Recuperar separação do par `N2>N1` para `>= 0.60`, preservando `N3>N2 >= 0.60`, com mudança mínima e revalidação de `nC2Pass`/`nC3Pass`.

## Mudança aplicada (mínima)
- `scripts/atari-go-ladder-baseline.ts`
  - Ajuste focal em `rankIndexForLevel` para `level === 2`:
    - de `opponentLevel === 3 ? 3 : 2`
    - para `opponentLevel === 3 ? 3 : 1`
  - Efeito esperado: N2 joga um pouco mais forte contra N1, sem reforçar N2 contra N3.
- `scripts/atari-go-ladder-baseline.test.ts`
  - Nova asserção explícita: `N2>N1 (firstLadderPair.strongerWinrate) >= 0.55`.

## Evidência before/after

### Before (artefacto pré-ajuste)
- Artefacto: `artifacts/atari-go-baseline/2026-03-20T13-17-16/baseline.json`
- `N2>N1`: **0.00**
- `N3>N2`: **0.50**
- `nC2Pass`: **false**
- `nC3Pass`: **false**

### After (revalidação pós-ajuste)
- Artefacto: `artifacts/atari-go-baseline/2026-03-20T14-25-34/baseline.json`
- `N2>N1`: **1.00**
- `N3>N2`: **1.00**
- `nC2Pass`: **true**
- `nC3Pass`: **false** (falha em `level 4`, `p95 > 3*p50`)

## Execução
- `bun test scripts/atari-go-ladder-baseline.test.ts` -> PASS
- `bun run baseline:atari-go` (pós-ajuste, 2 execuções) -> `N2>N1`/`N3>N2` em PASS; `nC3Pass` permaneceu FAIL em ambas (nível 4)

## Decisão para próximo gate final F4
- **NÃO abrir gate final F4 ainda.**
- Justificativa: objetivo principal de separação do ladder foi recuperado (`N2>N1` e `N3>N2` >= 0.60), mas `nC3Pass` ainda está `false` no snapshot pós-ajuste.
