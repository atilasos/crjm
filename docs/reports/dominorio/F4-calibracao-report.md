# F4 Task 3 — Baseline Dominório pós-ajuste

Data: 2026-03-19
Task: F4 / Task 3 (`docs/agents/plans/f4-calibracao-dificuldade.md`)

## Execução do baseline

Comando executado:

```bash
DOMINORIO_GAMES_PER_MIRROR=4 DOMINORIO_MAX_PLIES=48 bun run baseline:dominorio
```

Artefactos gerados:
- `artifacts/dominorio-baseline/2026-03-19T23-32-20/`
- `artifacts/dominorio-baseline/latest/`

## Comparação com baseline anterior

Baseline atual:
- `generatedAt`: `2026-03-19T23:32:20.280Z`
- options: `gamesPerMirror=4`, `t4ProbeEveryPly=6`, `maxPliesPerGame=48`, `budgetScale=1`

Baseline anterior (em `HEAD`):
- `generatedAt`: `2026-03-19T14:21:10.675Z`
- options: `gamesPerMirror=1`, `t4ProbeEveryPly=12`, `maxPliesPerGame=32`, `budgetScale=0.05`

Nota: os parâmetros do harness são diferentes entre os dois snapshots; a comparação abaixo é informativa, não estritamente “apples-to-apples”.

## T1–T4 (PASS/FAIL explícito)

### T1 — Ladder N+1 vs N (target >= 60%)

Status global atual: **FAIL** (2/4 pares PASS)

- `N2 > N1`: 50.0% (**FAIL**) | anterior: 100.0% (**PASS**) | delta: -50.0 pp
- `N3 > N2`: 100.0% (**PASS**) | anterior: 50.0% (**FAIL**) | delta: +50.0 pp
- `N4 > N3`: 87.5% (**PASS**) | anterior: 50.0% (**FAIL**) | delta: +37.5 pp
- `N5 > N4`: 25.0% (**FAIL**) | anterior: 50.0% (**FAIL**) | delta: -25.0 pp

### T2 — Latência por nível (target p50 <= budget e p95 <= 2x p50)

Status global atual: **FAIL** (0/5 níveis PASS)

- `N1`: p50 6.74ms / p95 100.34ms (**FAIL**) | anterior: 4.38 / 6.42 (**PASS**)
- `N2`: p50 8.78ms / p95 181.17ms (**FAIL**) | anterior: 4.52 / 13.47 (**FAIL**)
- `N3`: p50 195.89ms / p95 501.19ms (**FAIL**) | anterior: 25.13 / 26.05 (**PASS**)
- `N4`: p50 1000.16ms / p95 1001.07ms (**FAIL**) | anterior: 50.12 / 51.19 (**PASS**)
- `N5`: p50 2000.15ms / p95 2001.02ms (**FAIL**) | anterior: 100.12 / 100.81 (**PASS**)

### T3 — Legalidade de jogadas (target 100% legal)

Status atual: **PASS**

- atual: `0` jogadas inválidas em `919` decisões (0.00%)
- anterior: `0` jogadas inválidas em `243` decisões (0.00%)
- comparação: sem regressão

### T4 — Estabilidade / repetibilidade (target <= 5% divergência)

Status atual: **FAIL**

- atual: 44.51% divergência (`73/164`)
- anterior: 50.00% divergência (`12/24`)
- delta: -5.49 pp (melhoria, mas ainda muito acima do target)

## Conclusão da Task 3

- Baseline Dominório pós-ajuste foi gerado e versionado em artifacts.
- Relatório F4 criado com T1–T4 explícitos e comparação contra baseline anterior.
- Resultado geral da calibração no snapshot atual: **ainda não atinge o critério de pronto da F4 para Dominório** (T1 e T4 falham; T2 também falha neste run).
