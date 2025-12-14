Implementar IA forte para Atari Go (TypeScript + Rust/WASM)

Contexto e regras

* Jogo: Atari Go (Capture Go) em tabuleiro 9×9, vitória na primeira captura.  
* Grupo: conjunto de pedras da mesma cor ligadas ortogonalmente; liberdades: interseções vazias adjacentes ao grupo. 
* Jogada ilegal: colocar pedra que deixa o próprio grupo sem liberdades, exceto quando a jogada captura e termina o jogo. 
* Front-end existente em TypeScript (GitHub Pages) com IA básica; nova IA em Rust compilada para WASM.

Objetivo

* Substituir/acompanhar a IA básica por uma IA forte, responsiva e configurável por níveis, para treino humano vs IA em 9×9. 

Estratégia principal a implementar

1. Motor de decisão: Alpha-Beta com PVS + aprofundamento iterativo

* Implementar Principal Variation Search (PVS) com aprofundamento iterativo. 
* Tabela de transposição (Zobrist) com política de substituição tipo TwoDeep e cut-offs por transposição. 
* Ordenação de movimentos com killer moves e history heuristic. 
* Terminação imediata quando existir captura legal no lance atual (vitória já no nó). 

2. Função de avaliação (para nós não-terminais)

* Basear avaliação nos quatro objetivos: maximizar liberdades próprias, maximizar território controlado, conectar pedras, formar olhos.  
* Simétrico para o adversário: minimizar liberdades e fragmentar grupos adversários. 
* Peso forte na diferença de liberdades (próprio − adversário) como componente principal. 
* Heurísticas táticas obrigatórias na geração/ordenação:

  * Prioridade máxima: salvar grupos próprios em atari (1 liberdade) e colocar grupos adversários em atari. 

3. Estruturas de dados e desempenho

* Representação do tabuleiro com bitboards (81 bits por cor) e máscaras de vizinhança pré-computadas por interseção. 
* Controlo de grupos/liberdades com union-find ou estrutura de grupos incremental (fusão de grupos, atualização local de liberdades, remoções em captura).  
* Calcular também liberdades de 2.ª e 3.ª ordem como sinal adicional barato (máscaras bitwise).  
* Opcional: aproximar conectividade/olhos via número de Euler para baratear a avaliação. 

Arquitetura Rust/WASM e integração TS

* Criar crate Rust `atari_go_ai` com API WASM via wasm-bindgen. 
* Executar a IA num Web Worker para não bloquear UI; comunicação por mensagens com payload compacto (ArrayBuffer).  
* Minimizar cópias JS↔WASM:

  * Representar estado como array de 81 bytes (0 vazio, 1 preto, 2 branco) ou dois u128 (bitboards) e um `to_play`. 
  * Manter estado interno no módulo Rust quando possível (aplicar jogadas incrementalmente). 
* Considerar execução single-thread no WASM; sem dependência de threads WASM. 

API mínima (WASM) a expor

* `init(seed: u64)`
* `set_position(board: Uint8Array, to_play: u8)`
* `best_move(time_ms: u32, level: u8) -> i32`  // retorna índice 0..80 ou -1 se sem jogada (não deve ocorrer)
* `apply_move(idx: i32) -> MoveResult`  // valida, aplica, devolve capturas e vencedor (se terminou)
* `legal_moves() -> Bitset/Vec<i32>` (para debug e testes)
* `stats() -> {nodes, depth, tt_hits, cutoffs, ms}`

Níveis de dificuldade

* Implementar níveis por orçamento e qualidade de busca:

  * Nível 1: profundidade baixa, sem TT, ordenação simples
  * Nível 2: profundidade média + TT + killer/history
  * Nível 3: PVS + TT + heurísticas completas + aprofundamento iterativo
  * Nível 4: como nível 3 com orçamento maior e quiescence local em ataris (extensões táticas)
* Adicionar ruído controlado nos níveis baixos (escolher entre top-k com probabilidade) para progressão pedagógica.
* Opcional de design didático: “fases” por quadrantes 5×5 dentro do 9×9 e expansão gradual de área de jogo. 
* Opcional de regra alternativa para treino: vitória por capturar n pedras (n configurável). 

Fallback / Fase 2 opcional

* Implementar MCTS leve (sem rede neural) como alternativa experimental, com playouts enviesados para reduzir liberdades do adversário, limitado por orçamento. 

Plano de trabalho e entregáveis

1. Ler o código TypeScript existente e identificar:

* Representação atual do tabuleiro e regras
* Interface atual da IA básica e pontos de integração

2. Implementar em Rust:

* Gerador de jogadas legais conforme regras (inclui exceção de “suicídio” só quando captura). 
* Aplicação de jogada com atualização incremental de grupos/liberdades
* Avaliação heurística + ordenação de movimentos
* Motor PVS/alpha-beta com TT e aprofundamento iterativo. 

3. Integrar:

* Compilação para wasm32-unknown-unknown
* Wrapper TS + Web Worker
* Troca de mensagens e aplicação do movimento no front-end

4. Testes e validação

* Testes unitários Rust:

  * contagem de liberdades, detecção de grupos, captura, jogadas ilegais, vitória imediata
* Testes de regressão:

  * reproduzir exemplos do enunciado (capturas A8/I8; jogadas inválidas A1/C1). 
* Benchmarks:

  * garantir decisão dentro do orçamento por nível e recolher métricas (nós/s, TT hit-rate)

Critérios de aceitação

* Correção total das regras e terminação na primeira captura. 
* IA “Difícil” claramente superior à IA básica em séries de 200+ jogos (auto-jogo vs baseline)
* UI não bloqueia durante cálculo (worker obrigatório). 
* Código entregue com documentação curta: API, níveis, orçamentos, como compilar WASM, como correr testes
