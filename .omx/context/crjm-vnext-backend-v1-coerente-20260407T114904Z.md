# Context Snapshot — crjm-vnext backend V1 coerente

- **Task statement:** Próximo slice de `crjm-vnext`: transformar o learner-core bootstrap spike num backend V1 mais coerente sem expandir o âmbito.
- **Desired outcome:** Alinhar auth/dev-session com a stack escolhida, clarificar o que é infra operacional vs núcleo canónico, atualizar README/docs para refletirem exatamente o estado atual e deixar um próximo commit pequeno e limpo.

## Known facts / evidence

1. O bootstrap learner-core vive em `src/server/learner-core/**`, entra por `src/index.ts` e exporta tipos em `src/types/learner-core.ts` / `src/types/index.ts`.
2. `README.md` ainda fala em “perfil persistido via bootstrap técnico de sessão no spike learner-core V1”, o que pode overclaimar o estado atual.
3. `.env.example` expõe `CRJM_SESSION_SECRET=dev-session-secret` e o config usa `sessionSecret`/cookie name; `http.ts` já codifica/descodifica cookie de sessão e `service.ts` persiste `auth_sessions`.
4. A migração `src/server/learner-core/migrations/001_initial.sql` inclui `auth_sessions` e `learner_import_markers`; a ADR-003 diz que ambos são infra operacional e não expandem o núcleo semântico V1.
5. A ADR e review de referência estão em `docs/agents/reviews/crjm-vnext-adr-003.md`; o próprio texto já explicita que turma/professor e match-history ficam fora de âmbito.
6. O working tree do leader está sujo com ficheiros não relacionados; `omx team` usa worktrees dedicadas por defeito, o que ajuda a manter este slice pequeno e isolado.

## Constraints

- Não abrir subdomínios de turma/professor.
- Não abrir match-history.
- Não expandir o âmbito além de coerência V1 + docs exatas.
- Objetivo explícito: próximo commit pequeno e limpo.

## Unknowns / open questions

- Se o slice ideal é refinar o mecanismo atual de dev-session/cookie ou apenas renomear/documentar melhor a natureza técnica do bootstrap.
- Se README basta ou se convém atualizar também docs/review/ADR adjacentes para reduzir ambiguidade operacional vs canónica.
- Qual o menor conjunto de ficheiros para deixar o commit suficientemente coerente sem tocar noutras lanes ativas.

## Likely codebase touchpoints

- `src/server/learner-core/config.ts`
- `src/server/learner-core/http.ts`
- `src/server/learner-core/service.ts`
- `src/server/learner-core/api.test.ts`
- `src/server/learner-core/service.test.ts`
- `src/server/learner-core/migrations/001_initial.sql`
- `README.md`
- `.env.example`
- `docs/agents/reviews/crjm-vnext-adr-003.md`
