# F4 Gate Final — Reexecução pós-ajuste de ruído (NEXT-F4.2.10)

Data: 2026-03-21T04:17Z  
Task: NEXT-F4.2.10 (`docs/agents/plans/f4-calibracao-dificuldade.md`)

## Mudança de parâmetros do gate (before/after)

Fonte do before: `scripts/hardening-f3_2.ts` em `91cec70`.

- `gamesPerMirror`: **1 -> 2**
- `maxPliesPerGame`: **32 -> 48**

Aplicado em ambos os baselines lite do hardening:
- Dominório (`DOMINORIO_GAMES_PER_MIRROR`, `DOMINORIO_MAX_PLIES`)
- Atari Go (`ATARIGO_GAMES_PER_MIRROR`, `ATARIGO_MAX_PLIES`)

## Evidência de execução

Comando consolidado:

```bash
bun run hardening:f3.2
```

Snapshot deste gate:
- `artifacts/hardening/f3.2/latest/summary.json` (`generatedAt=2026-03-21T04:17:13.103Z`)
- `artifacts/dominorio-baseline/latest/baseline.md` (`generatedAt=2026-03-21T04:16:49.139Z`)
- `artifacts/atari-go-baseline/latest/baseline.json` (`generatedAt=2026-03-21T04:17:13.077Z`)

Checks do pipeline:
- `aggregate.ok=true` (4/4 checks pass na execução técnica)
- testes `v1-adapter` de Dominório e Atari Go: **PASS**
- `baseline:dominorio` e `baseline:atari-go`: **PASS** (execução técnica)

## Estado dos critérios de saída da F4

Referência: `docs/agents/ROADMAP-CRJM.md` (T1>=60%, T4<=15%).

### Dominório (T1/T4)
- T1: **FAIL**
  - `N2>N1=100.0%` (PASS)
  - `N3>N2=100.0%` (PASS)
  - `N4>N3=100.0%` (PASS)
  - `N5>N4=0.0%` (FAIL)
  - Fonte: `artifacts/dominorio-baseline/latest/baseline.md`
- T4: **FAIL**
  - `T4=50.0%` divergência (`t4Pass=false`)
  - Fonte: `artifacts/dominorio-baseline/latest/baseline.md`

### Atari Go (ladder)
- T1 ladder >= 60%: **FAIL**
  - `N2>N1=100%` (PASS)
  - `N3>N2=100%` (PASS)
  - `N4>N3=0%` (FAIL)
  - `N5>N4=0%` (FAIL)
  - Fonte: `artifacts/atari-go-baseline/latest/baseline.json`
- nC2: **FAIL**
- nC3: **FAIL** (contagem monotónica cumpre mínimo, mas `passAll=false` por níveis em FAIL)

## Decisão explícita do gate F4

**FAIL — gate final F4 continua não aprovado após redução de ruído do gate lite.**

## Próxima unidade mínima proposta

Abrir `NEXT-F4.2.11` focado apenas no gap remanescente de topo em Atari Go (`N4>N3` e `N5>N4`) com ajuste mínimo de ladder, preservando `N2>N1` e `N3>N2`.

---

## Addendum — F4 cirurgia Phase A (2026-03-21)

- Gate/hardening alinhado com `EVALUATION-MATRIX` por família:
  - Dominório T1 por par: `60/58/56/54`
  - Atari Go T1 por par: `62/60/57/55`
  - T4 Dominório no baseline atualizado para `<=15%`
- Protocolo com seed fixa adicionado ao hardening e baselines (`DOMINORIO_SEED`, `ATARIGO_SEED`; Atari Go também com `--seed`).
- `gamesPerMirror` default do gate aumentado para `10` (mantendo override por env para execução rápida local).

Nota de ambiguidade resolvida:
- A exigência de seed no caminho Dominório foi aplicada via `seed` no contrato `AIRequestV1` propagado pelo baseline/hardening (em vez de criar novo modo dedicado), por ser a opção mais alinhada com a KB e com patch mínimo.
