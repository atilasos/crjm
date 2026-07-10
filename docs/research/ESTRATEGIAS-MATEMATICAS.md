# Estratégias matemáticas e estado de resolução dos jogos CRJM

Data da pesquisa: 2026-07-10

## Como ler este documento

Há três afirmações diferentes que não devem ser confundidas:

1. **Existe uma estratégia vencedora**: num jogo finito, determinístico, de informação perfeita e sem empate, a indução retrospetiva garante que um dos jogadores vence com jogo perfeito.
2. **Sabe-se quem vence**: foi demonstrada a classe de resultado da posição inicial.
3. **Temos uma estratégia executável**: existe uma prova construtiva, base de finais ou solver capaz de escolher a jogada correta dentro dos recursos do produto.

O ponto 1 não implica os pontos 2 ou 3. Uma prova de existência pode não revelar a primeira jogada e um solver exato pode ser demasiado caro para responder num browser em 100–2000 ms.

## Resultado por jogo

| Jogo no CRJM | Variante implementada | Resultado matemático localizado | Consequência para a IA |
|---|---|---|---|
| Gatos & Cães | Snort numa grelha 8×8, Gatos primeiro numa das quatro casas centrais e primeiro Cão fora desse centro | O Snort retangular padrão está resolvido por uma estratégia de simetria: segundo jogador em dimensões ambas pares; primeiro se alguma dimensão é ímpar. **A prova não se transfere diretamente**, porque as duas restrições de abertura do CRJM quebram a resposta simétrica padrão. Não foi localizada uma solução publicada para esta posição inicial específica. | Não anunciar jogo perfeito. Usar busca/TT e validar táticas; uma futura resolução exata da abertura CRJM seria um artefacto novo do projeto. |
| Dominório | Domineering 8×8, Vertical começa | **Resolvido: vence o primeiro jogador.** Breuker, Uiterwijk e van den Herik resolveram o 8×8 por busca com tabelas de transposição. É uma prova computacional da classe de resultado, não uma regra curta que uma criança possa aplicar em cada turno. | N5 pode ser aferido contra posições/linhas do solver e o livro de aberturas deve favorecer a estratégia vencedora de Vertical. Os níveis baixos devem continuar deliberadamente imperfeitos. |
| Quelhas | 10×10, segmentos ortogonais de comprimento ≥2, misère e troca de orientações uma vez | O jogo é finito e sem empate: cada jogada ocupa pelo menos duas casas, logo a partida termina, e a regra misère atribui a vitória. Assim, uma estratégia vencedora existe para um dos lados após considerar a troca. **Não foi localizada prova publicada que identifique o vencedor ou uma estratégia perfeita**; o jogo apareceu publicamente apenas em 2025. | Manter alpha-beta/heurísticas de blocos e criar um solver exato apenas para finais pequenos. Não apresentar a heurística min/max como prova do jogo completo. |
| Produto | Hexágono de lado 5 (61 casas), primeira jogada com uma peça e restantes com duas; pontuação pelos dois maiores grupos e desempate por menos peças | A variante oficial usada pela aplicação não empata: se os produtos empatam, os totais de peças somam 61 e não podem ser iguais, portanto há sempre um jogador com menos peças. Por indução retrospetiva existe uma estratégia vencedora, mas **não foi localizada solução publicada que diga qual jogador vence com jogo perfeito**. A página atual do autor usa desde 2026 outro desempate (“empate dá vitória ao segundo”), diferente do CRJM implementado. | Não tratar Produto como resolvido. A IA deve avaliar o desempate desde o início e distinguir explicitamente as duas versões das regras em testes/documentação. |
| Atari Go | Ponnuki-Go/Capture Go 9×9, primeira captura vence, sem passe | A literatura de solver localizada resolveu tabuleiros vazios até 5×5; 6×6 foi resolvido apenas sob uma abertura central assumida. **Não há nessa fonte solução para o 9×9 do CRJM.** A variante sem passe tem sempre vencedor, mas isso não oferece uma política ótima barata. | Usar captura/defesa/escadas como conhecimento e solver local de táticas; não afirmar jogo perfeito no 9×9. O benchmark deve medir conversão de atari e legalidade, não “optimalidade”. |
| Nex | 11×11, uma peça própria + neutra ou conversão 2-neutras/1-própria, regra da torta | O autor demonstra/declara que os objetivos de conexão não podem ocorrer simultaneamente e que não há empate; portanto algum jogador tem estratégia vencedora. **Não foi localizada prova que identifique o lado vencedor nem solver do 11×11.** As regras publicadas incluem três convenções raras de fim quando já não é possível a jogada normal. | O motor usa distância de conexão, ameaças, conversões e fallback legal. A lógica implementa as três convenções raras; N5 continua força heurística medida, não jogo perfeito. |

## Fontes primárias e alcance

### Dominório

- D. M. Breuker, J. W. H. M. Uiterwijk e H. J. van den Herik, “Solving 8×8 Domineering”, *Theoretical Computer Science* 230 (2000), 195–206. DOI: <https://doi.org/10.1016/S0304-3975(99)00082-1>.
- O resumo do artigo afirma explicitamente que o 8×8 é vitória do primeiro jogador e descreve o uso de tabelas de transposição.

### Gatos & Cães / Snort

- J. W. H. M. Uiterwijk, “Solving Bicoloring-Graph Games on Rectangular Boards — Part 1: Partisan Col and Snort”, in *Advances in Computer Games*, LNCS (2022). DOI: <https://doi.org/10.1007/978-3-031-11488-5_9>.
- O resultado resolve o Snort retangular padrão por paridade das dimensões. As regras especiais da primeira jogada do CRJM não constam desse teorema; aplicar o resultado diretamente seria uma inferência inválida.
- Para a identificação entre Snort em grelha e Gatos & Cães português: Melanie Gauthier e Svenja Huntemann, “Snort Played on Triangular Grids” (2024), <https://arxiv.org/abs/2412.00849>. Este artigo estuda grelhas triangulares, não resolve a variante CRJM 8×8.

### Atari Go

- E. C. D. van der Werf, J. W. H. M. Uiterwijk e H. J. van den Herik, “Programming a Computer to Play and Solve Ponnuki-Go”, GAME-ON 2002, pp. 173–177. Registo institucional: <https://research.tilburguniversity.edu/en/publications/programming-a-computer-to-play-and-solve-ponnuki-go/>.
- E. C. D. van der Werf, *AI Techniques for the Game of Go*, tese, capítulo 4, <https://erikvanderwerf.tengen.nl/pubdown/thesis_erikvanderwerf.pdf>. A tese documenta soluções até 5×5 e o caso condicionado de 6×6; não 9×9.

### Nex

- João Pedro Neto e Jorge Nuno Silva, *Jogos para dois*, secção “Nex”, pp. 109–112 do PDF: <https://jpneto.github.io/books/livro_jogos_1.pdf>.
- A fonte contém as regras, a afirmação de inexistência de empates, exemplos táticos e as três convenções raras de fim refletidas em `src/games/nex/logic.ts` e respetivos testes.

### Produto

- Página dos autores/regras: <https://jpneto.github.io/world_abstract_games/product.htm>.
- Regras do material usado no campeonato, incluindo desempate por menos peças: <https://www.luduscience.com/produto.html>.
- A divergência de desempate entre a versão CRJM e a revisão do autor em 2026 deve permanecer explícita; a aplicação segue atualmente a regra do CRJM.

### Quelhas

- Não foi encontrada publicação matemática primária sobre uma solução do jogo. As regras públicas localizadas correspondem a um jogo novo de 2025; esta ausência de resultado deve ser tratada como “não localizado”, não como prova de inexistência.

## Implicações de produto

- Só o Dominório 8×8 pode ser descrito hoje como resolvido quanto ao vencedor inicial.
- “Determinístico” não significa “sem empate”; é a regra de cada jogo que elimina o empate. No Produto, essa propriedade depende do desempate e das 61 casas.
- O objetivo realista para N5 é força elevada e medida dentro do orçamento, com solver exato em finais/táticas, não jogo perfeito nos seis jogos.
- As estratégias matemáticas devem alimentar testes, livros de abertura, cartões pedagógicos e explicações. Não devem tornar os níveis baixos invencíveis nem substituir a exploração do aluno.
- A implementação cobre agora as regras raras de Nex, moveu Gatos & Cães para worker e publica latência/ladder. A alegação de “jogo perfeito” continua indevida; faltam amostras estatísticas maiores e observação pedagógica com alunos.
