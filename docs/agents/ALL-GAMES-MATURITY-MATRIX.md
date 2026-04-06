# All-Games Maturity Matrix — CRJM

Data: 2026-04-06 (atualizado)

## Estado técnico e pedagógico por jogo

| Jogo | Engine principal | Adapter V1 | Tutor UI | Quick Review | Highlights tabuleiro | Gamification | Estado |
|---|---|---|---|---|---|---|---|
| Dominório | TS + opening book | ✅ | ✅ | ✅ | ✅ ring-amber | ✅ | **piloto maduro** |
| Atari Go | WASM/worker | ✅ | ✅ | ✅ (turning point) | ✅ border-amber | ✅ | **piloto maduro** |
| Quelhas | worker/TS | ✅ | ✅ | ✅ | ✅ ring-amber | ✅ | **consolidado** |
| Gatos & Cães | TS forte | ✅ | ✅ | ✅ | ✅ ring-amber | ✅ | **consolidado** |
| Produto | WASM-first + TS fallback | ✅ | ✅ | ✅ | ✅ stroke-amber SVG | ✅ | **consolidado** |
| Nex | WASM-first + TS fallback | ✅ | ✅ | ✅ | ✅ stroke-amber SVG | ✅ | **consolidado** |

## Leitura rápida (2026-04-06)

Todos os 6 jogos atingiram paridade pedagógica mínima:
- adapter V1 com pedagogy, topMoves, criticalThreats
- TutorHintCard + TopMovesRail
- Quick review pós-jogo com XP reward
- Highlights visuais da jogada recomendada no tabuleiro
- Integração com sistema de gamification (XP, missões, achievements)

## Known Limitations

- **Dominório N5>N4** e **Atari Go N4/N5**: engine TS não garante ordering monotónico de topo. Requer WASM ativo no adapter V1.
- **T4 estabilidade** (Dominório): 36.96% divergência em repetição TS sem seed — artefacto da ausência de WASM, não bug pedagógico.
- **Produto e Nex**: fallback TS é heurístico; sem garantia de força relativa entre níveis de topo.

## Critérios de "pronto para treino"

Todos os jogos cumprem os 5 critérios mínimos:
1. ✅ caminho de decisão observável (`stats` + engine/fallback)
2. ✅ explicação curta e acionável
3. ✅ top moves / alternativa
4. ✅ revisão pós-jogo ou turning point
5. ✅ progressão de dificuldade minimamente consistente (N1–N3 garantida)
