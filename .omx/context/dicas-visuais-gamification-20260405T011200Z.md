# Context Snapshot — dicas-visuais-gamification

- **Task statement:** Consolidar as dicas para que sejam visuais e mais contextuais e planear/estruturar a implementação de gamification (badges, achievements, progresso) para tornar o treino mais aliciante.
- **Desired outcome:** Um sistema de tutor mais visual/contextual no produto e um plano/estrutura inicial de gamification reutilizável.
- **Probable intent hypothesis:** O utilizador quer que o treino deixe de depender tanto de texto abstrato e passe a guiar visualmente o aluno, enquanto o progresso fica mais motivador e divertido.

## Known facts / evidence
- Os seis jogos já têm trilhos de treino; vários já têm tutor card + top moves.
- Os tabuleiros usam componentes próprios por jogo, sem camada visual comum para highlights pedagógicos.
- Existem docs de gamification/pedagogy em `docs/agents/PEDAGOGY-GAMIFICATION.md` e `docs/agents/UI-GAMIFICATION.md`.
- O pedido atual é broad but actionable: UX pedagógica + planeamento/fundação de gamification.

## Constraints
- Brownfield React/TS, sem novas dependências desejáveis.
- Melhor reutilizar primitives visuais comuns do que inventar seis sistemas independentes.
- Manter build e testes verdes exceto falhas pré-existentes do tournament-engine.

## Likely codebase touchpoints
- `src/ai-core/**`
- `src/components/**`
- `src/games/*/*Game.tsx`
- `src/games/*/components/**`
- `docs/agents/*GAMIFICATION*.md`
- `docs/GUIA-TREINO-CAMPEONATO.md`
