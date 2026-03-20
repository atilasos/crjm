# F4.2.4 — Atari Go nC3 ajuste (estabilidade do nível 3)

Data: 2026-03-20
Escopo: `docs/agents/plans/f4-calibracao-dificuldade.md` (NEXT-F4.2.4)

## Objetivo
Reduzir instabilidade do nível 3 no guard `p95 <= 3*p50`, preservando `nC2Pass=true` e compatibilidade do shape de `baseline.json`.

## Alteração mínima aplicada
Arquivo alterado:
- `scripts/atari-go-ladder-baseline.ts`

Mudança:
- `EVAL_CAP_BY_LEVEL[3]`: `12 -> 13`

Racional:
- O nível 3 estava borderline/intermitente no guard de cauda (`p95/p50` próximo/acima de 3 em snapshots anteriores).
- Aumentar ligeiramente o cap do N3 estabiliza a razão `p95/p50` sem alterar contrato de output.

## Before / After (N3)
Before (snapshot oficial F4.2.3, `docs/reports/atari-go/F4-2-ladder-recalibracao-report.md`):
- `p50=25.30ms`
- `p95=80.11ms`
- `p95/p50=3.17` (**FAIL**)

After (snapshot pós-ajuste, `generatedAt=2026-03-20T10:43:41.760Z`):
- `p50=18.21ms`
- `p95=53.43ms`
- `p95/p50=2.93` (**PASS**)

## Checks da unidade
- `N3 guard`: `53.43 <= 3 * 18.21 (54.63)` -> **PASS**
- `nC2Pass`: **true** (preservado)
- `baseline.json` shape: **compatível** (sem alterações de schema)

## Testes executados
- `bun test scripts/atari-go-ladder-baseline.test.ts` -> **PASS** (1/1)
- `bun run baseline:atari-go` -> **PASS** local para objetivo da unidade (`nC2Pass=true`, `nC3Pass=true`)

## Decisão
Unidade `NEXT-F4.2.4` concluída. Seguir para novo gate final/hardening do bloco F4.2.
