# Plano executável — IA forte para Atari Go (Rust + WASM + TS/Worker)

Base: `docs/ATARIGO-IA.md`.

## Como usar este checklist

- Cada item é uma tarefa “fechável” (marcar `x` quando concluído).
- “DoD” = Definition of Done (critérios mínimos para dar a etapa como concluída).
- Objetivo final: substituir/acompanhar a IA TS atual por uma IA Rust/WASM forte **sem bloquear UI** (Worker obrigatório) e com **níveis**.

---

## M0 — Auditoria do estado atual (TS) + decisões de interface

- [ ] **Auditar regras e engine TS existentes**
  - [ ] Ler `src/games/atari-go/logic.ts` (regras, captura, suicídio, vitória na 1ª captura).
  - [ ] Ler `src/games/atari-go/logic.test.ts` (fixtures e expectativas).
  - [ ] Ler `src/games/atari-go/AtariGoGame.tsx` (onde chama `jogadaComputador`).
  - DoD:
    - [ ] Lista de invariantes e “truth table” das regras (suicídio permitido só se capturar e terminar).
    - [ ] Pontos de integração identificados (substituição de `jogadaComputador` por Worker).

- [ ] **Decidir formato de estado TS↔WASM (contrato)**
  - [ ] Opção A (simples e robusta): `board: Uint8Array(81)` com valores `0 vazio, 1 preta, 2 branca` + `toPlay: u8`.
  - [ ] Opção B (mais rápido): bitboards (ex.: 2×`u128` no Rust) expostos ao JS como 4×`u32` por cor (evitar `BigInt`).
  - [ ] Decidir também: índice linear `idx = linha*9 + coluna` (0..80).
  - DoD:
    - [ ] `types.ts` no TS com `AiConfig`, `AiStats`, `AiMove` e `AtariGoPackedState`.
    - [ ] Payload de mensagens do Worker fechado (request/response com `requestId`).

---

## M1 — Crate Rust `wasm/atari_go_ai` (core correctness + API WASM)

- [ ] **Criar crate Rust WASM-ready**
  - [ ] `wasm/atari_go_ai/Cargo.toml`
  - [ ] `wasm/atari_go_ai/src/lib.rs` (exports wasm-bindgen)
  - [ ] `wasm/atari_go_ai/src/core/` (board, groups, rules, zobrist, tt, search, eval, movegen)
  - DoD:
    - [ ] `cargo test` passa no crate.

- [ ] **Implementar representação do tabuleiro (performance)**
  - [ ] Pré-computar vizinhança ortogonal por interseção (81 máscaras).
  - [ ] Guardar estado no Rust com bitboards (interno), mesmo que o boundary use `board[81]`.
  - [ ] Implementar conversões: `board[81] -> bitboards` e (se necessário) `bitboards -> board[81]`.
  - DoD:
    - [ ] Operações básicas (get/set) e geração de vizinhos sem alocações.

- [ ] **Implementar regras: legalidade, captura e terminal**
  - [ ] Gerar jogadas legais (inclui suicídio proibido).
  - [ ] Exceção: suicídio permitido **apenas** quando a jogada captura (e portanto termina o jogo).
  - [ ] `apply_move(idx)` atualiza incrementalmente e devolve vencedor quando há captura.
  - DoD:
    - [ ] Mesmos resultados que TS para cenários de captura/suicídio/atari (fixtures equivalentes).

- [ ] **Expor API WASM mínima (como no doc)**
  - [ ] `init(seed: u64)`
  - [ ] `set_position(board: Uint8Array, to_play: u8)`
  - [ ] `best_move(time_ms: u32, level: u8) -> i32`
  - [ ] `apply_move(idx: i32) -> MoveResult`
  - [ ] `legal_moves() -> Vec<i32>` (ou bitset)
  - [ ] `stats() -> JsValue` (nodes, depth, tt_hits, cutoffs, ms)
  - DoD:
    - [ ] Boundary sem cópias desnecessárias (usar `Uint8Array`/memória WASM com cuidado).

---

## M2 — Gerador de jogadas + make/unmake (para busca)

- [ ] **Movegen eficiente**
  - [ ] Geração de legais sem alocação pesada (reutilizar buffers).
  - [ ] “Terminação imediata”: se existir captura legal no nó atual, devolver esse lance na raiz (vitória no nó).
  - DoD:
    - [ ] `legal_moves()` bate certo com o TS em estados aleatórios (property-like test simples).

- [ ] **make/unmake (delta)**
  - [ ] Aplicar jogada com atualização incremental.
  - [ ] Desfazer jogada com stack de deltas (pedra colocada + pedras capturadas).
  - DoD:
    - [ ] Sequência make/unmake retorna exatamente ao hash/bitboards anteriores.

---

## M3 — Função de avaliação + ordenação de movimentos

- [ ] **Avaliação heurística (não-terminal)**
  - [ ] Componente principal: diferença de liberdades (próprio − adversário).
  - [ ] Sinais adicionais baratos:
    - [ ] conectividade (nº grupos / tamanhos)
    - [ ] “pressão” tática: contagem de grupos em atari (1 liberdade) de ambos os lados
    - [ ] liberdades 2ª/3ª ordem via bitmasks (aproximação)
  - [ ] (Opcional) Aproximação olhos/território (barata) se valer o custo.
  - DoD:
    - [ ] Avaliação simétrica (trocar cores inverte sinal).

- [ ] **Ordenação (obrigatório para força)**
  - [ ] Primeiro: capturas imediatas (ganho no nó).
  - [ ] Depois: salvar grupos próprios em atari; depois colocar adversário em atari.
  - [ ] Killer moves + history heuristic.
  - DoD:
    - [ ] Melhor lance da TT/iterative deepening vai para topo (PV move ordering).

---

## M4 — Motor de decisão: PVS/αβ + TT + iterative deepening

- [ ] **Implementar Zobrist hashing**
  - [ ] Hash incremental no make/unmake.
  - DoD:
    - [ ] Teste: hashes iguais para estados iguais via sequência diferente de jogadas (quando aplicável).

- [ ] **Tabela de transposição (TT)**
  - [ ] Armazenar: key, depth, value, flag (exact/lower/upper), best_move.
  - [ ] Política de substituição tipo “TwoDeep” (prioriza entradas mais profundas).
  - DoD:
    - [ ] Métrica `tt_hits` disponível em `stats()`.

- [ ] **Negamax αβ com PVS**
  - [ ] PVS no interior, full window no primeiro filho, null window nos seguintes.
  - [ ] Cutoffs por TT e por β.
  - DoD:
    - [ ] Respeita `deadline` (corte por tempo) e devolve melhor da última profundidade completa.

- [ ] **Iterative deepening + aspiration windows**
  - [ ] Profundidade crescente até `time_ms`.
  - [ ] Aspiration window em torno do score anterior, com re-search quando falha.
  - DoD:
    - [ ] `stats().depth` cresce conforme orçamento e máquina.

- [ ] **Extensões táticas (nível alto)**
  - [ ] Quiescence/extends local em situações de atari (grupos com 1 liberdade) para reduzir blunders.
  - DoD:
    - [ ] Melhoria observável vs sem extensões em posições táticas (fixtures).

---

## M5 — Níveis de dificuldade (configuráveis e “pedagógicos”)

- [ ] **Definir presets por nível**
  - [ ] Nível 1: profundidade baixa, sem TT, ordenação simples, ruído top-k.
  - [ ] Nível 2: profundidade média, TT, killer/history.
  - [ ] Nível 3: PVS + TT + heurísticas completas + iterative deepening.
  - [ ] Nível 4: como nível 3 com orçamento maior + extensões/quiescence em ataris.
  - DoD:
    - [ ] Tabela documentada de parâmetros por nível (tempo alvo/limites).

- [ ] **Ruído controlado (níveis baixos)**
  - [ ] Escolha estocástica entre top-k (com seed) para variar e ser mais “humano”.
  - DoD:
    - [ ] Com seed fixa, decisões reprodutíveis.

---

## M6 — Integração TS (Worker) + build/deploy + validação final

- [ ] **Criar Worker de IA (não bloquear UI)**
  - [ ] `src/games/atari-go/ai/atari-go.worker.ts` (carrega WASM e responde a mensagens).
  - [ ] `src/games/atari-go/ai/ai-client.ts` (API async no main thread).
  - [ ] Integração em `src/games/atari-go/AtariGoGame.tsx` (substituir `setTimeout(() => jogadaComputador...)` por request ao Worker).
  - DoD:
    - [ ] UI continua responsiva enquanto a IA pensa.
    - [ ] Cancelamento por `requestId`/“stale response” (ignorar respostas antigas).

- [ ] **Atualizar pipeline de build (Bun) para WASM + Worker**
  - [ ] Adicionar build do crate `wasm/atari_go_ai` em `build.ts` (similar a Produto/Dominório).
  - [ ] Gerar `src/games/atari-go/ai/wasm/pkg` (wasm-bindgen `--target web`).
  - [ ] Bundlar Worker para `dist/ai/atari-go/atari-go.worker.js`.
  - DoD:
    - [ ] `bun run build.ts --skip-wasm` continua a funcionar com fallback TS.

- [ ] **Testes e regressões**
  - [ ] Rust unit tests:
    - [ ] grupos/liberdades, captura, suicídio, vitória imediata, make/unmake, hash/TT invariants
  - [ ] TS tests:
    - [ ] manter `src/games/atari-go/logic.test.ts` como oracle; adicionar testes do adaptador/packing se necessário
  - [ ] Auto-jogo:
    - [ ] novo motor vs `jogadaComputador` baseline (200+ jogos) e medir winrate
  - DoD:
    - [ ] `bun test` passa.
    - [ ] `cargo test` passa no crate `wasm/atari_go_ai`.

- [ ] **Benchmarks / métricas**
  - [ ] Expor `stats()` e log opcional no Worker (debug mode).
  - [ ] Recolher: nós/s, tt hit-rate, cutoffs, profundidade por nível.
  - DoD:
    - [ ] Nível “Difícil” decide dentro do orçamento (ms) em máquina comum.

---

## Comandos úteis (referência)

- Testes TS: `bun test`
- Build: `bun run build.ts`
- Build sem WASM: `bun run build.ts --skip-wasm`
- Rust (quando existir o crate):
  - `cargo test --manifest-path wasm/atari_go_ai/Cargo.toml`
  - `cargo build --manifest-path wasm/atari_go_ai/Cargo.toml --release --target wasm32-unknown-unknown`

