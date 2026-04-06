# Context Snapshot — treino-campeonato-todos-jogos

- **Task statement:** Melhorar o projeto até ser suficientemente eficaz para treinar alunos para o campeonato regional em todos os jogos, descobrindo melhores estratégias por jogo e construindo caminhos de evolução para os tornar muito competentes.
- **Desired outcome:** Um pipeline transversal em que os 6 jogos tenham AI desafiadora, tutor pedagógico mínimo, sinais de confiança/observabilidade, e documentação de estratégia/progressão para treino.
- **Probable intent hypothesis:** Transformar o CRJM de coleção de jogos com níveis heterogéneos num sistema de treino competitivo + pedagógico consistente para sala de aula e prática autónoma.

## Known facts / evidence
- O repo já tem contrato comum `AIRequestV1`/`AIResponseV1` em `src/ai-core/types.ts`.
- Dominório e Atari Go já tinham integração V1+tutor; Quelhas já tem implementação em progresso no worktree (`src/games/quelhas/ai/v1-adapter.ts`, `src/games/quelhas/components/*`, `src/games/quelhas/QuelhasGame.tsx`).
- Produto, Gatos & Cães e Nex ainda não têm integração V1+tutor.
- Há matriz de avaliação transversal em `docs/agents/EVALUATION-MATRIX.md` e roadmap em `docs/agents/ROADMAP-CRJM.md`.
- O roadmap indica F4 (calibração/estabilidade) ainda bloqueada, F5 classroom gate pendente e F6 (expansão restantes jogos) apenas como placeholder.
- Existem artefactos anteriores focados em Dominório+Quelhas: `.omx/specs/deep-interview-melhoria-ai-pedagogia.md`, `.omx/plans/prd-melhoria-ai-pedagogia.md`, `.omx/plans/test-spec-melhoria-ai-pedagogia.md`.

## Constraints
- Brownfield com alterações já presentes no worktree; evitar sobrescrever trabalho em curso.
- Objetivo do utilizador não impõe restrições tecnológicas nem de escopo por jogo.
- Precisamos de proxies verificáveis no repo sem sobreprometer validação real em sala.

## Unknowns / open questions
- Quão longe conseguimos ir em calibração competitiva real para todos os jogos numa só iteração vs estabelecer infraestrutura/tutor/roadmaps sólidos.
- Que baseline/harness mínimo é suficiente para Produto, Gatos & Cães e Nex nesta iteração.
- Se haverá necessidade de partilhar componentes tutor genéricos antes de completar a expansão.

## Likely codebase touchpoints
- `src/ai-core/**`
- `src/games/dominorio/**`
- `src/games/quelhas/**`
- `src/games/atari-go/**`
- `src/games/gatos-caes/**`
- `src/games/produto/**`
- `src/games/nex/**`
- `docs/agents/EVALUATION-MATRIX.md`
- `docs/agents/ROADMAP-CRJM.md`
- `docs/agents/plans/f5-classroom-gate.md`
- `docs/agents/plans/f6-expansao-jogos.md`
