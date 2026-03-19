# F4 — Dominório calibração pós-ajuste (Task 3)

Data: 2026-03-19
Escopo: `docs/agents/plans/f4-calibracao-dificuldade.md` — Task 3

## Baselines comparados
- **Anterior (HEAD)**: `artifacts/dominorio-baseline/latest/baseline.json` em `HEAD` (`generatedAt: 2026-03-19T13:18:49.266Z`)
- **Atual (working tree)**: `artifacts/dominorio-baseline/latest/baseline.json` (`generatedAt: 2026-03-19T14:21:10.675Z`)

## Resultado comparativo T1–T4

### T1 — Ladder N+1 > N (target >= 60%)
- `N2 > N1`: **PASS** (50.0% -> 100.0%)
- `N3 > N2`: **FAIL** (100.0% -> 50.0%)
- `N4 > N3`: **FAIL** (100.0% -> 50.0%)
- `N5 > N4`: **FAIL** (50.0% -> 50.0%)

**Estado T1 global:** **FAIL** (3/4 pares falham no baseline atual).

### T2 — Budget/latência p50/p95
- Falhas por nível: **N2** no baseline anterior e no atual.
- Sem melhoria líquida no agregado (`prev failures: 2` -> `cur failures: 2`).

**Estado T2 global:** **FAIL**.

### T3 — Legalidade de jogadas
- `prev`: PASS (0.00% inválidas)
- `cur`: PASS (0.00% inválidas)

**Estado T3 global:** **PASS**.

### T4 — Estabilidade/repetibilidade
- `prev`: 52.17% divergência (**FAIL**)
- `cur`: 50.00% divergência (**FAIL**)

**Estado T4 global:** **FAIL** (alvo da fase F4: <= 15%).

## Evidência de execução (comandos)
- `node` (comparação `HEAD` vs baseline atual):
  - `T1 N2>N1: prev 50.0% (FAIL) -> cur 100.0% (PASS)`
  - `T1 N3>N2: prev 100.0% (PASS) -> cur 50.0% (FAIL)`
  - `T1 N4>N3: prev 100.0% (PASS) -> cur 50.0% (FAIL)`
  - `T1 N5>N4: prev 50.0% (FAIL) -> cur 50.0% (FAIL)`
  - `T2 failures: prev 2 -> cur 2`
  - `T3: prev PASS (0.00% invalid) -> cur PASS (0.00% invalid)`
  - `T4: prev 52.17% (FAIL) -> cur 50.00% (FAIL)`
- `stat` dos artefatos `latest` confirma snapshot atual com mtime `2026-03-19 14:21:10`.

## Conclusão
Task 3 concluída em termos de artefatos + comparação formal. A calibração ainda não cumpre os critérios de saída da F4; próximo passo continua em Task 4 (ajuste incremental Atari Go ladder), salvo decisão de retomar ajuste Dominório.
