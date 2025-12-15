Tarefa: Desenvolver IA para o jogo “Produto” (CRJM) em Rust + WebAssembly, integrada num frontend TypeScript (GitHub Pages)

Contexto e regras do jogo (base oficial):
- Tabuleiro hexagonal lado 5 (61 casas). Máx. 45 peças pretas + 45 brancas. Pretas começam.
- Cada turno (excepto o 1.º das Pretas) coloca 2 peças em 2 casas vazias; cada peça pode ser preta ou branca (podes jogar cor do adversário).
- No fim, para cada cor calcula-se: produto do tamanho dos 2 maiores grupos conectados dessa cor. Se tiver <2 grupos, pontuação 0.
- Ganha quem tiver maior produto; desempate: ganha quem tiver menos peças da sua cor no tabuleiro.
- Grupos = conectividade por adjacência hexagonal. :contentReference[oaicite:0]{index=0}

Objetivo da entrega:
- Implementar motor de decisão (“bot”) com níveis de dificuldade incrementais:
  1) Fácil: aleatório válido.
  2) Médio: heurística gananciosa (1-ply).
  3) Difícil: minimax superficial + alpha-beta (2-ply) com heurística.
  4) Muito difícil: MCTS (UCT) com orçamento baixo (iterações/tempo).
  5) Máximo: MCTS intensivo + endgame exacto (minimax completo quando restarem <= N vazios, p.ex. 10).
- Deve funcionar no browser (WASM), sem bloquear UI (usar Web Worker no TS; opcionalmente threads WASM se o setup permitir).

Requisitos de arquitectura (obrigatórios):
1) API WASM mínima e estável
- Exportar pelo menos:
  - init_ai(seed?: u64)
  - choose_move(state: GameState, cfg: AiConfig) -> Move
  - optional: explain_last() -> Explanation (para debug/ensino)
- Definir formatos TS<->WASM (serde + wasm-bindgen):
  - GameState: bitboards/arrays para ocupação e jogador da vez + “turno inicial” especial.
  - Move: (posA, colorA, posB, colorB) com suporte ao 1.º lance (apenas uma peça: posB = -1, ou flag).

2) Representação eficiente do tabuleiro
- Mapear 61 casas para índices [0..60].
- Pré-computar adjacências: neighbours[61] bitmask (u64) ou lista curta.
- Guardar ocupação como:
  - black_mask: u64 (61 bits)
  - white_mask: u64
  - empty_mask = FULL ^ (black|white)
- Garantir validação: casas disjuntas; não exceder limites; turno 1 das Pretas só 1 colocação.

3) Cálculo de grupos e pontuação (core correctness)
- Funções:
  - compute_groups(mask: u64) -> Vec<u8> tamanhos dos componentes (BFS/DFS bitboard).
  - top2_product(mask: u64) -> u32 (0 se <2 grupos).
  - final_score(state) -> (black_prod, white_prod, black_count, white_count, winner)
- Atenção ao desempate “menos peças da cor em jogo”.

4) Gerador de movimentos (branching enorme)
- Para um estado, gerar movimentos possíveis sem explodir:
  - Para heurística/minimax: gerar “candidatos” (pruning por relevância):
    - casas adjacentes a grupos próprios ou do adversário
    - casas que ligam componentes (bridges): vazios que tocam >=2 componentes da mesma cor
    - fallback: amostrar aleatoriamente de vazios
  - Para MCTS: pode usar amostragem/expansão progressiva:
    - progressive widening (aumentar nº de acções consideradas conforme visitas do nó)
    - ou um “policy prior” simples para ordenar acções.

5) Níveis de IA (implementação detalhada)
A) Fácil (random):
- Escolher 2 vazios uniformemente (1 no 1.º turno).
- Cores aleatórias ou uma regra simples (p.ex. 50/50).

B) Médio (heurística 1-ply):
- Avaliar K movimentos candidatos (K configurável: 200–1000).
- Heurística sugerida (normalizar e ponderar):
  - prod_diff_now = (prod_own_now - prod_opp_now)
  - penalty_if_own_groups<2 (grande)
  - penalty_if_own_top2_close (distância curta entre 2 maiores grupos) 
  - bonus_expand_own (vazios adjacentes aos 2 maiores grupos)
  - bonus_connect_opp (se a jogada une grupos grandes do adversário numa só componente)
- Escolher argmax.

C) Difícil (minimax 2-ply + alpha-beta):
- Profundidade fixa 2 plies (tu, adversário) com mesmos candidatos do nível médio.
- Ordenar movimentos por heurística antes de expandir para maximizar poda.
- Avaliação leaf = heurística melhorada.

D) Muito difícil / Máximo (MCTS UCT):
- Nó: estado, jogador a mover, stats (visits, wins).
- Seleção UCT: Q/N + c * sqrt(ln(N_parent)/N_child)
- Expansão: progressive widening (começar com poucos movimentos; adicionar mais).
- Rollout:
  - Aleatório guiado leve: evitar ligar os próprios 2 maiores grupos se já tens >=2; procurar ligar grupos do adversário quando há ponte óbvia.
  - Terminar sempre em estado final (tabuleiro cheio) para obter winner exacto.
- Backprop: win=1 para vitória do jogador do nó raiz; win=0 para derrota.
- Orçamento:
  - por iterações (p.ex. 2k/10k/50k/200k) ou tempo (ms) configurável por nível.
- Endgame solver:
  - Se empty_count <= N (config), trocar para minimax completo (sem heurística; usar resultado final exacto).

6) Integração TypeScript (obrigatório)
- Criar Worker dedicado para a IA:
  - envia GameState + AiConfig
  - recebe Move + (opcional) Explanation
- Evitar congelar UI: comunicação assíncrona; limitar tempo.
- Expor configuração de dificuldade no UI.

7) Testes e validação (obrigatório)
- Testes unitários em Rust:
  - adjacências correctas (grafo do hex lado 5)
  - pontuação final em posições conhecidas (criar fixtures)
  - invariantes de estado (disjunção máscaras, contagens)
- Teste de força:
  - auto-play: nível N vs nível N-1 em 200 jogos; verificar taxa de vitória > limiar.
- Teste determinismo:
  - com seed fixa, MCTS deve ser reprodutível.

8) Entregáveis
- crate Rust com wasm-bindgen:
  - lib.rs (exports)
  - core/ (board.rs, groups.rs, scoring.rs, movegen.rs, heuristics.rs, minimax.rs, mcts.rs)
  - tests/
- wrapper TS:
  - aiWorker.ts
  - types.ts (GameState/Move/AiConfig)
  - integração no jogo existente (hook “requestAIMove”)
- Documentação curta:
  - como compilar wasm (wasm-pack ou wasm-bindgen + cargo)
  - como correr localmente e como deploy no GitHub Pages
  - parâmetros por dificuldade

Critérios de aceitação
- Correctness: regras e desempate exactos; jogadas sempre válidas.
- Performance: orçamento por nível (ex.: ~3s no Fácil até <= 15s no Máximo) no browser (máquina comum).
- Qualidade: MCTS supera consistentemente minimax 2-ply em auto-play.
- Integração: TypeScript chama WASM via Worker sem bloquear UI.
