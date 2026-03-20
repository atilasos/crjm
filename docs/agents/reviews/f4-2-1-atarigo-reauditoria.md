# F4.2.1 — Reauditoria Atari Go (ladder)

Data: 2026-03-20  
Escopo: `docs/agents/plans/f4-calibracao-dificuldade.md` (F4.2.1)

## Fontes auditadas
- `artifacts/atari-go-baseline/latest/baseline.json`
- `scripts/atari-go-ladder-baseline.ts`

## 1) Pares/níveis que causam `nC2Pass=false`

Em `baseline.json`, `nC2.passAll=false` com `failedPairs`:
- `N2>N1` (winrate do nível mais forte: `0.00`, `draws=2/2`)
- `N3>N2` (winrate do nível mais forte: `0.00`, `draws=2/2`)
- `N4>N3` (winrate do nível mais forte: `0.00`, `draws=2/2`)
- `N5>N4` (winrate do nível mais forte: `0.00`, `draws=2/2`)

Leitura direta: toda a ladder está achatada por empates (`draw-timeout`) no snapshot atual (`maxPliesPerGame=32`, `games=8`).

## 2) Níveis fora de budget que causam `nC3Pass=false`

Em `baseline.json`, `nC3.passAll=false` e `failedLevels=[1,2,3,4,5]` (todos falham `t2Pass`).

| Nível | p50 (ms) | budget (ms) | excesso p50 (ms) | razão p50/budget |
| --- | ---: | ---: | ---: | ---: |
| N1 | 51.70 | 5 | +46.70 | 10.34x |
| N2 | 54.57 | 13 | +41.57 | 4.20x |
| N3 | 62.47 | 25 | +37.47 | 2.50x |
| N4 | 61.43 | 50 | +11.43 | 1.23x |
| N5 | 308.98 | 100 | +208.98 | 3.09x |

Além do budget, há um passo não monotónico em `monotonicSteps`:
- `N3 -> N4`: `62.47ms -> 61.43ms` (`pass=false`)

## 3) Hipótese única e prioritária (ajuste mínimo, mensurável)

Hipótese prioritária para F4.2.2:

**Introduzir um único parâmetro de ladder `evalCapByLevel` no `chooseMove` para limitar quantos candidatos entram em `simulateMove` por nível (N1..N5), mantendo o mesmo schema de output do baseline.**

Racional técnico (com base no script atual):
- Hoje `scoreMoves` simula **todas** as jogadas legais em todos os níveis, comprimindo tempos entre N1..N4 e estourando budget em todos os níveis.
- Com cap por nível, reduzimos custo em níveis baixos/médios e criamos separação operacional explícita entre N2 e N3 sem refactor estrutural.

Critério de aceitação mensurável desta hipótese (alvo local F4.2):
- `nC3.failedLevels` deixa de conter pelo menos `N3` e `N4`.
- `monotonicSteps` mantém no mínimo `3/4` passos válidos (sem regressão).
- `N3>N2` melhora para `strongerWinrate >= 0.55` no snapshot padrão.

## Observações de risco
- O snapshot atual usa `gamesPerMirror=1`; os resultados de `nC2` têm alta variância e muito empate por timeout.
- Esta unidade não altera código de produção nem contrato de output; apenas fixa diagnóstico e alvo para a próxima execução (F4.2.2).
