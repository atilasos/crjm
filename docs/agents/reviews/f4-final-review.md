# F4 Task 5 — Hardening final e decisão de fase (reexecução pós-F4.2.4)

Data: 2026-03-20  
Task: NEXT-F4.2.5 (`docs/agents/plans/f4-calibracao-dificuldade.md`)

## Evidência de execução

Comando consolidado:

```bash
bun run hardening:f3.2
```

Snapshot deste gate:
- `artifacts/hardening/f3.2/latest/summary.json` (`generatedAt=2026-03-20T11:16:49.314Z`)
- `artifacts/dominorio-baseline/latest/baseline.md` (`generatedAt=2026-03-20T11:16:32.957Z`)
- `artifacts/atari-go-baseline/latest/baseline.json` (`generatedAt=2026-03-20T11:16:49.292Z`)

Checks do pipeline:
- `aggregate.ok=true`
- testes `v1-adapter` de Dominório e Atari Go: **PASS**
- `baseline:dominorio` e `baseline:atari-go`: **PASS** (execução técnica)

## Estado dos critérios de saída da F4

Referência: `docs/agents/ROADMAP-CRJM.md` (T1>=60%, T4<=15%).

### Dominório (T1/T4)
- T1 (`N2>N1`, `N3>N2`, `N4>N3`, `N5>N4` >= 60%): **FAIL**
  - `N2>N1=50%` (FAIL)
  - `N3>N2=100%` (PASS)
  - `N4>N3=50%` (FAIL)
  - `N5>N4=50%` (FAIL)
- T4 (divergência <= 15%): **FAIL**
  - `34.78%` divergência (`8/23`) em `artifacts/dominorio-baseline/latest/baseline.md`

### Atari Go (critérios ladder relevantes)
- T1 ladder >= 60%: **FAIL**
  - `N2>N1=100%` (PASS)
  - `N3>N2=50%` (FAIL)
  - `N4>N3=0%` (FAIL)
  - `N5>N4=0%` (FAIL)
- N-C2: **FAIL** (`nC2.passAll=false`, `failedPairs=["N3>N2","N4>N3","N5>N4"]`)
- N-C3: **FAIL** (`nC3.passAll=false`, `failedLevels=[5]`)

### Baseline atualizado/publicado
- **PASS**: snapshots `latest` de Dominório e Atari Go foram atualizados no run.

## Decisão explícita do gate F4

**FAIL — F4 continua não concluída.**

Causa objetiva do FAIL neste gate:
- Dominório ainda viola T1 (3 pares) e T4 (>15%).
- Atari Go voltou a falhar em separação ladder (`nC2`) e budget por nível (`nC3` no nível 5).

Próxima unidade mínima:
- abrir `NEXT-F4.2.6` no roadmap para correção focalizada no primeiro par em regressão (N3>N2) e revalidação do ladder antes de novo gate final.
