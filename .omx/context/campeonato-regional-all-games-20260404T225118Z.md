# Context Snapshot — campeonato-regional-all-games

- **Task statement:** Melhorar o projeto até ser suficientemente eficaz para treinar alunos para o campeonato regional em **todos os jogos**, descobrindo melhores estratégias por jogo e construindo caminhos de evolução pedagógicos.
- **Desired outcome:** Ter os 6 jogos com AI útil como adversário e como tutor: sugestões claras, progressão de dificuldade, visibilidade de confiança/fallback e cobertura mínima de treino estratégico por jogo.
- **Execution stance:** Autonomia total; sem constrangimentos adicionais; objetivo deve ser perseguido até ficar utilizável para treino real.

## Known facts / evidence
- O repo já tem um contrato transversal `AIResponseV1` e perfis de dificuldade em `src/ai-core/`.
- Dominório e Atari Go já têm integração V1+tutor; Quelhas está em progresso com adapter/componentes já presentes no working tree.
- Gatos & Cães, Produto e Nex ainda não têm V1+tutor integrado no UI.
- Baselines/hardening formais existem sobretudo para Dominório e Atari Go (`scripts/dominorio-baseline.ts`, `scripts/atari-go-ladder-baseline.ts`, `scripts/hardening-f3_*.ts`).
- O roadmap existente ainda trata a expansão aos restantes jogos como F6 placeholder (`docs/agents/plans/f6-expansao-jogos.md`).

## Constraints
- Brownfield com muitos ficheiros já alterados no working tree, especialmente Dominório e Quelhas.
- Não introduzir dependências novas sem necessidade.
- Precisamos preservar build/test do estado atual e evitar reescrever o que já está funcional em Dominório/Atari Go.

## Unknowns / open questions
- Qual a profundidade real necessária por jogo para “suficientemente eficaz” em treino regional sem testes com alunos.
- Quanta força competitiva adicional será necessária além da integração pedagógica/transversal.
- Se todos os jogos precisam de baselines automáticos completos já nesta execução ou se alguns podem ficar com smoke/regression tests + heurísticas pedagógicas iniciais.

## Likely codebase touchpoints
- `src/games/gatos-caes/**`
- `src/games/produto/**`
- `src/games/nex/**`
- `src/games/quelhas/**`
- `src/ai-core/**`
- `docs/agents/**`
- `scripts/**`
