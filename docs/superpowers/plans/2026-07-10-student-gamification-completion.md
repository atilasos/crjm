# Student Gamification Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completar a experiência individual do aluno descrita no vault com puzzles realmente jogáveis, conquistas por jogo, missões diárias/semanais completas e proteção semanal de streak.

**Architecture:** O catálogo e as regras puras vivem em `src/ai-core/`; o learner-core persiste conclusões idempotentes e escudos sem dados pessoais; uma única página React oferece puzzles de escolha curta para os seis jogos. As missões coletivas/painel de turma ficam fora deste plano porque exigem modelo de turma, autenticação e revisão humana de dados escolares.

**Tech Stack:** Bun, TypeScript, React 19, SQLite, Tailwind existente, `bun:test`, Playwright existente.

## Global Constraints

- Não adicionar dependências.
- Não recolher nome real, idade, email ou identificadores escolares.
- Uma conclusão do mesmo puzzle só atribui XP uma vez.
- Revisão vale 10 XP, vitória 8 XP e puzzle 6 XP, conforme o vault.
- XP, cartões e conquistas nunca recuam.
- Alvos táteis têm pelo menos 48 px e o feedback mostra uma ideia principal.
- Não criar commits devido ao worktree partilhado e já sujo; manter alterações localizadas.

---

### Task 1: Catálogo e avaliação pura de puzzles

**Files:**
- Create: `src/ai-core/puzzles.ts`
- Create: `src/ai-core/puzzles.test.ts`
- Modify: `src/ai-core/index.ts`

**Interfaces:**
- Produces: `PUZZLES`, `getPuzzlesForGame(gameId)`, `evaluatePuzzleAnswer(puzzle, optionId)`.
- Cada puzzle contém `id`, `gameId`, `patternId`, `title`, `prompt`, `hint`, três `options` e `correctOptionId`.
- IDs: `gc-centro-1`, `gc-mobilidade-1`, `gc-bloqueio-1`, `do-paridade-1`, `do-corte-1`, `do-corredor-1`, `qu-misere-1`, `qu-simetria-1`, `qu-fratura-1`, `pr-equilibrio-1`, `pr-fusao-1`, `pr-grupo-1`, `ag-atari-1`, `ag-escada-1`, `ag-rede-1`, `nx-ponte-1`, `nx-ameaca-1`, `nx-bloqueio-1`.

- [x] **Step 1: Write the failing tests**

```ts
test('oferece três puzzles válidos por jogo', () => {
  for (const gameId of GAME_IDS) {
    expect(getPuzzlesForGame(gameId)).toHaveLength(3);
  }
});

test('devolve feedback explicativo para resposta certa e errada', () => {
  const puzzle = PUZZLES[0]!;
  expect(evaluatePuzzleAnswer(puzzle, puzzle.correctOptionId).correct).toBe(true);
  expect(evaluatePuzzleAnswer(puzzle, 'missing').correct).toBe(false);
});
```

- [x] **Step 2: Run RED**

Run: `bun test src/ai-core/puzzles.test.ts`
Expected: FAIL porque `puzzles.ts` ainda não existe.

- [x] **Step 3: Implement the catalog and evaluator**

```ts
export interface PuzzleDefinition {
  id: string;
  gameId: GameId;
  patternId: string;
  title: string;
  prompt: string;
  hint: string;
  options: Array<{ id: string; label: string; explanation: string }>;
  correctOptionId: string;
}
```

Preencher os 18 IDs listados com linguagem concreta, três opções e um `patternId` existente em `PATTERN_CARDS`.

- [x] **Step 4: Run GREEN**

Run: `bun test src/ai-core/puzzles.test.ts`
Expected: 2 testes PASS.

### Task 2: Conclusão idempotente, missões e proteção de streak

**Files:**
- Modify: `src/ai-core/gamification.ts`
- Modify: `src/ai-core/learner-gamification.ts`
- Modify: `src/ai-core/learner-gamification.test.ts`
- Modify: `src/types/learner-core.ts`

**Interfaces:**
- `recordPuzzleSolved(profile, gameId, now, { puzzleId, usedHint })` não duplica XP.
- `GamificationProfile.streakShieldWeeks: string[]` guarda no máximo as semanas usadas.
- `updateStreak` preserva a sequência quando há exatamente um dia em falta e ainda não foi usado escudo nessa semana.
- Missões individuais exatas: `daily-play-2`, `daily-review-1`, `daily-puzzle-2`, `daily-hints-2`, `weekly-review-5`, `weekly-two-game-wins`, `weekly-three-patterns`, `weekly-strategy-up`.
- Conquistas por jogo derivam apenas de `PatternProgress` independente.

- [x] **Step 1: Write failing tests** para: puzzle repetido sem XP; escudo semanal usado uma vez; oito missões presentes; 15 conquistas por jogo desbloqueadas apenas com padrão independente; streak 3/7.
- [x] **Step 2: Run RED**

Run: `bun test src/ai-core/learner-gamification.test.ts`
Expected: FAIL nos novos comportamentos.

- [x] **Step 3: Implement minimal pure rules**, preservando sanitização de perfis antigos.
- [x] **Step 4: Run GREEN**

Run: `bun test src/ai-core/learner-gamification.test.ts src/ai-core/gamification.test.ts`
Expected: PASS.

### Task 3: Persistência learner-core sem dados pessoais

**Files:**
- Create: `src/server/learner-core/migrations/003_student_puzzles_and_streak_shields.sql`
- Modify: `src/server/learner-core/service.ts`
- Modify: `src/server/learner-core/service.test.ts`
- Modify: `src/server/learner-core/http.ts`
- Modify: `src/server/learner-core/api.ts`
- Modify: `src/components/gamification/backend-client.ts`
- Modify: `src/components/gamification/backend-client.test.ts`

**Interfaces:**
- Nova tabela `learner_puzzle_completions(user_id, puzzle_id, game_id, used_hint, occurred_at, xp_delta, PRIMARY KEY(user_id,puzzle_id))`.
- Nova tabela `learner_streak_shields(user_id, week_key, used_at, PRIMARY KEY(user_id,week_key))`.
- `POST /api/learner/events/puzzle-solved` aceita `{ gameId, puzzleId, usedHint }`.
- Resposta repetida tem `sessionXpDelta: 0` e não cria segundo registo.

- [x] **Step 1: Write failing service/client tests** com duas chamadas ao mesmo puzzle.
- [x] **Step 2: Run RED**

Run: `bun test src/server/learner-core/service.test.ts src/components/gamification/backend-client.test.ts`
Expected: FAIL por ausência de `puzzleId` idempotente.

- [x] **Step 3: Add additive tables and persistence**; não alterar nem apagar tabelas existentes.
- [x] **Step 4: Run GREEN** com o mesmo comando.

### Task 4: Página “Laboratório de Estratégias”

**Files:**
- Create: `src/components/PuzzlePage.tsx`
- Create: `src/components/PuzzlePage.test.tsx`
- Modify: `src/components/gamification/GamificationProvider.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- `PuzzlePage({ onVoltar })` apresenta seletor dos seis jogos, progresso `resolvidos/3`, uma pergunta e três respostas.
- “Pedir uma pista” revela `hint` sem resolver.
- Resposta correta chama `recordPuzzleSolved(gameId, puzzleId, usedHint)` e `recordPatternProgress` com `used_with_help` ou `used_alone`.
- Resposta errada mostra explicação curta e permite tentar de novo sem penalização.

- [x] **Step 1: Write failing SSR/interaction-shape tests** para título, seis filtros, três opções e alvo mínimo `min-h-12`.
- [x] **Step 2: Run RED**

Run: `bun test src/components/PuzzlePage.test.tsx`
Expected: FAIL porque o componente não existe.

- [x] **Step 3: Implement UI** com direção visual “caderno de treinador”: papel claro, separadores por jogo, marcador de padrão e feedback verde/âmbar; reutilizar `Header`.
- [x] **Step 4: Add a home card/button** “Laboratório de Estratégias” e rota de estado `puzzles`.
- [x] **Step 5: Run GREEN**.

### Task 5: Perfil completo e histórico

**Files:**
- Modify: `src/components/PerfilPage.tsx`
- Modify: `src/components/DifficultySelector.test.tsx`
- Modify: `scripts/classroom-ui-smoke.ts`

**Interfaces:**
- Perfil agrupa conquistas por categoria, mostra proteção de streak usada/disponível e lista as cinco recompensas de missão mais recentes.
- Smoke UI abre o laboratório em três viewports, resolve um puzzle e confirma XP/progresso sem erro de browser.

- [x] **Step 1: Extend failing render/smoke assertions**.
- [x] **Step 2: Run RED**.
- [x] **Step 3: Implement profile grouping/history and UI smoke flow**.
- [x] **Step 4: Run GREEN**.

### Task 6: Verification and documentation

**Files:**
- Modify: `docs/agents/ALL-GAMES-MATURITY-MATRIX.md`
- Modify: `docs/CLASSROOM-CHECKLIST.md`
- Modify: `docs/GUIA-TREINO-CAMPEONATO.md`

- [x] **Step 1: Run focused tests** for puzzles, gamification, learner-core and UI.
- [x] **Step 2: Run `bun test`**, expected 0 failures.
- [x] **Step 3: Run `bun run build`**, expected five WASM builds and app build successful.
- [x] **Step 4: Run `bun run e2e:learner-core && bun run classroom:smoke`**, expected E2E plus 21 UI paths (18 games + 3 puzzle laboratory viewports).
- [x] **Step 5: Run `git diff --check`** and document that collective missions/teacher aggregation require a separate reviewed security/data model.

## Self-review

- Spec coverage: cobre gamificação individual Fases 1–2 e o ciclo de puzzle/fixação. Fase 3 coletiva está explicitamente excluída por autenticação/dados escolares.
- Placeholder scan: não há `TBD`/`TODO`; IDs, tabelas, endpoints e comandos estão definidos.
- Type consistency: `puzzleId` e `usedHint` atravessam domínio, API, cliente e UI com os mesmos nomes.
