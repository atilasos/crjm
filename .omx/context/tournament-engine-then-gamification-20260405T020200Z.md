# Context Snapshot — tournament-engine-then-gamification

- Task statement: Primeiro corrigir os 8 testes falhados do tournament-engine; depois continuar a gamification/profile.
- Desired outcome: Suite global verde (ou pelo menos sem regressões novas no engine), seguida de nova vaga de profile/gamification.
- Known blocker: 8 falhas persistentes em `src/server/tournament-engine.test.ts` relacionadas com geração/encadeamento de brackets.
- Constraints: preservar funcionalidades recentes (AI/tutor/gamification), manter GitHub atualizado.
- Likely touchpoints: `src/server/tournament-engine.ts`, `src/server/tournament-engine.test.ts`, depois `src/components/gamification/**`, `src/App.tsx`, `src/components/Header.tsx`.
