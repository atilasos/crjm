## 1. Atari Go (Capture Go)
**Fonte:** `Tabuleiro-regras_Atari_GO.pdf`

Este é uma variante simplificada do Go, ideal para introduzir o conceito de captura.

### Lógica do Jogo (Regras)

* [cite_start]**Tabuleiro:** Quadrado, grelha 9x9 (interseções das linhas)[cite: 4].
* [cite_start]**Peças:** 40 Pretas, 40 Brancas[cite: 4].
* **Estado Inicial:** Tabuleiro vazio. [cite_start]As Pretas jogam primeiro[cite: 22, 23].
* **Definições:**
    * [cite_start]**Grupo:** Conjunto de peças da mesma cor ligadas vertical ou horizontalmente[cite: 7].
    * [cite_start]**Liberdade:** Interseção vazia adjacente (vertical ou horizontal) a uma peça ou grupo[cite: 12].
* [cite_start]**Turno:** O jogador coloca uma peça da sua reserva numa interseção vazia[cite: 24].
* [cite_start]**Captura:** Se um grupo adversário ficar sem liberdades (0 liberdades) após a jogada, é capturado[cite: 25].
* [cite_start]**Suicídio:** É proibido colocar uma peça onde o grupo resultante fique sem liberdades, **exceto** se essa jogada resultar na captura imediata de peças adversárias[cite: 26].
* [cite_start]**Condição de Vitória:** O primeiro jogador a efetuar **qualquer captura** vence imediatamente o jogo[cite: 5, 25].

### Heurísticas para a IA (Estratégia)

Como o objetivo é a *primeira* captura, a IA deve ser muito mais tática e agressiva do que no Go tradicional.

1.  **Segurança Imediata (High Priority):**
    * Verificar se algum grupo próprio tem apenas **1 liberdade** (está em *Atari*). Se sim, a única jogada válida é aumentar as liberdades desse grupo (estender ou capturar o atacante).
2.  **Ataque Imediato (High Priority):**
    * Verificar se algum grupo adversário tem **1 liberdade**. Se sim, jogar nessa liberdade para vencer o jogo.
3.  **Avaliação de Posição (Score):**
    * **Contagem de Liberdades:** Priorizar jogadas que maximizam as liberdades dos próprios grupos e minimizam as do adversário.
    * **Conectividade:** Grupos maiores são mais difíceis de rodear, mas cuidado para não criar um grupo grande com poucas liberdades (forma pesada).
    * **Cortes:** Identificar pontos que cortam grupos adversários em dois, reduzindo as liberdades de ambos.
4.  **Padrões de Forma (Shape):** Evitar formas "más" (como o "triângulo vazio") que são ineficientes em criar liberdades.

---

## 2. Nex
**Fonte:** `Tabuleiros.pdf` (Páginas 1-2)

Um jogo de conexão complexo que utiliza peças neutras.

### Lógica do Jogo (Regras)

* [cite_start]**Tabuleiro:** Grelha hexagonal em formato de losango (ver diagrama no PDF)[cite: 51].
* [cite_start]**Peças:** Brancas, Pretas e Cinzentas (Neutras)[cite: 50, 51].
* [cite_start]**Objetivo:** Criar um caminho contínuo de peças da sua cor ligando as duas margens designadas[cite: 52].
    * [cite_start]**Branco:** Liga margens Sudoeste e Nordeste[cite: 53].
    * [cite_start]**Preto:** Liga margens Noroeste e Sudeste[cite: 53].
* [cite_start]**Estado Inicial:** Tabuleiro vazio[cite: 54].
* **Turno:** O jogador escolhe **uma** das seguintes ações:
    1.  [cite_start]**Colocação:** Colocar 1 peça da sua cor E 1 peça neutra em casas vazias[cite: 56].
    2.  [cite_start]**Substituição:** Substituir 2 peças neutras (existentes no tabuleiro) por peças da sua cor E substituir 1 outra peça sua (existente) por 1 peça neutra[cite: 58].
* [cite_start]**Regra da Torta (Swap):** O segundo jogador, apenas no seu primeiro lance, pode optar por trocar de cor (assumir a posição do primeiro jogador) se achar vantajoso[cite: 59].

### Heurísticas para a IA (Estratégia)

Este jogo mistura *pathfinding* com gestão de recursos (peças neutras).

1.  **Análise de Conectividade (Pathfinding):**
    * Usar algoritmos como Dijkstra ou BFS para calcular a distância mínima (número de pedras necessárias) para conectar os lados.
    * O "Custo" deve considerar peças neutras como obstáculos removíveis (via ação de substituição) mas com custo alto, e peças inimigas como obstáculos permanentes.
2.  **Avaliação da Ação 1 (Colocar):**
    * Usar a peça própria para encurtar o caminho.
    * Usar a peça neutra para bloquear o caminho mais curto do adversário (interferência).
3.  **Avaliação da Ação 2 (Substituir - "Power Move"):**
    * Esta jogada altera drasticamente o tabuleiro. A IA deve simular se a conversão de 2 neutras cria uma conexão imparável ("bridge").
    * O custo é perder uma peça própria noutro local; a IA deve escolher sacrificar uma peça que seja taticamente irrelevante.
4.  [cite_start]**Bloqueio Duplo:** Tentar criar situações onde existem dois caminhos para a vitória (ameaça dupla), como visto no exemplo onde as Negras desistem[cite: 64].

---

## 3. Produto
**Fonte:** `Tabuleiro-regras_Produto.pdf`

Um jogo matemático de otimização de território e sabotagem.

### Lógica do Jogo (Regras)

* [cite_start]**Tabuleiro:** Hexagonal com 5 casas de lado[cite: 76].
* [cite_start]**Peças:** 45 Brancas, 45 Pretas[cite: 76].
* **Objetivo:** Maximizar a pontuação $P$.
    * [cite_start]$P = (\text{Tamanho do Maior Grupo}) \times (\text{Tamanho do 2º Maior Grupo})$[cite: 79].
    * [cite_start]Se um jogador tiver menos de 2 grupos, a pontuação é **zero**[cite: 79].
    * [cite_start]**Critério de Desempate:** Se os produtos forem iguais, ganha quem tiver **menos** peças da sua cor no tabuleiro[cite: 80].
* **Turno:**
    * [cite_start]O jogador coloca **duas peças** em casas vazias[cite: 82].
    * [cite_start]**Importante:** As peças podem ser de **qualquer cor** (podem ser ambas da cor do jogador, ambas do adversário, ou uma de cada)[cite: 82, 87].
* [cite_start]**Exceção de Abertura:** No primeiro lance do jogo, as Negras jogam apenas **uma** peça[cite: 83].
* [cite_start]**Fim de Jogo:** Quando o tabuleiro estiver cheio[cite: 79].

### Heurísticas para a IA (Estratégia)

A peculiaridade de poder jogar com as peças do adversário torna a heurística de "Sabotagem" fundamental.

1.  **Função de Maximização (Matemática):**
    * O objetivo é ter dois grupos grandes e equilibrados. Matematicamente, para uma soma fixa de peças $N$, o produto $x \cdot y$ é máximo quando $x \approx y$.
    * *Exemplo:* Ter grupos de tamanho 10 e 10 (Prod=100) é melhor que 18 e 2 (Prod=36).
2.  **Estratégia de Sabotagem (Fundamental):**
    * [cite_start]**Unificação:** A melhor forma de atacar o adversário é **unir** os dois maiores grupos dele usando peças da cor dele[cite: 87]. Isso funde os grupos num só, fazendo o 2º maior grupo ser muito pequeno ou inexistente (Score = 0).
    * A IA deve verificar agressivamente se pode conectar os grupos do oponente.
3.  **Estratégia de Defesa:**
    * Manter os próprios grupos suficientemente distantes para que o adversário não os consiga unir facilmente com uma única jogada (de 2 peças).
4.  **Gestão de Desempate:**
    * [cite_start]No final do jogo, se a vitória parecer garantida ou o empate provável, evitar colocar peças da própria cor desnecessariamente, pois menos peças vence o empate[cite: 80].