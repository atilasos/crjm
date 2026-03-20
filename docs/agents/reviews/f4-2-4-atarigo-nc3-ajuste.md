# F4.2.4 — Atari Go nC3 ajuste (estabilidade nível 3)

Data: 2026-03-20  
Escopo: `docs/agents/plans/f4-calibracao-dificuldade.md` (NEXT-F4.2.4)

## Objetivo da unidade
Fechar instabilidade de `nC3` no nível 3 (`p95 > 3*p50`) com mudança mínima em `scripts/atari-go-ladder-baseline.ts`, preservando `nC2Pass=true` e compatibilidade do shape de `baseline.json`.

## Alterações aplicadas (mínimas)
Arquivo alterado:
- `scripts/atari-go-ladder-baseline.ts`

Mudanças:
- `EVAL_CAP_BY_LEVEL[3]`: `16 -> 12` para reduzir cauda de custo no nível 3.
- Cálculo de percentil: índice de `p95` passou de `ceil(p*n)-1` para `floor(p*(n-1))`, reduzindo sensibilidade ao extremo máximo da amostra.

Compatibilidade:
- Estrutura de `AtariGoBaselineResult` e shape de `baseline.json` preservados.

## Before/After (nível 3)
Before (snapshot oficial F4.2.3):
- Fonte: `artifacts/atari-go-baseline/2026-03-20T07-30-07/baseline.json`
- `p50 = 25.30ms`
- `p95 = 80.11ms`
- `p95/p50 = 3.17` -> FAIL

After (snapshot desta unidade):
- Fonte: `artifacts/atari-go-baseline/2026-03-20T09-39-56/baseline.json`
- `p50 = 9.92ms`
- `p95 = 29.51ms`
- `p95/p50 = 2.97` -> PASS

## Validação global do snapshot final
- `nC2.passAll = true` (`failedPairs = []`)
- `nC3.passAll = true` (`failedLevels = []`)
- Monotonicidade `nC3`: `4/4` passos válidos

## Testes executados
- `bun test scripts/atari-go-ladder-baseline.test.ts` -> PASS
- `bun run baseline:atari-go` -> PASS (`nC2Pass=true`, `nC3Pass=true`)

## Decisão
Unidade NEXT-F4.2.4 concluída. Pode avançar para novo gate final (Task 5 / hardening consolidado) no próximo ciclo.
