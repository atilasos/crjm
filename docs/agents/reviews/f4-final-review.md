# F4 Gate Final — Reexecução pós-F4.2.8 (NEXT-F4.2.9)

Data: 2026-03-21T00:15Z
Task: NEXT-F4.2.9 (`docs/agents/plans/f4-calibracao-dificuldade.md`)

## Evidência de execução

Comando consolidado:

```bash
bun run hardening:f3.2
```

Snapshot deste gate:
- `artifacts/hardening/f3.2/latest/summary.json` (`generatedAt=2026-03-21T00:15:33.462Z`)
- `artifacts/dominorio-baseline/latest/baseline.md` (`generatedAt=2026-03-21T00:15:18.004Z`)
- `artifacts/atari-go-baseline/latest/baseline.json` (`generatedAt=2026-03-21T00:15:33.444Z`)

Checks do pipeline:
- `aggregate.ok=true` (4/4 checks pass na execução técnica)
- testes `v1-adapter` de Dominório e Atari Go: **PASS**
- `baseline:dominorio` e `baseline:atari-go`: **PASS** (execução técnica)

## Estado dos critérios de saída da F4

Referência: `docs/agents/ROADMAP-CRJM.md` (T1>=60%, T4<=15%).

### Dominório (evidência explícita T1 e T4)
- T1 (`N2>N1`, `N3>N2`, `N4>N3`, `N5>N4` >= 60%): **FAIL**
  - `N2>N1=50.0%` (FAIL)
  - `N3>N2=100.0%` (PASS)
  - `N4>N3=100.0%` (PASS)
  - `N5>N4=50.0%` (FAIL)
  - Fonte: `artifacts/dominorio-baseline/latest/baseline.md` + `dominorioBaseline.t1.failedPairs=["N2>N1","N5>N4"]`
- T4 (estabilidade <= 15% divergência): **FAIL**
  - `T4=45.83%` divergência (`t4Pass=false`)
  - Fonte: `artifacts/dominorio-baseline/latest/baseline.md` + `dominorioBaseline.t4Pass=false`

### Atari Go (ladder consolidado)
- T1 ladder >= 60%: **FAIL**
  - `N2>N1=100%` (PASS)
  - `N3>N2=100%` (PASS)
  - `N4>N3=0%` (FAIL — 2 draws)
  - `N5>N4=0%` (FAIL — 2 draws)
  - Fonte: `artifacts/atari-go-baseline/latest/baseline.json` + `atariGoBaseline.t1.failedPairs=["N4>N3","N5>N4"]`
- nC2: **FAIL**
- nC3: **FAIL** (`failedLevels=[5]`)

## Decisão explícita do gate F4

**FAIL — gate final F4 não aprovado nesta reexecução.**

Justificativa objetiva:
1. T1 global falha (Dominório: `N2>N1`, `N5>N4`; Atari Go: `N4>N3`, `N5>N4`)
2. T4 global falha em Dominório (`45.83%` > `15%`)

## Próxima unidade mínima

Manter F4 ativa e abrir unidade focada no gap remanescente de robustez do gate lite (amostra curta e timeout em níveis altos), preservando escopo incremental.
