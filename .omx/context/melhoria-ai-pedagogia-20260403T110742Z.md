# Context Snapshot — melhoria-ai-pedagogia

- **Task statement:** Analisar o repo e preparar continuação da melhoria da AI dos jogos matemáticos e da melhoria pedagógica das dicas/instruções quando o jogador enfrenta a AI.
- **Desired outcome:** Chegar a uma especificação clara sobre quais frentes melhorar primeiro, para quem, em que jogos, com que equilíbrio entre força da AI e qualidade pedagógica.
- **Stated solution:** Executar uma deep interview antes de planeamento/implementação.
- **Probable intent hypothesis:** Tornar o jogo contra a AI simultaneamente melhor como adversário e melhor como tutor, sem degradar UX, clareza nem adequação pedagógica.

## Known facts / evidence
- Existe contrato unificado `AIResponseV1` com `topMoves`, `explainText`, `criticalThreats`, `turningPoints`, `pedagogy` em `src/ai-core/types.ts`.
- Existe normalização de dificuldade em `src/ai-core/difficulty.ts` com budgets, intensidade e hint-level automático.
- Hoje apenas **Dominório** e **Atari Go** mostram tutor UI (`TutorHintCard`, `TopMovesRail`) e têm `ai/v1-adapter.ts`.
- **Gatos & Cães, Quelhas, Produto e Nex** ainda não têm integração V1+tutor-ui equivalente.
- Dominório tem MVP pedagógico explícito em `src/games/dominorio/ai/pedagogy-mvp.ts` com adaptação de hint level e quick review.
- Há documentação estratégica relevante em `docs/agents/AI-BLUEPRINT.md`, `docs/agents/UI-BLUEPRINT.md`, `docs/agents/PEDAGOGY-MODEL.md`, `docs/agents/EVALUATION-MATRIX.md`.
- Há scripts/reports de hardening e baseline com métricas pedagógicas P1/P5/P6/P7, sobretudo em Dominório.

## Constraints
- Brownfield: há arquitetura existente de worker/WASM/fallback e contratos V1.
- Pedido atual é de clarificação, não implementação direta.
- Devemos evitar pedir ao utilizador factos que o repo já revela.

## Unknowns / open questions
- Se o objetivo prioritário é cobertura horizontal (todos os jogos) ou profundidade vertical (1-2 jogos primeiro).
- Se a prioridade é mais competitiva (força/calibração) ou mais pedagógica (hints/scaffolding/review).
- Público-alvo prioritário: alunos, professores, contexto de sala, treino individual, torneio?
- Critérios de sucesso: win-rate calibrado, diferença entre níveis, qualidade das dicas, aprendizagem percebida, métricas automáticas, validação com professores/alunos.
- O que deve ficar fora de escopo nesta fase.
- Até que ponto OMX pode decidir arquitetura/ordem de execução sem confirmação.

## Decision-boundary unknowns
- Posso decidir sozinho a ordem por jogo?
- Posso introduzir novos componentes/contratos pedagógicos?
- Posso alterar o meaning de níveis de dificuldade ou apenas a calibração interna?
- Posso priorizar UI pedagógica sobre engine strength, ou isso precisa validação tua?

## Likely codebase touchpoints
- `src/ai-core/types.ts`
- `src/ai-core/difficulty.ts`
- `src/games/dominorio/**`
- `src/games/atari-go/**`
- `src/games/quelhas/**`
- `src/games/produto/**`
- `src/games/nex/**`
- `src/games/gatos-caes/**`
- `docs/agents/AI-BLUEPRINT.md`
- `docs/agents/UI-BLUEPRINT.md`
- `docs/agents/PEDAGOGY-MODEL.md`
- `docs/agents/EVALUATION-MATRIX.md`
