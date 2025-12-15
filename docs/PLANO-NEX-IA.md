# Plano executável — IA do jogo Nex (Rust + WASM + TS/Worker)

Base: `docs/NEX-IA.md`.

## Como usar este checklist

- Cada item é uma tarefa “fechável” (marcar `x` quando concluído).
- “DoD” = Definition of Done (critérios mínimos para dar a etapa como concluída).
- Objetivo final: IA forte, com níveis e **sem bloquear UI** (Worker obrigatório), respeitando swap e orçamento de tempo (2–3s/jogada).

---

## M0 — Auditoria TS atual + contrato TS↔WASM (fundação)

- [ ] **Auditar regras e engine TS existentes**
  - [ ] Ler `src/games/nex/types.ts` (tipos, coordenadas, serialização atual se existir).
  - [ ] Ler `src/games/nex/logic.ts` (regras, swap, vitória, distância, IA atual).
  - [ ] Ler `src/games/nex/logic.test.ts` (fixtures e invariantes).
  - [ ] Ler `src/games/nex/NexGame.tsx` (pontos onde a UI chama a IA e trata `swapDisponivel`).
  - DoD:
    - [ ] Lista fechada de invariantes do estado (dimensão 11×11, símbolos de célula, flags do swap, “primeiraJogada”).
    - [ ] Lista de pontos de integração na UI para substituir `jogadaComputador` por Worker.

- [x] **Fechar contrato TS↔WASM (estado + ação)**
  - [x] Escolher boundary inicial:
    - [ ] Opção A (compatível com `docs/NEX-IA.md`): `choose_move(state_json: &str, ms_budget: u32, level: u8, seed: u64) -> String`.
    - [x] Opção B (mais eficiente): `choose_move(board: Uint8Array(121), to_play: u8, flags: u8, ms_budget: u32, level: u8, seed: u64) -> JsValue`.
  - [x] Definir “source of truth” para mapeamento `idx <-> (x,y)` (ex.: `idx = x*11 + y`).
  - [x] Fechar o schema da ação (swap/recusar_swap/colocar/substituir) e as regras de validade.
  - DoD:
    - [x] Tipos TS fechados para request/response do Worker (com `requestId`) e payloads estabilizados.

---

## M1 — Crate Rust `wasm/nex_ai` (core + API WASM)

- [x] **Criar crate Rust WASM-ready**
  - [x] `wasm/nex_ai/Cargo.toml`
  - [x] `wasm/nex_ai/src/lib.rs` (exports via wasm-bindgen)
  - [x] `wasm/nex_ai/src/core/` (board, movegen, eval, search, zobrist, tt, utils)
  - DoD:
    - [ ] `cargo test --manifest-path wasm/nex_ai/Cargo.toml` passa.

- [ ] **Representação e pré-cálculos**
  - [ ] `idx = x*11 + y` (121 casas).
  - [ ] `neighbours[121]` (lista fixa até 6 vizinhos por casa).
  - [ ] Listas de bordas-alvo por cor:
    - [ ] Pretas: `y=0` → `y=10`
    - [ ] Brancas: `x=0` → `x=10`
  - [ ] Zobrist hashing e RNG determinístico (seed).
  - DoD:
    - [ ] Teste: vizinhos batem certo com `src/games/nex/logic.test.ts` (casos de canto/aresta/centro).

---

## M2 — Correctness: regras, vitória e distância mínima

- [ ] **Aplicação de ações (sem IA ainda)**
  - [ ] Validar e aplicar:
    - [ ] `swap` (inverter pretas↔brancas no tabuleiro e flags).
    - [ ] `colocar` (1 própria + 1 neutra em vazias distintas).
    - [ ] `substituir` (2 neutras→próprias + 1 própria→neutra).
  - DoD:
    - [ ] Para estados inválidos, `choose_move` devolve erro/ação fallback documentada (nunca crasha).

- [ ] **Verificação de vitória**
  - [ ] `verificar_vitoria(cor)` por BFS/DFS sobre casas da própria cor, iniciando na borda de entrada.
  - DoD:
    - [ ] Fixtures equivalentes às de `src/games/nex/logic.test.ts` (vitória e não-vitória).

- [ ] **Distância mínima para conectar (base da avaliação)**
  - [ ] Implementar `distancia_minima_para_conectar(cor)` como 0-1 BFS:
    - [ ] custo 0: casa da própria cor
    - [ ] custo 1: vazia ou neutra
    - [ ] bloqueio: casa do adversário (intransponível)
  - DoD:
    - [ ] Casos simples (tabuleiro vazio, caminhos bloqueados, caminho direto) com expected dist.

---

## M3 — Geração de movimentos (pruning agressivo)

- [ ] **Gerar ações legais**
  - [ ] `swap` e `recusar_swap` apenas quando `swapDisponivel` e for o 1.º turno do 2.º jogador.
  - [ ] `colocar` apenas se existirem ≥2 vazias.
  - [ ] `substituir` apenas se existirem ≥2 neutras e ≥1 própria.
  - DoD:
    - [ ] Gerador nunca emite ação ilegal (tests).

- [ ] **Conjunto de candidatos (redução do branching)**
  - [ ] Candidatos “relevantes”:
    - [ ] vazias a distância 1 e 2 de qualquer peça (própria/adversária/neutra)
    - [ ] reforço de centro na abertura (ex.: incluir sempre (5,5) e adjacências se vazias)
  - [ ] Colocação:
    - [ ] escolher top K1 para `own` (por heurística barata: centralidade + impacto em distância)
    - [ ] para cada `own`, escolher top K2 para `neutral` (bloqueios e “corredores” do adversário)
  - [ ] Substituição:
    - [ ] escolher top N neutras (em caminhos mínimos próprios, adjacentes a grupos próprios, ou que criem ameaça)
    - [ ] escolher sacrifício entre próprias de baixo impacto (fora do caminho mínimo / baixa centralidade)
  - DoD:
    - [ ] Parâmetros K1/K2/N documentados e “safe defaults” por fase do jogo.

---

## M4 — Tática obrigatória + níveis 1–3 (heurística → minimax)

- [ ] **Tática obrigatória antes de qualquer search**
  - [ ] Detectar “vitória imediata” em 1 lance (colocação/substituição).
  - [ ] Detectar e bloquear “vitória imediata” adversária no próximo lance.
  - [ ] Contar ameaças múltiplas (nº de vitórias imediatas disponíveis no próximo turno).
  - DoD:
    - [ ] Fixtures: IA encontra vitória forçada simples e bloqueio simples.

- [ ] **Função de avaliação (barata e estável)**
  - [ ] Base: `(dist_adv - dist_me) * Wdist`.
  - [ ] Ajustes:
    - [ ] ameaças imediatas (meu e adversário)
    - [ ] penalização por abrir dupla ameaça adversária
    - [ ] bónus por centralização apenas no opening
    - [ ] bónus por “bloqueio efetivo” via neutra
  - DoD:
    - [ ] Avaliação é simétrica (trocar cores inverte sinal) e determinística por seed.

- [ ] **Nível 1 (easy): heurística 1-ply (rápida)**
  - [ ] Escolher melhor entre candidatos reduzidos.
  - DoD:
    - [ ] Decide consistentemente <100ms com estado típico (sem budget grande).

- [ ] **Nível 2 (medium): 1-ply “mais exaustivo”**
  - [ ] Avaliar mais candidatos do que o easy (mesma avaliação, mais cobertura).
  - DoD:
    - [ ] Medium vence easy de forma consistente em auto-jogo (definir meta após harness).

- [ ] **Nível 3 (hard): minimax 2-ply + alpha-beta**
  - [ ] Iterative deepening até `ms_budget`.
  - [ ] Transposition table (Zobrist) + ordenação de jogadas:
    - [ ] vitórias imediatas, bloqueios imediatos, menor `dist_me`, maior `dist_adv`, mais ameaças criadas
  - DoD:
    - [ ] `choose_move` respeita `ms_budget` (termina sempre dentro do budget com “best-so-far”).

---

## M5 — Nível 4 (master): MCTS UCT (com budget rígido)

- [ ] **MCTS UCT com progressive widening**
  - [ ] Começar com top 5–10 ações; aumentar conforme visitas.
  - [ ] Rollouts guiados por heurística (não aleatório puro).
  - [ ] “Anytime”: devolver melhor ação conhecida quando o tempo acabar.
  - DoD:
    - [ ] Master não excede o budget e melhora com mais tempo (monotonicamente na raiz, em média).

---

## M6 — Integração TypeScript (Worker + UI + fallback)

- [x] **Criar Worker e client (padrão dos outros jogos)**
  - [x] `src/games/nex/ai/nex.worker.ts` (carrega WASM e responde a requests).
  - [x] `src/games/nex/ai/ai-client.ts` (API async no main thread; ignora respostas “stale”).
  - [x] Fallback: se Worker/WASM falhar, usar `jogadaComputador` atual (TS).
  - DoD:
    - [x] UI permanece responsiva durante “a pensar…” (Worker obrigatório).

- [x] **Integrar em `src/games/nex/NexGame.tsx`**
  - [x] Seleção de nível (easy/medium/hard/master) e preset de tempo (ex.: 800ms, 1500ms, 2500ms).
  - [x] Respeitar `swapDisponivel` (IA decide swap/recusar_swap).
  - DoD:
    - [x] Nunca aplica ação inválida no TS (validação no adaptador antes de aplicar).

---

## M7 — Build/Deploy (Bun) para WASM + Worker

- [x] **Adicionar build do `wasm/nex_ai` no `build.ts`**
  - [x] Compilar crate para `wasm32-unknown-unknown --release`.
  - [x] Rodar `wasm-bindgen --target web` para `src/games/nex/ai/wasm/pkg`.
  - [x] Bundlar Worker para `dist/ai/nex/nex.worker.js` (padrão `buildWorker()`).
  - DoD:
    - [ ] `bun run build.ts --skip-wasm` funciona (mantém fallback TS).
    - [ ] `bun run build.ts` gera assets de WASM e Worker quando toolchain existe.

---

## M8 — Testes, regressões e performance

- [ ] **Testes Rust**
  - [ ] mapping/vizinhos
  - [ ] vitória e distâncias
  - [ ] validade de ações (colocar/substituir/swap)
  - [ ] invariantes (board apenas com estados válidos; flags coerentes)
  - DoD:
    - [ ] `cargo test --manifest-path wasm/nex_ai/Cargo.toml` passa.

- [ ] **Testes TS e cross-check**
  - [ ] Reusar `src/games/nex/logic.test.ts` como oracle para casos de regra.
  - [ ] (Opcional) gerador de estados aleatórios e comparação de `verificarVitoria`/`distancia` TS vs Rust.
  - DoD:
    - [ ] `bun test` passa.

- [ ] **Auto-jogo + métricas**
  - [ ] Harness simples para jogar “bot vs bot” (100–500 jogos) e medir win-rate:
    - [ ] master vs TS baseline deve ganhar “esmagadoramente”
    - [ ] hard vs medium > 60–70% (ajustar)
  - [ ] Medir tempo médio por jogada por nível e garantir que o Worker não congestiona a UI.
  - DoD:
    - [ ] Relatório curto (tabela) anexado no PR com win-rate e tempos.

---

## Comandos úteis (referência)

- Testes TS: `bun test`
- Build do site: `bun run build.ts`
- Build sem WASM (dev/sem toolchain): `bun run build.ts --skip-wasm`
- Rust (quando existir o crate):
  - `cargo test --manifest-path wasm/nex_ai/Cargo.toml`
  - `cargo build --manifest-path wasm/nex_ai/Cargo.toml --release --target wasm32-unknown-unknown`
