# Context Snapshot — melhoria-ai-todos-jogos

- **Task statement:** Melhorar a implementação do projeto até ser eficaz para treinar alunos para o campeonato regional em todos os jogos, descobrindo estratégias fortes por jogo e construindo caminhos de evolução para competência alta.
- **Desired outcome:** Um treino mais competitivo e pedagógico para os seis jogos, com IA/tutor melhores, progressão clara por jogo e evidência técnica de prontidão.
- **Probable intent hypothesis:** O utilizador quer um produto que funcione como adversário sério + tutor de campeonato, não apenas um conjunto de jogos jogáveis.

## Known facts / evidence
- O repo já tem contrato comum `AIRequestV1` / `AIResponseV1` em `src/ai-core/types.ts`.
- Dominório, Atari Go e agora Quelhas já têm/adotam camada `v1-adapter` e UI de tutor.
- Gatos & Cães, Produto e Nex ainda não expõem tutor V1 equivalente no UI.
- Existem docs de estratégia/IA por jogo em `docs/*.md` para Quelhas, Produto, Atari Go e Nex.
- Há trabalho em curso no working tree para Dominório + Quelhas; não devemos reverter nem sobrescrever sem integrar.

## Constraints
- Brownfield com workers/WASM/fallbacks diferentes por jogo.
- Sem constrangimentos de produto impostos pelo utilizador, mas precisamos preservar comportamento existente e respeitar trabalho já em curso.
- Sem redesign visual de tabuleiros como foco principal; o valor está em força, clareza e progressão.

## Unknowns / open questions (resolvidas por autonomia)
- Como priorizar todos os jogos? → completar slice atual Dominório+Quelhas e estender o padrão tutor/estratégia aos restantes.
- Como materializar “caminhos de evolução”? → combinar tutor contextual em jogo + trilhos de treino por jogo em artefacto dedicado.
- Como provar eficácia sem sala de aula? → usar proxies técnicos: V1 coverage, explicações acionáveis, testes, build e documentação de treino.

## Likely codebase touchpoints
- `src/ai-core/**`
- `src/components/**`
- `src/games/*/ai/**`
- `src/games/*/*Game.tsx`
- `docs/**/*.md`
- `.omx/plans/*.md`
