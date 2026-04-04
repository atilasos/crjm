# F6 — Expansão aos restantes jogos

Data: 2026-04-04

## Objetivo
Levar **Gatos & Cães, Produto e Nex** ao mesmo patamar mínimo de integração tutor/V1 já existente em Dominório, Atari Go e Quelhas, para suportar treino de campeonato em todos os jogos.

## Critério de saída
- os 6 jogos expõem adaptador V1 ou equivalente ligado ao fluxo humano vs AI;
- os 6 jogos mostram dica do turno + alternativas/top moves sem redesign do tabuleiro;
- cada jogo tem pelo menos sinais mínimos de confiança (`stats`, engine/fallback, timing);
- existe orientação pedagógica/estratégica por jogo em `docs/agents/CHAMPIONSHIP-TRAINING-PATHS.md`.

## Ordem de execução recomendada
1. **Gatos & Cães** — engine TS já forte; expansão mais barata e rápida.
2. **Produto** — alto valor pedagógico, mas precisa bridge sobre fallback fraco.
3. **Nex** — bridge semelhante a Produto, com maior risco por fallback nulo.

## Saídas esperadas por jogo
### Gatos & Cães
- `ai/v1-adapter.ts`
- `ai/pedagogy-mvp.ts` (mínimo)
- `components/TutorHintCard.tsx`
- `components/TopMovesRail.tsx`
- integração em `GatosCaesGame.tsx`
- testes do adaptador/pedagogia

### Produto
- `ai/v1-adapter.ts`
- componentes de tutor locais ou reutilizados
- integração mínima no jogo
- testes de mapeamento do packed move e trust signals

### Nex
- `ai/v1-adapter.ts`
- componentes de tutor locais ou reutilizados
- integração mínima no jogo
- testes do action mapping e swap-awareness

## Guardrails
- não esconder fallback nulo/aleatório atrás de explicações demasiado confiantes;
- preferir payload tutor mínimo correto a heurísticas complexas pouco fiáveis;
- manter copy curta, acionável e adequada ao aluno.

## Verificação
- testes unitários/adaptador por jogo tocado;
- `bun test`;
- `bun run build -- --skip-wasm`;
- revisão manual dos pontos de render do tutor nos 6 jogos.
