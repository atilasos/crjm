# Revisão editorial e suporte do nepalês

Pesquisa de 15 de setembro de 2026 para a experiência do aluno. Este documento regista problemas encontrados nos textos portugueses usados como chaves de tradução e no catálogo inglês antes da revisão. As propostas abaixo são recomendações editoriais; este relatório, por si só, não comprova que cada alteração foi aplicada. A implementação das regras foi a fonte primária para verificar o significado dos textos.

## Correções de significado

### Objetivos dos jogos na página inicial

O aviso da página inicial atribui a vitória pela última jogada a todos os jogos exceto Quelhas e Atari Go. Produto termina por pontuação; Nex termina por ligação. O inglês repete a generalização através de "other placement games", expressão que também pode incluir Produto. Fontes: [texto inicial](../../src/App.tsx), [vencedor do Produto](../../src/games/produto/logic.ts), funções `determinarVencedor` e `jogar`, e [vencedor do Nex](../../src/games/nex/logic.ts), funções `verificarVitoria` e `finalizarTurno`.

Proposta para a frase que segue o destaque de Quelhas:

- PT: "Perde quem faz a última jogada! Em Gatos & Cães e Dominório, ganha quem faz a última jogada. No Produto, vence a maior pontuação; no Atari Go, a primeira captura; no Nex, a primeira ligação entre as margens-alvo."
- EN: "The player who makes the last move loses! In Gatos & Cães and Dominório, the last move wins. In Produto, the higher score wins; in Atari Go, the first capture; in Nex, the first connection between the target sides."

O desempate do Produto por menor número de peças está correto para esta implementação. Não o substituir pelo desempate de outra versão do jogo. A condição aparece em `determinarVencedor`. A investigação anterior do projeto distingue expressamente a variante CRJM da versão mais recente do autor: [estratégias matemáticas](ESTRATEGIAS-MATEMATICAS.md).

### Produto: exemplos numéricos e composição dos grupos

`calcularPontuacao` atribui efetivamente zero quando há menos de dois grupos. As frases sobre guardar um segundo grupo e evitar uma fusão que deixe apenas um estão corretas e não precisam de uma correção de regra. Fontes: [cálculo de pontuação](../../src/games/produto/logic.ts) e testes "pontuação é 0 com apenas 1 grupo" e "unir grupos do adversário reduz pontuação a 0" em [testes do Produto](../../src/games/produto/logic.test.ts).

Há, contudo, três problemas em [exercícios de Produto](../../src/ai-core/puzzles.ts):

- `pr-equilibrio-1` afirma que uma jogada transforma grupos de 8 e 2 em grupos de 6 e 4. As peças já colocadas não mudam de lugar nem são retiradas. Reescrever como comparação entre duas posições possíveis. PT: "Compara duas posições possíveis: numa, os teus grupos têm tamanhos 8 e 2; noutra, 6 e 4. Qual produto é maior?" EN: "Compare two possible positions: in one, your groups have sizes 8 and 2; in the other, 6 and 4. Which product is greater?" Rever também a legenda que fala em redistribuição.
- `pr-fusao-1` esquece a peça que liga os grupos. Se uma peça une os grupos de 5 e 4 e não toca no de 3, o resultado é 10×3=30, não 9×3=27. Explicitar essa condição na pergunta e corrigir resposta e explicação. O exercício continua a ensinar que uma fusão pode aumentar a pontuação adversária. Fonte da contagem: `encontrarGrupos` e `calcularPontuacao` em [lógica](../../src/games/produto/logic.ts).
- `pr-dupla-1` compara casas como se uma peça pudesse simultaneamente fazer crescer o grupo próprio e executar uma fusão adversária, e promete que o rival terá de deixar um problema por resolver. Cada peça tem uma única cor e o adversário pode colocar duas. Comparar antes dois planos completos para as duas peças, com efeitos de pontuação explicitamente definidos. A explicação deve limitar-se a comparar esses efeitos; não garantir uma ameaça inevitável. Fonte: `jogar` em [lógica](../../src/games/produto/logic.ts).

### Dominório: capacidade geométrica não é uma sequência forçada

O exercício `do-paridade-1` usa uma região 2×4 para justificar quatro jogadas alternadas. Uma enumeração das jogadas legais na região vazia confirma quatro jogadas nas 12 sequências com Vertical a começar. Com Horizontal a começar há 12 sequências de quatro jogadas e oito de três. Portanto, o exemplo funciona para Vertical a começar, mas precisa dessa condição quando a região é apresentada isoladamente, sem indicar quem lá joga primeiro. Fonte da legalidade e fim: [lógica do Dominório](../../src/games/dominorio/logic.ts).

Reescrever a pergunta como uma hipótese de quatro jogadas já verificadas, ou indicar que Vertical começa nesta região. A legenda deve indicar a condição. Pelo mesmo motivo, suavizar as explicações gerais de `do-corte-1` e `do-corte-2` que apresentam a soma do número de respostas como avaliação suficiente de quaisquer regiões independentes. Comparar as opções de ambos os jogadores é válido; contar só as casas ou somar capacidades de preenchimento não é uma solução geral. Fonte dos textos: [exercícios](../../src/ai-core/puzzles.ts).

### Atari Go e sacrifício

O cartão `atari-go:snapback` recomenda usar um sacrifício para recapturar. Isso ensina uma sequência que não pode acontecer aqui: `jogar` termina a partida assim que há uma captura. O próprio exercício `ag-snapback-1` já explica corretamente este limite. Fontes: [cartões](../../src/ai-core/gamification.ts), [lógica de captura](../../src/games/atari-go/logic.ts) e [exercícios](../../src/ai-core/puzzles.ts).

Manter o identificador do cartão para preservar o progresso guardado e rever o texto visível:

- PT, título: "O limite do sacrifício". Descrição: "Reconhecer que a primeira captura termina a partida, antes de qualquer recaptura."
- EN, título: "Why sacrifices fail here". Description: "Recognise that the first capture ends the game before any recapture."

Não mudar a resposta certa do exercício existente que explica por que o snapback do Go clássico falha em Atari Go.

### Nex: duas casas podem ser bloqueadas no mesmo turno

`executarColocacao` ocupa duas casas vazias distintas: uma com a cor do jogador e outra com uma peça neutra. Ambas interrompem uma cadeia da cor adversária. Logo, a afirmação de que uma única jogada rival só pode cortar uma das duas alternativas é falsa. `executarSubstituicao` é outra ação, que altera três peças já presentes, e não deve ser descrita como uma colocação. Fonte: [ações do Nex](../../src/games/nex/logic.ts).

As seguintes revisões conservam os identificadores dos exercícios e das respostas certas. Fonte dos textos: [exercícios de Nex](../../src/ai-core/puzzles.ts).

| Exercício | Problema | Proposta PT | Proposta EN |
| --- | --- | --- | --- |
| `nx-ponte-1` | Pergunta, pista, explicação e legenda chamam resistente a uma ponte que o rival pode bloquear pelas duas casas. | Pergunta: "Duas casas vazias diferentes permitem ligar estas duas peças tuas. Que opções tens?" Pista: "Cada uma das duas casas completa a ligação, mas o adversário pode ocupar ambas no mesmo turno." Explicação certa: "Certo: tens duas opções de ligação. No Nex, uma peça rival e uma neutra podem bloquear as duas." Legenda: "As duas casas ★ são alternativas de ligação; verifica se o rival pode ocupar ambas." | Prompt: "Two different empty squares can connect these two pieces of yours. What options do you have?" Hint: "Either square completes the connection, but your opponent can occupy both in one turn." Correct explanation: "Correct: you have two ways to connect. In Nex, an opponent piece and a neutral piece can block both." Caption: "The two ★ squares are alternative connections; check whether your opponent can occupy both." |
| `nx-ameaca-1` | A resposta identifica corretamente uma ameaça dupla, mas a pista e a explicação dizem que ela força o rival a escolher apenas um bloqueio. | Pista: "Conta as rotas e lembra-te de que uma colocação rival pode ocupar duas casas." Explicação: "Certo: são duas ameaças de ligação. Ainda não garantem a vitória, porque o rival pode bloquear duas casas no mesmo turno." | Hint: "Count the routes and remember that an opponent placement can occupy two squares." Explanation: "Correct: these are two connection threats. They do not yet guarantee a win, because your opponent can block two squares in one turn." |
| `nx-defesa-1` | A resposta recomendada omite a defesa direta com peça própria e neutra. | Resposta certa: "Não: pode ser preciso ocupar as duas alternativas no mesmo turno." Explicação: "Certo: bloquear só uma casa deixa a outra livre. Se ambas estiverem vazias, podes colocar a tua peça numa e a neutra na outra." A resposta errada sobre duas neutras deve explicar: "Numa colocação usas uma peça própria e uma neutra, não duas neutras." | Correct answer: "No: you may need to occupy both alternatives in one turn." Explanation: "Correct: blocking only one square leaves the other free. If both are empty, you can put your own piece on one and the neutral piece on the other." Explain the wrong two-neutral answer: "A placement uses one of your own pieces and one neutral piece, not two neutral pieces." |
| `nx-tripla-1` | "Cada jogada" ignora a substituição e "três ameaças garantem" falta de condições. | Pergunta: "Numa colocação, o rival ocupa duas casas vazias. Se tiveres três casas diferentes que completam a tua ligação numa jogada, o que deves verificar?" Resposta: "Pode bloquear duas, mas tenho de confirmar que não vence primeiro." Explicação: "Uma colocação não ocupa as três casas. Para contar com essa vantagem, cada casa tem de completar uma ligação e o rival não pode vencer já, incluindo por substituição." | Prompt: "In a placement, your opponent occupies two empty squares. If you have three different squares that each complete your connection in one move, what must you check?" Answer: "They can block two, but I must check that they cannot win first." Explanation: "One placement cannot occupy all three squares. To rely on this advantage, each square must complete a connection and your opponent must have no immediate win, including by replacement." |

As frases das trilhas e cartões sobre pontes ou ameaças devem usar o mesmo significado. "Construir pontes e ameaças duplas" pode continuar como objetivo de aprendizagem, desde que não prometa vitória automática. "Uma jogada rival só cobre duas casas" deve dizer "uma colocação rival ocupa duas casas vazias". Fontes: [trilhas](../../src/ai-core/training-paths.ts) e [cartões](../../src/ai-core/gamification.ts).

## Clareza e consistência editorial

Estas são decisões editoriais para alunos, não novas regras dos jogos. Os exemplos constavam do [catálogo inglês e chaves portuguesas](../../src/i18n/en.json).

| Texto encontrado | PT recomendado | EN recomendado |
| --- | --- | --- |
| `Match inválido.` | `Confronto inválido.` | `Invalid match.` |
| `A aguardar o teu match` | `À espera do teu confronto` | `Waiting for your match` |
| `score resetado para 0-0` | `resultado reposto em 0-0` | `score reset to 0-0` |
| `Sua (Sacrifício)` | `Tua (a converter)` | `Your piece (to turn neutral)` |
| `↺ Reset` | `↺ Recomeçar` | `↺ Restart` |
| `🔄 Swap` | `🔄 Trocar` | `🔄 Swap` |
| `streak {0} dia(s)` | `Dias seguidos: {0}` | `Days in a row: {0}` |
| `Fallback estratégico local` | `Análise alternativa neste dispositivo` | `Alternative analysis on this device` |
| `A análise desta dica usou o fallback atual do Nex.` | `Esta pista foi calculada com a análise alternativa do Nex.` | `This hint used Nex's alternative analysis.` |

Preferir "tu", "tua", "liga-te", "ligação", "guardar", "ecrã" e "ficheiro" no PT-PT. Manter uma distinção constante entre jogo, partida e confronto de melhor de três. Evitar sufixos traduzidos em separado, como `peça{2}` e `dia(s)`: a frase completa ou uma mensagem contada precisa de pertencer ao catálogo. Preservar nomes dos alunos, códigos, coordenadas e identificadores de estratégia.

Em inglês, usar frases curtas e o mesmo termo para o mesmo conceito. Na explicação de regras, "move" é mais direto que "reply" quando apenas significa uma jogada disponível. Nomes escolares portugueses podem ser acompanhados de "Years 1–4", etc., porque o público frequenta uma escola portuguesa. Estes critérios são propostas de redação, não uma certificação de revisão por falantes nativos.

## Nepalês: escrita, fonte e termos

Nepalês usa devanágari da esquerda para a direita, com composição de glifos para sílabas e marcas. Não basta uma fonte latina com traduções em Unicode. A descrição oficial da fonte identifica explicitamente o suporte a nepalês e a necessidade de composição tipográfica. Fontes: [Noto Sans Devanagari](https://github.com/notofonts/noto-docs/blob/main/docs/specimen/NotoSansDevanagari.md) e [Unicode, capítulo 12](https://unicode.org/versions/Unicode16.0.0/core-spec/chapter-12/).

Recomenda-se alojar localmente Noto Sans Devanagari 2.007, com a licença no repositório. Esta versão inclui correções de grupos consonantais nepaleses. O projeto distribui-a sob SIL Open Font License 1.1. Fontes: [lançamento 2.007](https://github.com/notofonts/devanagari/releases/tag/NotoSansDevanagari-v2.007), [arquivo de fontes](https://github.com/notofonts/devanagari/releases/download/NotoSansDevanagari-v2.007/NotoSansDevanagari-v2.007.zip) e [licença](https://github.com/notofonts/devanagari/blob/main/OFL.txt).

Usar `lang="ne"`, espaçamento normal entre letras e alturas que não cortem sinais acima ou abaixo da linha. Testar texto corrido, títulos, seletor e botões em ecrã estreito. Uma altura de linha inicial de cerca de 1,6 é uma escolha de desenho a validar visualmente, não uma medida obrigatória do W3C. O W3C organiza requisitos de composição, segmentação, espaçamento e altura de linha; a documentação OpenType explica as formas e marcas que a fonte precisa de posicionar. Fontes: [W3C Devanagari Layout Requirements](https://www.w3.org/TR/2024/DNOTE-deva-lreq-20240709/) e [Microsoft, composição devanágari](https://learn.microsoft.com/en-us/typography/script-development/devanagari).

O CLDR dá ao nepalês o sistema de numeração `deva` por padrão. A especificação LDML admite explicitamente algarismos latinos 0–9, selecionáveis por `nu-latn`, mesmo quando os nativos são o padrão. Para esta escola em Portugal, manter números de casas e códigos estáveis entre línguas é uma escolha justificável. A escolha deve ser explícita, por exemplo `ne-u-nu-latn` na formatação numérica, sem confundir a língua `ne` com uma mudança de calendário. Fontes: [dados CLDR do nepalês](https://www.unicode.org/cldr/charts/46.1/summary/ne.html) e [LDML, números](https://www.unicode.org/reports/tr35/tr35-numbers.html).

O Curriculum Development Centre do Nepal usa `गणित` para matemática, `अभ्यास` para prática/exercício e `कक्षा` para classe/ano. A biblioteca oficial contém títulos escolares com esses termos e com `खेल` para jogo. Isso sustenta vocabulário educativo básico, sem fornecer uma tradução especializada oficial destes seis jogos. Fonte: [biblioteca do CDC](https://lib.moecdc.gov.np/elibrary/pages/search.php?search=pdf&offset=972&order_by=field8&sort=ASC&per_page=240&archive=0&display=list).

Proposta de glossário para manter as traduções consistentes:

| Conceito | Nepalês proposto |
| --- | --- |
| Idioma | भाषा |
| Nepalês | नेपाली |
| Jogo | खेल |
| Jogador | खेलाडी |
| Prática | अभ्यास |
| Regras | नियम |
| Pista | सङ्केत |
| Jogada | चाल |
| Peça de jogo | गोटी |
| Casa do tabuleiro | कोठा |
| Grupo de peças | गोटीहरूको समूह |
| Peça neutra | तटस्थ गोटी |
| Adversário | प्रतिद्वन्द्वी |
| Pontuação | अङ्क |

Os termos específicos do glossário são propostas de tradução, não citações nem aprovação oficial. Evitar transportar palavras de Hindi apenas por partilharem a escrita. Preservar os nomes portugueses dos jogos e acrescentar explicações nepalesas. A revisão automática pode verificar completude, marcadores, coerência e muitos erros de significado; não equivale a uma revisão humana nativa de naturalidade e adequação à idade.

## Aplicação da revisão

As correções de significado acima foram integradas nos valores dos três catálogos, conservando as chaves canónicas. A revisão final também qualificou o duplo atari (é preciso excluir uma defesa comum ou uma captura rival que vença primeiro), deu prioridade à captura vencedora nas pistas defensivas e distinguiu a avaliação do motor de uma garantia de vitória. As durações usam pluralização de `Intl`; a construção de frases por sufixos foi removida dos controlos do Produto. Ver [guia de internacionalização](../internacionalizacao.md) para o processo de manutenção e os limites desta revisão assistida por IA.
