# All-Games Maturity Matrix — CRJM

Data: 2026-07-10 (auditoria crítica)

## Estado técnico e pedagógico por jogo

| Jogo | Engine principal | Adapter V1 | Tutor UI | Quick Review | Highlights tabuleiro | Gamification | Estado |
|---|---|---|---|---|---|---|---|
| Dominório | worker/WASM + TS + livro | ✅ | ✅ | ✅ | ✅ ring-amber | ✅ | **pronto para treino; topo requer amostra maior** |
| Atari Go | worker/WASM + fallback TS | ✅ | ✅ | ✅ (turning point) | ✅ border-amber | ✅ | **pronto para treino** |
| Quelhas | worker/WASM + fallback TS | ✅ | ✅ | ✅ | ✅ ring-amber | ✅ | **pronto para treino; ladder 4/4** |
| Gatos & Cães | worker + fallback TS | ✅ | ✅ | ✅ | ✅ ring-amber | ✅ | **pronto para treino** |
| Produto | worker/WASM + fallback TS | ✅ | ✅ | ✅ | ✅ stroke-amber SVG | ✅ | **pronto para treino** |
| Nex | worker/WASM + fallback TS | ✅ | ✅ | ✅ | ✅ stroke-amber SVG | ✅ | **pronto para treino; N5>N4 não demonstrado** |

## Leitura rápida (2026-07-10)

Todos os 6 jogos atingiram paridade visual/pedagógica mínima:
- adapter V1 com pedagogy, topMoves, criticalThreats
- TutorHintCard + TopMovesRail
- Quick review pós-jogo com XP reward
- Highlights visuais da jogada recomendada no tabuleiro
- Integração com gamificação individual baseada em evidência (XP, missões, conquistas, padrões e puzzles)

Desde a auditoria crítica:
- Gatos & Cães passou para worker-first com cancelamento e fallback;
- os seis jogos usam budgets comuns de 100/250/500/1000/2000 ms;
- existem 29 conquistas alcançáveis, 23 cartões de padrão, 8 missões individuais idempotentes e 18 puzzles jogáveis;
- o streak tem um escudo automático semanal e o perfil mostra missões reclamadas e conquistas por categoria;
- Nex cobre as três convenções raras de fim descritas pelo autor;
- há harness transversal de latência/legalidade e ladder, com resultados não monotónicos publicados;
- o smoke interactivo passou nos seis jogos e no laboratório em desktop, tablet e telemóvel (21 percursos).

## Known Limitations

- **Ladder**: amostras de 2–6 partidas por par são regressão rápida, não prova estatística; Dominório e Nex ainda oscilam num par adjacente de topo.
- **Produto e Nex**: o fallback TS é heurístico; “N5” não significa jogo perfeito.
- **Workers/WASM**: o harness Bun mede o fallback; o smoke browser valida carregamento/uso da experiência empacotada, mas ainda não publica p95 específico do worker.
- **Validação de sala de aula**: ainda não foi recolhida; os critérios pedagógicos P1–P10 não têm amostra com alunos.

## Critérios de integração mínima (já cumpridos)

Todos os jogos cumprem os 5 critérios mínimos:
1. ✅ caminho de decisão observável (`stats` + engine/fallback)
2. ✅ explicação curta e acionável
3. ✅ top moves / alternativa
4. ✅ revisão pós-jogo ou turning point
5. ✅ seletor e parâmetros de dificuldade N1–N5 presentes

## Critérios ainda necessários para “pronto para treino”

1. ✅ p95 de decisão dentro do gate e interação de browser sem bloqueio observado;
2. ✅ 0 jogadas ilegais nos harnesses publicados;
3. ✅ ladder espelhada publicada, incluindo pares não monotónicos;
4. ✅ gamificação baseada em evidência (padrões, puzzles, missões reclamadas uma vez);
5. ✅ smoke test dos seis jogos em desktop, tablet e mobile;
6. ⏳ piloto observado com alunos para P1–P10.
