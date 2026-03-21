# F4 Phase C — Gate Final (KB-aligned)

Data: 2026-03-21
Plano: `docs/agents/plans/f4-cirurgia-gate-fix.md`

## Execução

Comando executado:

```bash
DOMINORIO_GAMES_PER_MIRROR=10 ATARIGO_GAMES_PER_MIRROR=10 bun run hardening:f3.2
```

Seed efetiva do hardening: `20260321` (Dominório e Atari Go, defaults do script).

Artefactos desta corrida:
- `artifacts/hardening/f3.2/2026-03-21T10-44-22/summary.json`
- `artifacts/dominorio-baseline/2026-03-21T10-31-59/`
- `artifacts/atari-go-baseline/2026-03-21T10-44-22/baseline.json`

## Validação contra critérios F4 (KB-aligned)

### Amostra mínima
- Regra: `>=10 gamesPerMirror`
- Resultado: **PASS** (`10`)

### Dominório T1 (thresholds 60/58/56/54)
- `N2>N1`: 50% (10/20) vs `>=60%` -> **FAIL**
- `N3>N2`: 100% (20/20) vs `>=58%` -> **PASS**
- `N4>N3`: 100% (20/20) vs `>=56%` -> **PASS**
- `N5>N4`: 50% (10/20) vs `>=54%` -> **FAIL**

### Atari Go T1 (thresholds 62/60/57/55)
- `N2>N1`: 90% (18/20) vs `>=62%` -> **PASS**
- `N3>N2`: 95% (19/20) vs `>=60%` -> **PASS**
- `N4>N3`: 100% (20/20) vs `>=57%` -> **PASS**
- `N5>N4`: 90% (18/20) vs `>=55%` -> **PASS**

### T4 (seed fixa; <=15%)
- Dominório: divergência `0%` (0/240) -> **PASS**
- Atari Go: sem métrica T4 explícita neste baseline (`n/a` no schema atual) -> **N/A**

### B1 (assimetria start/second <=10pp)
- Dominório:
  - `N2>N1`: 100% (start) vs 0% (second), assimetria **100pp** -> **FAIL**
  - `N3>N2`: 100% vs 100%, assimetria **0pp** -> PASS
  - `N4>N3`: 100% vs 100%, assimetria **0pp** -> PASS
  - `N5>N4`: 0% vs 100%, assimetria **100pp** -> **FAIL**
- Atari Go (derivado de `gameRuns`):
  - `N2>N1`: 80% (start) vs 100% (second), assimetria **20pp** -> **FAIL**
  - `N3>N2`: 100% vs 90%, assimetria **10pp** -> PASS (limite)
  - `N4>N3`: 100% vs 100%, assimetria **0pp** -> PASS
  - `N5>N4`: 100% vs 80%, assimetria **20pp** -> **FAIL**
- Decisão B1: **FAIL**

## Decisão do gate F4

Resultado global: **FAIL**.

Motivos de bloqueio:
1. Dominório não cumpre T1 em `N2>N1` e `N5>N4`.
2. Critério B1 falha em ambos os jogos (assimetria >10pp em pares críticos).

Nota: checks técnicos do hardening (`aggregate.ok=true`) passaram, mas isso não equivale a aprovação do gate F4 pelos critérios do plano.
