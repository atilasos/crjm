# CRJM Produto Completo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar o CRJM como produto local utilizável com alunos, com seis IAs responsivas e níveis N1–N5 claros, tutor e revisão coerentes, gamificação pedagógica completa e caminho operacional documentado para VPS.

**Architecture:** Preservar os motores e adaptadores `AIResponseV1` por jogo, concentrando políticas transversais em `src/ai-core/`. O progresso continua a funcionar offline e é sincronizado pelo learner-core Bun/SQLite quando o servidor local está ativo. Benchmarks e fontes matemáticas são artefactos versionados e não promessas embutidas na UI.

**Tech Stack:** Bun, TypeScript, React 19, Web Workers, Rust/WASM opcional, SQLite, Playwright.

## Global Constraints

- Não adicionar dependências.
- Português europeu e linguagem adequada a alunos.
- Nunca bloquear a thread principal com buscas longas quando `Worker` está disponível.
- O nível pedido é sempre `1 | 2 | 3 | 4 | 5`; os budgets comuns são 100, 250, 500, 1000 e 2000 ms.
- Uma revisão completa vale 10 XP e uma vitória vale 8 XP; concluir uma partida vale 10 XP.
- Sem leaderboard global por defeito, sem perda de XP e sem dados pessoais de alunos.
- Preservar os ficheiros sujos pré-existentes em `.omx/`, `artifacts/`, `AGENTS.MD` e `CLAUDE.md`.

---

### Task 1: Auditoria verificável e investigação matemática

**Files:**
- Create: `docs/research/ESTRATEGIAS-MATEMATICAS.md`
- Modify: `docs/agents/ALL-GAMES-MATURITY-MATRIX.md`
- Test: `docs/research/ESTRATEGIAS-MATEMATICAS.md`

**Interfaces:**
- Consumes: regras implementadas em `src/games/*/logic.ts` e fontes primárias.
- Produces: tabela por jogo com resultado conhecido, tipo de prova, aplicabilidade ao tabuleiro do CRJM e implicação concreta para a IA.

- [ ] **Step 1: Registar a regra exata implementada e confrontá-la com as regras oficiais**

  Cobrir Gatos & Cães 8×8, Dominório 8×8, Quelhas 10×10 misère, Produto lado 5, Atari Go 9×9 e Nex 11×11, incluindo desempates e regras de fim raras.

- [ ] **Step 2: Registar apenas conclusões sustentadas por fontes primárias**

  Incluir DOI/URL, distinção entre “existe um vencedor”, “outcome class conhecida” e “estratégia construtiva disponível”. Marcar explicitamente os jogos sem solução publicada localizada.

- [ ] **Step 3: Validar afirmações contra o código**

  Run: `rg -n "empate|vitoria|swap|troca|ultima|captura" src/games/*/{logic.ts,types.ts}`

  Expected: cada condição documentada aponta para uma regra presente ou para uma lacuna concreta.

### Task 2: IA responsiva de Gatos & Cães

**Files:**
- Modify: `src/games/gatos-caes/ai/types.ts`
- Modify: `src/games/gatos-caes/ai/ai-client.ts`
- Modify: `src/games/gatos-caes/ai/gatos-caes.worker.ts`
- Modify: `src/games/gatos-caes/ai/v1-adapter.ts`
- Modify: `build.ts`
- Test: `src/games/gatos-caes/ai/ai-client.test.ts`
- Test: `src/games/gatos-caes/ai/v1-adapter.test.ts`

**Interfaces:**
- Consumes: `getDifficultyProfile(level).timeBudgetMs` e `computeBestMove(state, difficulty, { timeLimit })`.
- Produces: `computeMove(state, difficulty, { timeLimitMs })` que usa worker no browser, respeita cancelamento e faz fallback inline apenas quando necessário.

- [ ] **Step 1: Escrever testes que provem forwarding do budget e resolução pelo worker**

  O fake worker deve receber `{ type: 'compute_move', requestId, state, difficulty, timeLimitMs }`; uma resposta com o mesmo `requestId` resolve apenas o pedido correspondente.

- [ ] **Step 2: Verificar RED**

  Run: `bun test src/games/gatos-caes/ai/ai-client.test.ts src/games/gatos-caes/ai/v1-adapter.test.ts`

  Expected: FAIL porque o cliente ainda calcula inline e o adapter ignora `timeBudgetMs`.

- [ ] **Step 3: Implementar cliente worker-first e budget comum**

  Manter a assinatura pública atual, acrescentar injeção de worker apenas para teste e enviar o limite ao worker. O adapter deve usar `request.timeBudgetMs ?? getDifficultyProfile(request.level).timeBudgetMs`.

- [ ] **Step 4: Verificar GREEN e bundle do worker**

  Run: `bun test src/games/gatos-caes/ai/ai-client.test.ts src/games/gatos-caes/ai/v1-adapter.test.ts`

  Expected: PASS.

  Run: `bun run build -- --skip-wasm && test -f dist/ai/gatos-caes/gatos-caes.worker.js`

  Expected: exit 0.

### Task 3: Núcleo completo de gamificação pedagógica

**Files:**
- Modify: `src/ai-core/gamification.ts`
- Modify: `src/ai-core/learner-gamification.ts`
- Modify: `src/types/learner-core.ts`
- Modify: `src/server/learner-core/service.ts`
- Modify: `src/server/learner-core/http.ts`
- Create: `src/server/learner-core/migrations/002_pedagogical_gamification.sql`
- Test: `src/ai-core/gamification.test.ts`
- Test: `src/components/gamification/gamification-state.test.ts`
- Test: `src/server/learner-core/service.test.ts`

**Interfaces:**
- Consumes: eventos do tutor (`topMoves`, `criticalThreats`, `pedagogy.errorCode`, nível de hint).
- Produces: `recordPuzzleSolved`, `recordStrategicDecision`, `recordPatternTransition` e `claimMissionReward`, idempotentes no backend.

- [ ] **Step 1: Escrever testes RED para XP, evidência e idempotência**

  Provar: vitória adiciona 8 XP sobre os 10 de conclusão; revisão adiciona 10; conquistas específicas não desbloqueiam só por jogar; transições de cartão são monotónicas; uma missão só paga uma vez por período.

- [ ] **Step 2: Implementar catálogo de padrões e eventos tipados**

  Estados exatos: `locked`, `seen`, `used_with_help`, `used_alone`, `mastered`. Uma transição válida nunca reduz o estado e `mastered` exige três contextos sem ajuda.

- [ ] **Step 3: Persistir snapshots pedagógicos**

  Criar tabelas separadas para cartões e missões concluídas, sem reescrever a migration inicial nem guardar PII adicional.

- [ ] **Step 4: Verificar core e backend**

  Run: `bun test src/ai-core src/components/gamification src/server/learner-core`

  Expected: PASS.

### Task 4: Integração nos seis jogos e dificuldade adaptativa

**Files:**
- Create: `src/ai-core/adaptive-difficulty.ts`
- Test: `src/ai-core/adaptive-difficulty.test.ts`
- Modify: `src/components/gamification/GamificationProvider.tsx`
- Modify: `src/games/*/*Game.tsx`
- Modify: `src/components/PerfilPage.tsx`

**Interfaces:**
- Consumes: decisões críticas, uso de hints, resultado e revisão por sessão.
- Produces: `recommendDifficulty(currentLevel, evidence)` com no máximo uma mudança por sessão e zona-alvo de sucesso 40–60%.

- [ ] **Step 1: Escrever testes RED para os guardrails DDA**

  Provar manter dentro da zona, subir apenas quando fácil demais, descer quando há frustração, limitar a ±1 e não repetir mudança na mesma sessão.

- [ ] **Step 2: Implementar o avaliador puro e integrar opção “Adaptativo”**

  A UI continua a permitir N1–N5 manual; “Adaptativo” explica a recomendação e nunca muda silenciosamente durante uma partida.

- [ ] **Step 3: Alimentar eventos pedagógicos reais**

  Comparar a jogada humana com `topMoves`, registar hint usado, recuperação e padrão observado durante a revisão; remover desbloqueios por mera presença no jogo.

- [ ] **Step 4: Mostrar cartões e missão reclamada no perfil**

  Manter alvos de toque ≥48 px, `aria-live="polite"` e `prefers-reduced-motion`.

### Task 5: Calibração N1–N5 e estratégias conhecidas

**Files:**
- Create: `scripts/ai-ladder.ts`
- Create: `scripts/ai-latency.ts`
- Create: `docs/reports/ai/ALL-GAMES-LADDER.md`
- Modify: motores/adapters apenas quando um gate falhar.

**Interfaces:**
- Consumes: adapters V1 com seed e budget.
- Produces: JSON por jogo/nível com legalidade, p50/p95, winrate espelhado, engine e seed.

- [ ] **Step 1: Criar harness com smoke rápido e perfil completo**

  Run: `bun run scripts/ai-latency.ts --profile smoke`

  Expected: 0 jogadas ilegais; p95 não excede `2 × budget + 100 ms`.

- [ ] **Step 2: Correr ladder espelhada**

  Run: `bun run scripts/ai-ladder.ts --profile classroom`

  Expected: o relatório não chama “monotónico” a pares que não atinjam o gate definido em `docs/agents/EVALUATION-MATRIX.md`.

- [ ] **Step 3: Aplicar conhecimento matemático apenas onde é válido**

  Dominório 8×8 pode usar outcome/abertura conhecida como oracle de teste; Atari Go 9×9, Quelhas, Produto e Nex não devem ser apresentados como resolvidos sem prova específica da variante.

### Task 6: Classroom gate, operação local e VPS

**Files:**
- Modify: `docs/GUIA-TREINO-CAMPEONATO.md`
- Modify: `docs/deployment/vps-cloudflare-bun.md`
- Create: `docs/CLASSROOM-CHECKLIST.md`
- Create: `scripts/classroom-smoke.ts`

**Interfaces:**
- Consumes: build, API health, seis jogos, perfil e torneio.
- Produces: um comando local de pré-aula e checklist de privacidade/backup/restauro.

- [ ] **Step 1: Automatizar smoke local**

  Verificar `/api/health`, homepage, perfil, assets de todos os workers e criação de sessão sem nome real obrigatório.

- [ ] **Step 2: Documentar arranque e recuperação**

  Incluir `bun install`, `bun run start`, variáveis, backup SQLite, rotação manual futura e limites do bootstrap de autenticação atual.

- [ ] **Step 3: Fazer QA Playwright em desktop, tablet e mobile**

  Viewports mínimos: 1440×900, 1024×768, 390×844; todos os seis jogos devem iniciar, aceitar uma jogada e regressar sem erro de consola.

### Task 7: Auditoria final requisito a requisito

**Files:**
- Modify: `README.md`
- Modify: `docs/agents/ALL-GAMES-MATURITY-MATRIX.md`
- Create: `docs/reports/PRODUCT-COMPLETION-AUDIT.md`

**Interfaces:**
- Consumes: resultados frescos dos testes, build, ladders e smoke tests.
- Produces: matriz explícita de evidência para cada requisito do objetivo.

- [ ] **Step 1: Correr verificação completa**

  Run: `bun test`

  Expected: 0 fail.

  Run: `bun run build -- --skip-wasm`

  Expected: exit 0 e seis worker bundles.

  Run: `bun run e2e:learner-core`

  Expected: exit 0.

- [ ] **Step 2: Reconciliar documentação com evidência**

  Remover rótulos “maduro”, “consolidado” ou “completo” que não estejam suportados por gates; listar validação com alunos como evidência externa, não como teste automatizado.

- [ ] **Step 3: Fechar apenas sem lacunas obrigatórias**

  O objetivo só é concluído quando a auditoria prova: seis IAs responsivas; N1–N5 claros e medidos; investigação matemática por jogo; gamificação da wiki integrada; execução local documentada; caminho VPS; UX de aula verificada.
