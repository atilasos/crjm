# F4.1.3 — Dominório baseline regenerado e gate local

Data: 2026-03-20  
Task: F4.1.3 (`docs/agents/plans/f4-calibracao-dificuldade.md`)

## Execução

Comando executado:

```bash
DOMINORIO_GAMES_PER_MIRROR=4 DOMINORIO_MAX_PLIES=48 DOMINORIO_BUDGET_SCALE=0.05 bun run baseline:dominorio
```

Artefactos atualizados:
- `artifacts/dominorio-baseline/2026-03-20T05-31-25/`
- `artifacts/dominorio-baseline/latest/`

## T1 por pares (target >= 60%)

| Par | Winrate | Status |
| --- | ---: | --- |
| `N2 > N1` | 50.0% | **FAIL** |
| `N3 > N2` | 100.0% | **PASS** |
| `N4 > N3` | 75.0% | **PASS** |
| `N5 > N4` | 50.0% | **FAIL** |

Resumo T1: **FAIL** (`2/4` pares em PASS)

## T4 estabilidade (target <= 15%)

- Divergência observada: **39.76%** (`66/166`)
- Status: **FAIL**

## Before/After vs baseline conhecido anterior

Baseline anterior conhecido (`HEAD` em `artifacts/dominorio-baseline/latest/baseline.json`):
- `generatedAt`: `2026-03-20T01:15:53.748Z`
- `options`: `gamesPerMirror=1`, `t4ProbeEveryPly=12`, `maxPliesPerGame=32`, `budgetScale=0.05`

Baseline atual:
- `generatedAt`: `2026-03-20T05:31:25.586Z`
- `options`: `gamesPerMirror=4`, `t4ProbeEveryPly=6`, `maxPliesPerGame=48`, `budgetScale=0.05`

| Métrica | Antes | Depois | Delta |
| --- | ---: | ---: | ---: |
| `N2 > N1` | 50.0% | 50.0% | +0.0 pp |
| `N3 > N2` | 100.0% | 100.0% | +0.0 pp |
| `N4 > N3` | 50.0% | 75.0% | +25.0 pp |
| `N5 > N4` | 50.0% | 50.0% | +0.0 pp |
| `T4 divergência` | 45.83% | 39.76% | -6.07 pp |

Nota: o report anterior `docs/reports/dominorio/F4-calibracao-report.md` também já indicava FAIL de T1/T4; este run confirma melhoria parcial (N4>N3 e T4), mas sem fechar gate.

## Decisão do gate local F4.1

- **F4.1: FAIL**
- Evidência: T1 continua com 2 pares abaixo de 60% (`N2>N1`, `N5>N4`) e T4 permanece acima de 15%.

Próximo passo pequeno sugerido:
- Ajustar apenas a política de desempate/seleção no topo para `N5` (reduzir simetria com `N4`) e reexecutar baseline com os mesmos parâmetros para medir impacto direto em `N5>N4` e T4.
