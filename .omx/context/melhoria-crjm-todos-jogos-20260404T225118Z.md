# Context Snapshot — melhoria-crjm-todos-jogos

- **Task statement:** Melhorar o projeto para que sirva como plataforma eficaz de treino para o campeonato regional em **todos os jogos**, combinando AI mais forte, tutor mais útil e caminhos de evolução pedagógica.
- **Desired outcome:** Todos os 6 jogos oficiais ficam com um patamar mínimo comum de treino competitivo+peda gógico: AI utilizável, sinais de confiança/fallback, tutor textual acionável, alternativas de jogada e orientação estratégica por jogo.
- **Execution mode:** `$autopilot`
- **Scope update:** Este pedido expande a fase anterior (Dominório + Quelhas) para **todos os jogos**, preservando os avanços já existentes e priorizando primeiro os gaps mais críticos de eficácia competitiva.

## Known facts / evidence
- O repositório já tem contrato transversal `AIResponseV1` e perfis globais de dificuldade em `src/ai-core/`.
- **Dominório** e **Atari Go** já tinham adaptador V1 + tutor UI.
- Há trabalho local em curso para **Quelhas** (`src/games/quelhas/ai/v1-adapter.ts`, `components/TutorHintCard.tsx`, `components/TopMovesRail.tsx`, integração em `QuelhasGame.tsx`).
- **Gatos & Cães**, **Produto** e **Nex** ainda não mostram cobertura equivalente de tutor V1 no jogo.
- `docs/AI-IMPROVEMENT-PLAN.md` identifica **Gatos & Cães** e **Produto** como os maiores gaps de força competitiva.
- `docs/agents/ROADMAP-CRJM.md` define F6 como expansão do pipeline V1+tutor aos restantes jogos.
- Há alterações locais não commitadas em Dominório/Quelhas e artefactos; devemos preservá-las e construir por cima sem as destruir.

## Constraints
- Brownfield com arquitetura heterogénea (inline, worker, WASM opcional, fallbacks distintos).
- Pedido explícito de autonomia total; não há restrições de tecnologia/arquitetura impostas pelo utilizador.
- Ainda assim, devemos manter diffs pequenos e verificáveis, sem adicionar dependências desnecessárias.
- O sucesso real é pedagógico/competitivo em prática humana, mas precisamos de proxies técnicos fortes no repo.

## Risks / open questions
- “Suficientemente eficaz” para campeonato é uma meta ampla; no repo isso terá de ser aproximado por proxies: cobertura V1+tutor, clareza do feedback, observabilidade do runtime e melhoria dos jogos mais fracos.
- Reescrever totalmente as AIs mais fracas (sobretudo Gatos & Cães / Produto) pode ser maior do que uma única iteração; é preciso priorizar impactos mais rápidos e mensuráveis.
- O branch já contém WIP em Dominório/Quelhas que pode não estar ainda verde.

## Likely codebase touchpoints
- `src/ai-core/**`
- `src/games/dominorio/**`
- `src/games/quelhas/**`
- `src/games/atari-go/**`
- `src/games/gatos-caes/**`
- `src/games/produto/**`
- `src/games/nex/**`
- `docs/AI-IMPROVEMENT-PLAN.md`
- `docs/agents/ROADMAP-CRJM.md`
- `docs/agents/PEDAGOGY-MODEL.md`
- `docs/agents/EVALUATION-MATRIX.md`
