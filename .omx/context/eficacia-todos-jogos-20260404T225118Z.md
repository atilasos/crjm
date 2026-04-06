# Context Snapshot — eficacia-todos-jogos

- **Task statement:** Melhorar a implementação do projeto até ser suficientemente eficaz para treinar alunos para o campeonato regional em todos os jogos, descobrindo melhores estratégias por jogo e construindo caminhos de evolução pedagógica.
- **Desired outcome:** Um plano e execução incremental que elevem simultaneamente força da AI, clareza pedagógica, cobertura tutor/explainability e evidência de treino competitivo para todos os jogos.
- **Execution mode:** `$autopilot` com expansão + planeamento + execução guiada por evidência do repo.
- **Intent hypothesis:** Transformar o CRJM numa plataforma de treino competitivo e pedagógico de ponta, começando por fechar os maiores gaps estruturais sem perder a visão all-games.

## Known facts / evidence
- Já existiam artefactos de clarificação para a iniciativa irmã `melhoria-ai-pedagogia`, mas focados sobretudo em Dominório + Quelhas: `.omx/specs/deep-interview-melhoria-ai-pedagogia.md`, `.omx/plans/prd-melhoria-ai-pedagogia.md`, `.omx/plans/test-spec-melhoria-ai-pedagogia.md`.
- O repo já tem cobertura tutor/V1 pelo menos em Dominório, Atari Go e Quelhas (novo/uncommitted), além de contratos centrais em `src/ai-core/types.ts`.
- O worktree está sujo com mudanças já em curso em Dominório e Quelhas; qualquer execução deve preservar trabalho existente e evitar regressões/overwrites.
- Há documentação/plans de roadmap, avaliação, baseline e hardening em `docs/agents/**`, `docs/reports/**` e `scripts/**`.
- O objetivo atualizado do utilizador amplia o escopo para **todos os jogos**, sem constrangimentos de arquitetura ou faseamento.

## Constraints
- Brownfield com worktree já modificado.
- É preciso respeitar alterações existentes e construir incrementalmente sobre elas.
- A prova final é pedagógica/competitiva com alunos, mas precisamos de proxies técnicos verificáveis no repo.

## Unknowns / open questions
- Que frentes já estão parcialmente implementadas nas mudanças locais para Dominório + Quelhas.
- Quais jogos além desses já têm base suficiente para um rollout rápido de treino pedagógico.
- Onde estão os maiores gaps competitivos por jogo (força de engine, fallback, calibração, UI tutor, curriculum/pathing).
- Qual o melhor slicing de execução para cumprir o objetivo all-games sem dispersão excessiva.

## Likely codebase touchpoints
- `src/ai-core/**`
- `src/games/**`
- `docs/agents/**`
- `docs/reports/**`
- `scripts/**`
- `src/server/**` / `src/tournament/**`
