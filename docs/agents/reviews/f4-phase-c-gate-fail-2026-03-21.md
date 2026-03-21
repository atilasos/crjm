# F4 Phase C — Residual Gaps (FAIL)

Data: 2026-03-21
Referência: `docs/agents/plans/f4-cirurgia-gate-fix.md`

## Veredito

**FAIL** no gate F4 com protocolo final (`gamesPerMirror=10`, seed fixa).

## Gaps residuais

1. **Dominório T1 não monotónico nos extremos**
- `N2>N1 = 50%` (threshold: `>=60%`) -> FAIL
- `N5>N4 = 50%` (threshold: `>=54%`) -> FAIL

2. **B1 sem evidência formal de conformidade**
- Campo `b1` vem `null` nos dois baselines.
- Dominório apresenta split start/second altamente assimétrico em pares críticos.
- Atari Go baseline atual não expõe split start/second por par.

3. **T4 parcial por jogo**
- Dominório T4 passou (`0%` <= `15%`).
- Atari Go não publica T4 equivalente no schema atual, impedindo validação simétrica do critério para ambos.

## Evidência usada

- `artifacts/hardening/f3.2/2026-03-21T10-44-22/summary.json`
- `artifacts/dominorio-baseline/2026-03-21T10-31-59/baseline.json`
- `artifacts/atari-go-baseline/2026-03-21T10-44-22/baseline.json`

## Nota para Igor

Conforme instrução da Phase C, não foram abertos novos loops F4.2.x.
A recomendação é tratar este resultado como bloqueio formal para conclusão de F4 até os gaps acima serem fechados e revalidados.
