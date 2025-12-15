# Plano executável — IA do jogo “Produto” (Rust + WASM + TS/Worker)

Base: `docs/PRODUTO-IA.md`.

## Como usar este checklist

- Cada item é uma tarefa “fechável” (marcar `x` quando concluído).
- Sempre que houver um comando, correr e anexar o output/resultado no PR/issue.
- “DoD” = Definition of Done (critérios mínimos para dar a etapa como concluída).

---

## M0 — Contratos, formatos e mapeamento (fundação)

- [x] **Fixar o mapeamento 61 casas → índices `[0..60]`**
  - [x] Decidir fonte de verdade do mapeamento (mesma ordem do `gerarPosicoesValidas()` em `src/games/produto/types.ts`).
  - [x] Definir como converter `Posicao(q,r)` ↔ `idx` de forma determinística.
  - DoD:
    - [x] Existe uma rotina determinística em TS e Rust e há teste a garantir 61 posições únicas (`src/games/produto/logic.test.ts`).

- [x] **Definir contrato TS↔WASM**
  - [x] `GameState` (mínimo; serialização em 2×u32 por máscara, para evitar `BigInt` no boundary):
    - [x] `blackLo: u32`, `blackHi: u32` (61 bits)
    - [x] `whiteLo: u32`, `whiteHi: u32` (61 bits)
    - [x] `playerToMove: u8` (0=pretas, 1=brancas)
    - [x] `primeiraJogada: bool` (exceção: 1ª jogada das pretas = 1 peça)
  - [x] `Move` (mínimo):
    - [x] `posA: i16`, `colorA: u8` (0=preta, 1=branca)
    - [x] `posB: i16`, `colorB: u8` (usar `posB = -1` quando for jogada única)
  - [x] `AiConfig` (mínimo):
    - [x] `difficulty: u8` (0..4)
    - [x] `timeMs: u32`
    - [x] `candidateK: u16`
    - [x] `endgameEmptyN: u8`
    - [x] `seed?: u64` (via number; `u32` efectivo no TS)
  - DoD:
    - [ ] Tipos estão definidos em TS (ex.: `src/games/produto/ai/types.ts`) e em Rust (serde) com testes de round-trip simples.

---

## M1 — Core correctness (regras, grupos, pontuação)

- [x] **Criar crate Rust para Produto (WASM-ready)**
  - [ ] Estrutura recomendada (similar ao que já existe noutros jogos):
    - [x] `wasm/produto_ai/Cargo.toml`
    - [x] `wasm/produto_ai/src/lib.rs` (exports WASM)
    - [x] `wasm/produto_ai/src/core/{board.rs,groups.rs,scoring.rs,movegen.rs,ai.rs}`
  - DoD:
    - [x] Compila e passa `cargo test` (offline).

- [x] **Representação eficiente do tabuleiro**
  - [x] `FULL_MASK` com 61 bits.
  - [x] `black_mask`, `white_mask`, `empty_mask`.
  - [x] Vizinhanças pré-computadas: `neighbours[61]` (bitmask).
  - DoD:
    - [x] Invariantes validadas no boundary (`choose_move` recusa overlap/out-of-range).

- [x] **Grupos e pontuação**
  - [x] `compute_groups(mask) -> Vec<u8>` (DFS/BFS por bitboard) — implementado como `group_sizes`.
  - [x] `top2_product(mask) -> u32` — parte de `score_for`.
  - [x] `winner(black_mask, white_mask)` com desempate “menos peças da sua cor”.
  - DoD:
    - [ ] Fixtures equivalentes aos testes de TS em `src/games/produto/logic.test.ts` (produto, casos `<2` grupos, sabotagem/unificação).

---

## M2 — Gerador de movimentos (candidatos + validação)

- [x] **Validador de jogadas**
  - [x] Impedir colocar em casa ocupada.
  - [x] Impedir 2ª posição igual à 1ª.
  - [x] Respeitar `primeira_jogada` (apenas 1 peça).
  - DoD:
    - [ ] `choose_move` nunca devolve jogada inválida (testes).

- [x] **Geração de candidatos (para não explodir branching)**
  - [x] Vazios adjacentes a qualquer peça (própria/adversária).
  - [x] “Bridges”: vazios que tocam ≥2 componentes da mesma cor (para conectar).
  - [x] Fallback: incluir todos os vazios quando necessário.
  - DoD:
    - [ ] Config `candidate_k` limita a explosão (documentado e testado em estados densos).

---

## M3 — Níveis 1–3 (random → heurística → minimax)

- [x] **Nível 1 (Fácil): random válido e determinístico por seed**
  - DoD:
    - [ ] Com `seed` fixa, a jogada é reprodutível.

- [x] **Nível 2 (Médio): heurística 1-ply**
  - [x] Avaliar top-K movimentos candidatos.
  - [ ] Heurística mínima:
    - [x] `prod_diff` (nosso produto − produto adversário)
    - [x] penalização forte se `<2 grupos` (nosso)
    - [x] bónus por “equilíbrio” dos 2 maiores grupos (maximiza produto)
    - [x] bónus por sabotagem (reduzir adversário para 0 quando fica com 1 grupo)
    - [x] ligeira preferência por menos peças próprias (desempate)
  - DoD:
    - [ ] Em auto-play local, o Médio vence o Fácil de forma consistente (ex.: >65% em 100 jogos).

- [x] **Nível 3 (Difícil): minimax 2-ply + alpha-beta**
  - [x] Ordenar movimentos por heurística para maximizar poda.
  - [x] Budget por `timeMs` (corte por deadline).
  - DoD:
    - [ ] Difícil vence Médio de forma consistente (ex.: >55% em 100 jogos).

---

## M4 — Níveis 4–5 (MCTS + endgame exacto)

- [ ] **Nível 4 (Muito difícil): MCTS UCT com orçamento baixo**
  - [ ] UCT: `Q/N + c*sqrt(ln(Np)/N)`.
  - [ ] Progressive widening (mais ações conforme visitas do nó).
  - [ ] Rollout guiado leve (evitar decisões obviamente más; terminar sempre em estado final).
  - DoD:
    - [ ] Com `seed` fixa e `iters` fixa, o resultado é reprodutível.

- [ ] **Nível 5 (Máximo): MCTS intensivo + endgame exacto**
  - [ ] Se `empty_count <= endgame_empty_n`, trocar para minimax completo (resultado exacto).
  - DoD:
    - [ ] Tempo médio por jogada no browser <= 15s (máquina comum) com preset “Máximo”.

---

## M5 — WASM API + Worker TypeScript (integração obrigatória)

- [x] **Exports WASM mínimos e estáveis**
  - [x] `init_ai(seed?: u64)` (aceita `u32` no TS)
  - [x] `choose_move(state, cfg) -> Move` (via `JsValue` com objetos simples)
  - [x] `explain_last()`
  - DoD:
    - [ ] API documentada e usada pelo Worker (sem chamadas diretas na UI).

- [x] **Worker dedicado para IA (não bloquear UI)**
  - [x] Criar `src/games/produto/ai/produto.worker.ts`.
  - [x] Criar client `src/games/produto/ai/ai-client.ts`.
  - [x] Fallback TS (random) no worker + fallback UI para `jogadaComputador`.
  - DoD:
    - [x] UI permanece responsiva durante “a pensar…” (Worker).

- [x] **Adaptador de estado TS → bitmasks**
  - [x] Converter `ProdutoState.tabuleiro` (Map `"q,r"`) → masks (`packState`).
  - [x] Converter `Move` (índices) → `Posicao` + cores e aplicar via `colocarPeca` (`decodeMove` + `ProdutoGame`).
  - DoD:
    - [x] Move aplicado no TS respeita abertura e jogada dupla.

---

## M6 — Build/Deploy + testes de aceitação

- [x] **Build script**
  - [x] Estender `build.ts` para:
    - [x] compilar `wasm/produto_ai` para `src/games/produto/ai/wasm/pkg`
    - [x] bundlar worker para `dist/ai/produto/produto.worker.js`
    - [x] copiar `pkg` para `dist/ai/produto/wasm/pkg`
  - DoD:
    - [x] `bun run build.ts --skip-wasm` produz os assets do worker no `dist/` (e copia `pkg` se existir).

- [x] **Testes**
  - [x] Rust unit tests (adjacência, grupos, pontuação, invariantes, abertura).
  - [x] TS sanity tests (mapeamento e regras base).
  - [ ] Auto-play (headless) para comparar níveis (ex.: 200 jogos por matchup).
  - DoD:
    - [x] `bun test` passa.
    - [x] `cargo test` passa (na crate `wasm/produto_ai`).

---

## Comandos úteis (referência)

- Correr testes TS: `bun test`
- Build do site: `bun run build.ts`
- Build sem WASM (dev/sem toolchain): `bun run build.ts --skip-wasm`
- Rust (exemplos; ajustar ao nome final das crates):
  - `cargo test -p produto_ai`
  - `cargo build -p produto_ai --release --target wasm32-unknown-unknown`
