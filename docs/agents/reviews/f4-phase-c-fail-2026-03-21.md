# F4 Phase C — Review de Fecho (FAIL)

Data: 2026-03-21  
Plano: `docs/agents/plans/f4-cirurgia-gate-fix.md`  
Execução: `DOMINORIO_GAMES_PER_MIRROR=10 ATARIGO_GAMES_PER_MIRROR=10 bun run hardening:f3.2`

## Artefactos base

- `artifacts/hardening/f3.2/2026-03-21T10-44-22/summary.json`
- `artifacts/dominorio-baseline/2026-03-21T10-31-59/baseline.json`
- `artifacts/atari-go-baseline/2026-03-21T10-44-22/baseline.json`
- Consolidado: `docs/reports/hardening/F4-phase-c-gate-2026-03-21.md`

## Resultado contra critérios KB-aligned

- Amostra mínima (`gamesPerMirror>=10`): **PASS**
- Dominório T1 (60/58/56/54): **FAIL**
  - `N2>N1=50%` (**FAIL**)
  - `N3>N2=100%` (PASS)
  - `N4>N3=100%` (PASS)
  - `N5>N4=50%` (**FAIL**)
- Atari Go T1 (62/60/57/55): **PASS** (90%/95%/100%/90%)
- T4 (<=15%, seed fixa): Dominório **PASS** (`0%`)
- B1 (<=10pp): **FAIL**
  - Dominório: assimetria de 100pp em `N2>N1` e `N5>N4`
  - Atari Go: assimetria de 20pp em `N2>N1` e `N5>N4`

## Gaps residuais (sem re-spawn de loops)

1. Dominório mantém quebra de monotonia nas extremidades da ladder (`N2>N1`, `N5>N4`) sob seed fixa e amostra mínima correta.
2. Critério B1 continua fora da meta em pares críticos nos dois jogos.
3. F4 não reúne condições de fecho e não deve avançar automaticamente para F5 neste estado.

## Decisão

**F4 = FAIL (não concluída).**  
Relatar a Igor como bloqueio explícito de gate, sem abrir nova sequência automática de micro-iterações.
