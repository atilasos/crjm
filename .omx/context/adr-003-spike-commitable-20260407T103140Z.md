# Context Snapshot — ADR-003 spike commitável

- **Task statement:** Corrigir o spike ADR-003 no branch `crjm-vnext` para ficar commitável com ajustes mínimos pedidos no OmO review.
- **Desired outcome:** Spike coerente com núcleo V1 estrito, sem promessas de learner-core autenticado antes da decisão final, com cookies/session secret coerentes e classificação explícita de tabelas operacionais fora do núcleo canónico.

## Known facts / evidence

1. O working tree atual já contém o spike em `src/server/learner-core/**`, `src/index.ts`, `src/types/learner-core.ts`, `src/types/index.ts`, `README.md` e `.env.example`.
2. `README.md` atualmente promete “sessão autenticada no backend learner-core V1”, o que excede a decisão fechada.
3. `src/server/learner-core/config.ts` expõe `sessionSecret`, mas `http.ts` apenas grava cookie opaco sem assinatura; há promessa/config sem uso efetivo.
4. `migrations/001_initial.sql` inclui `auth_sessions` e `learner_import_markers`, mas a ADR fixa o núcleo semântico V1 em `users`, `learner_profiles`, `learner_game_progress`, `learner_activity_events`.
5. O review pede ajustes mínimos, mantendo o spike e o núcleo V1 estrito.

## Constraints

- Usar o **working tree atual como base sem absorver ficheiros não relacionados**.
- Manter o **núcleo V1 estrito**.
- Fazer **ajustes mínimos** para ficar commitável.
- Verificar prontidão para commit no fim.

## Unknowns / open questions

- Implementar assinatura simples de cookie com `sessionSecret` vs. remover a promessa/configuração associada.
- Melhor sítio para explicitar que `auth_sessions` e `learner_import_markers` são infra operacional: ADR, testes, comentários de migração, ou combinação mínima desses pontos.

## Likely codebase touchpoints

- `README.md`
- `.env.example`
- `src/server/learner-core/config.ts`
- `src/server/learner-core/http.ts`
- `src/server/learner-core/api.test.ts`
- `src/server/learner-core/service.test.ts`
- `src/server/learner-core/migrations/001_initial.sql`
- `docs/agents/reviews/crjm-vnext-adr-003.md`
