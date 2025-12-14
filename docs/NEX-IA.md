Plano executável: `docs/PLANO-NEX-IA.md`.

Tarefa: desenvolver uma IA forte para o jogo Nex, integrada num front-end TypeScript (GitHub Pages) e num motor de decisão em Rust compilado para WebAssembly, com tempo máximo de decisão por jogada de 2 a 3 segundos.

Contexto de regras e estado
- Tabuleiro lógico 11x11 (121 casas) em grelha hexagonal losango.
- Estados de casa: vazia, preta, branca, neutra.
- Cada turno é UMA ação:
  A) Colocação: colocar 1 peça da cor do jogador + 1 peça neutra em casas vazias.
  B) Substituição: converter 2 neutras em peças do jogador e converter 1 peça do jogador em neutra.
- Swap (Regra da Torta): apenas no primeiro turno do segundo jogador, opção de trocar de cor (pie rule: troca a cor atribuída aos jogadores) e consumir esse turno.

Objetivo
- Maximizar taxa de vitória.
- Produzir níveis de dificuldade incrementais.
- Não bloquear UI. Executar IA num Web Worker. Rust/WASM faz o trabalho pesado. TypeScript apenas prepara estado e aplica o movimento.

Arquitetura a implementar
1) Novo módulo Rust: wasm/nex_ai
- wasm-bindgen export:
  - fn choose_move(board: Uint8Array(121), to_play: u8, flags: u8, ms_budget: u32, level: u8, seed: u32) -> JsValue
- Entrada: estado mínimo (tabuleiro + cor do jogador atual + flags swapDisponivel/swapEfetuado/primeiraJogada).
- Saída: JSON com uma destas ações:
  - { type: "swap" }
  - { type: "recusar_swap" }
  - { type: "colocar", own: {x,y}, neutral: {x,y} }
  - { type: "substituir", n1:{x,y}, n2:{x,y}, sacrifice:{x,y} }
- Implementar também uma função opcional:
  - fn debug_eval(state_json: &str) -> String  (para inspeção e tuning)

2) Wrapper TypeScript
- Criar `src/games/nex/ai/*` que:
  - inicializa WASM
  - comunica via Web Worker
  - impõe orçamento de tempo e fallback (para a IA TS atual)
- Integrar em NexGame.tsx:
  - selecionar nível (easy/medium/hard/master)
  - garantir que swapDisponivel é respeitado

Motor de jogo em Rust
A) Representação e pré-cálculos
- Mapear (x,y) -> idx [0..120].
- Pré-computar vizinhos hexagonais para cada idx (lista fixa até 6 vizinhos).
- Pré-computar listas de bordas-alvo por cor (margens a ligar).
- Zobrist hashing para transposition table.

B) Verificação de vitória e distância
- Implementar verificar_vitoria(cor) por BFS/DFS sobre peças dessa cor.
- Implementar distancia_minima_para_conectar(cor) como Dijkstra/0-1 BFS:
  - custo 0 para célula da própria cor
  - custo 1 para vazia ou neutra
  - custo muito alto/intransponível para célula do adversário
- Esta distância é a base da função de avaliação.

C) Geração de movimentos (redução agressiva do branching)
- Gerar candidatos “relevantes”:
  - casas vazias adjacentes (distância 1 e 2) a qualquer peça (própria, adversária, neutra)
  - reforço de centro no início
- Colocação:
  - escolher K1 candidatos para own (ex: 20 a 40 conforme fase)
  - para cada own, escolher K2 candidatos para neutral:
    - bloqueios em “corredores” do adversário (aumentar dist adversária)
    - proximidade a ligações críticas
- Substituição:
  - escolher top N neutras estratégicas (em caminhos mínimos próprios, adjacentes a grupos próprios, ou que criem ameaça imediata)
  - escolher sacrifício entre peças próprias de baixo impacto (fora do caminho mínimo, baixa centralidade, não-pivô de conectividade)
- Sempre respeitar validade: colocação exige 2 vazias; substituição exige 2 neutras + 1 própria.

D) Padrões táticos obrigatórios
- Prioridade absoluta:
  1) vitória imediata em 1 lance (colocação ou substituição)
  2) bloquear vitória imediata adversária no próximo lance
- Detetor de ameaças múltiplas:
  - contar número de “lances vencedores imediatos” disponíveis para cada lado no próximo turno
  - tratar 3 ameaças simultâneas como estado praticamente decisivo
- Swap:
  - decidir swap com base em distância_minima (ex: se adversário estiver pelo menos 2 “passos” mais perto, executar swap)

Algoritmos por nível de dificuldade
Nível 1 (easy)
- Heurística 1-ply semelhante à atual, mas em Rust e com melhor geração de candidatos.
- Score principal: (distAdv - distMinha) * Wdist + ajustes.

Nível 2 (medium)
- 1-ply exaustivo sobre o conjunto reduzido de movimentos.
- Função de avaliação expandida:
  - distâncias
  - ameaças imediatas (meu e adversário)
  - penalização por abrir dupla ameaça adversária
  - bónus por centralização apenas no opening
  - bónus por “bloqueio efetivo” via neutra

Nível 3 (hard)
- Minimax 2-ply com poda alpha-beta e ordenação de jogadas.
- Iterative deepening até ao orçamento de tempo.
- Transposition table com Zobrist.
- Move ordering:
  - vitórias imediatas
  - bloqueios imediatos
  - menor distMinha
  - maior distAdv
  - maior contagem de ameaças criadas

Nível 4 (master)
- MCTS (UCT) com:
  - progressive widening (começar com top 5-10 movimentos e aumentar com visitas)
  - rollouts guiados por heurística (não aleatório puro)
  - orçamento de tempo rígido em ms_budget
  - fallback para melhor política se tempo esgotar
- Opcional: no endgame (poucas casas vazias/neutras) ativar busca exata limitada, se couber no tempo.

Performance e integração
- Tempo alvo: 2-3 segundos por jogada em hardware típico de browser.
- Executar num Web Worker; UI nunca bloqueia.
- Determinismo controlado via seed para repetibilidade em testes.
- Garantir que choose_move termina sempre dentro do budget, devolvendo melhor movimento conhecido até ao momento.

Testes e validação
- Testes unitários Rust:
  - validade de movimentos gerados
  - swap aplicado corretamente
  - verificar_vitoria consistente
  - distancia_minima coerente com casos simples
- Testes de regressão:
  - master vs bot TS atual deve ganhar esmagadoramente
  - hard vs medium > 60% a 70% (ajustar)
- Benchmarks:
  - tempo médio por jogada por nível
  - número de nós avaliados (alpha-beta) e iterações (MCTS)

Entregáveis
- PR com:
  - wasm/nex_ai (Rust + wasm-bindgen)
  - wrapper TS + worker
  - integração UI com níveis
  - documentação curta: algoritmo, limites, tuning de parâmetros
  - scripts de build WASM consistentes com o resto do repositório
