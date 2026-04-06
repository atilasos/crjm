# Context Snapshot — fix-dominorio-loading

- Task statement: Corrigir o Dominório que não está a carregar e reparar outros erros encontrados, garantindo qualidade.
- Desired outcome: Dominório volta a abrir corretamente; regressões relacionadas são corrigidas; build e testes passam exceto falhas pré-existentes conhecidas.
- Likely cause: regressão introduzida nas vagas recentes de tutor/gamification/visual hints.

## Known facts
- Últimos commits adicionaram tutor visual/gamification persistente.
- `bun run build -- --skip-wasm` passava antes desta vaga.
- Há 8 falhas pré-existentes em `tournament-engine.test.ts`.

## Likely touchpoints
- `src/games/dominorio/**`
- `src/components/Header.tsx`
- `src/components/gamification/**`
- `src/App.tsx`
