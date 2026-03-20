# F4.2.3 — Atari Go ladder recalibração report

Data: 2026-03-20
Repo: `/Users/igor/dev/crjm`
Task: F4.2.3
Baseline executado: `bun run baseline:atari-go`
Snapshot analisado: `artifacts/atari-go-baseline/latest/baseline.json`
GeneratedAt do snapshot: `2026-03-20T07:30:07.732Z`

## Estado pós-ajuste

- `nC2Pass`: **true** (`failedPairs: []`)
- `nC3Pass`: **false** (`failedLevels: [3]`; monotonicidade `4/4` passos)

## Tendência T1 ladder (meta >= 60%)

- `N2 > N1`: **100%** (10/10)
- `N3 > N2`: **100%** (10/10)
- `N4 > N3`: **100%** (10/10)
- `N5 > N4`: **100%** (10/10)

Conclusão T1 ladder: **PASS** (todos os pares >= 60%).

## Observação N-C3 (estabilidade de budget/tempo)

- Nível 3 em `t2ByLevel`:
  - `p50=25.3ms`
  - `p95=80.11ms`
  - regra local `p95 <= max(p50*3, 1)` falha (`80.11 > 75.9`)
- Resultado: `nC3.passAll=false` por falha isolada do nível 3.

## Decisão explícita de desbloqueio F4

**Decisão: iterar F4.2 (não voltar ainda à Task 5 hardening final).**

Justificação: apesar de `nC2Pass=true` e T1 ladder >=60% em todos os pares, o critério `nC3Pass` permanece em FAIL no snapshot oficial pós-ajuste.
