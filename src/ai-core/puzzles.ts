import type { GameId } from './types';

export interface PuzzleOption {
  id: string;
  label: string;
  explanation: string;
}

/**
 * Diagrama esquemático da posição descrita no enunciado.
 * Caracteres por casa: '.' vazia · 'X' peça tua · 'O' peça adversária ·
 * 'N' neutra · '*' casa em destaque · '#' fora do excerto ·
 * '1'/'2'/'3' casas candidatas de um puzzle «encontra a jogada».
 */
export interface PuzzleDiagram {
  rows: string[];
  caption: string;
  /** Desloca as linhas ímpares meia casa (tabuleiros hexagonais, ex.: Nex). */
  hexOffset?: boolean;
}

export interface PuzzleDefinition {
  id: string;
  gameId: GameId;
  patternId: string;
  title: string;
  prompt: string;
  hint: string;
  options: PuzzleOption[];
  correctOptionId: string;
  diagram?: PuzzleDiagram;
}

export const PUZZLES: PuzzleDefinition[] = [
  {
    id: 'gc-centro-1', gameId: 'gatos-caes', patternId: 'gatos-caes:centro', title: 'O primeiro Gato',
    prompt: 'O tabuleiro está vazio. Onde deve o primeiro Gato começar para respeitar a regra e conservar mais opções?',
    hint: 'A primeira peça não pode começar junto à borda.', correctOptionId: 'centro',
    options: [
      { id: 'canto', label: 'Num canto', explanation: 'O canto não pertence às quatro casas centrais permitidas na primeira jogada.' },
      { id: 'centro', label: 'Numa das quatro casas centrais', explanation: 'Certo: a abertura central respeita a regra especial e mantém várias direções disponíveis.' },
      { id: 'borda', label: 'No meio de uma borda', explanation: 'A borda também fica fora das quatro casas centrais exigidas para o primeiro Gato.' },
    ],
    diagram: {
      rows: ['......', '......', '..**..', '..**..', '......', '......'],
      caption: 'Excerto do tabuleiro vazio: o primeiro Gato tem de começar numa das quatro casas centrais (★).',
    },
  },
  {
    id: 'gc-mobilidade-1', gameId: 'gatos-caes', patternId: 'gatos-caes:casa-em-disputa', title: 'Casa em disputa',
    prompt: 'Duas casas são legais agora. Uma deixará quatro respostas futuras e a outra apenas uma. Qual é a comparação mais útil?',
    hint: 'Neste jogo, continuar a poder jogar é um recurso.', correctOptionId: 'quatro',
    options: [
      { id: 'uma', label: 'Escolher a que deixa uma resposta', explanation: 'Reduzir as tuas próprias respostas pode entregar rapidamente o controlo do tabuleiro.' },
      { id: 'quatro', label: 'Preferir a que deixa quatro respostas', explanation: 'Certo: preservar mobilidade dá mais escolhas futuras e dificulta o bloqueio adversário.' },
      { id: 'igual', label: 'As duas são sempre equivalentes', explanation: 'Casas legais podem ter valores muito diferentes conforme as respostas que preservam.' },
    ],
  },
  {
    id: 'gc-bloqueio-1', gameId: 'gatos-caes', patternId: 'gatos-caes:jogada-garantida', title: 'Reserva segura',
    prompt: 'Descobriste uma casa que só a tua espécie poderá ocupar mais tarde. O que representa essa casa?',
    hint: 'Pensa nela como uma jogada guardada para o fim.', correctOptionId: 'reserva',
    options: [
      { id: 'perigo', label: 'Uma casa inútil', explanation: 'Uma casa exclusiva é útil porque o adversário não a consegue transformar numa resposta própria.' },
      { id: 'reserva', label: 'Uma reserva de mobilidade', explanation: 'Certo: uma jogada garantida pode funcionar como reserva quando as casas partilhadas desaparecerem.' },
      { id: 'captura', label: 'Uma captura imediata', explanation: 'Gatos & Cães não tem capturas; o valor está na mobilidade que a casa reserva.' },
    ],
  },
  {
    id: 'gc-tempo-1', gameId: 'gatos-caes', patternId: 'gatos-caes:casa-em-disputa', title: 'Ordem das casas',
    prompt: 'Tens casas em disputa (ambos podem lá jogar) e casas exclusivas tuas. Qual deves ocupar primeiro?',
    hint: 'As exclusivas ninguém tas tira.', correctOptionId: 'disputa',
    options: [
      { id: 'exclusivas', label: 'As exclusivas, para garantir', explanation: 'As casas exclusivas já estão garantidas; gastá-las cedo desperdiça as tuas reservas de fim de jogo.' },
      { id: 'disputa', label: 'As casas em disputa', explanation: 'Certo: as casas em disputa desaparecem se o adversário lá jogar; as exclusivas ficam guardadas para o fim.' },
      { id: 'tanto-faz', label: 'A ordem é indiferente', explanation: 'A ordem decide quem fica sem jogadas primeiro; disputadas primeiro, exclusivas depois.' },
    ],
  },
  {
    id: 'gc-parede-1', gameId: 'gatos-caes', patternId: 'gatos-caes:centro', title: 'Parede que divide',
    prompt: 'Uma linha de Gatos atravessa o centro e separa as zonas onde os Cães podem jogar. Que efeito estratégico tem?',
    hint: 'Pensa no que acontece às respostas futuras dos Cães.', correctOptionId: 'divide',
    options: [
      { id: 'nada', label: 'Nenhum, o jogo é casa a casa', explanation: 'A estrutura global importa: zonas separadas limitam onde cada espécie ainda cabe.' },
      { id: 'divide', label: 'Reduz e divide as respostas dos Cães', explanation: 'Certo: uma parede central corta a mobilidade adversária em zonas pequenas, mais fáceis de esgotar.' },
      { id: 'perde', label: 'Prejudica os Gatos por gastar peças', explanation: 'As peças da parede também bloqueiam casas aos Cães; não são jogadas perdidas se dividirem o espaço.' },
    ],
    diagram: {
      rows: ['O..O..', '......', 'XXXXXX', '......', '..O..O'],
      caption: 'Uma parede de Gatos (pretas) atravessa o centro e separa as zonas onde os Cães ainda podem jogar.',
    },
  },
  {
    id: 'gc-contagem-1', gameId: 'gatos-caes', patternId: 'gatos-caes:jogada-garantida', title: 'Contar o final',
    prompt: 'Já não há casas em disputa. Tens 2 casas exclusivas, o adversário tem 1, e é ele a jogar. Quem vence?',
    hint: 'Simula os turnos: ele, tu, ele…', correctOptionId: 'tu',
    options: [
      { id: 'ele', label: 'Ele, porque joga primeiro', explanation: 'Simula: ele gasta a única exclusiva, tu jogas uma das tuas, e ele fica sem casa — perde.' },
      { id: 'tu', label: 'Tu, porque ele esgota primeiro', explanation: 'Certo: ele joga a última dele, tu ainda tens resposta, e no turno seguinte ele não tem jogada.' },
      { id: 'empate', label: 'Ninguém, o jogo empata', explanation: 'Gatos & Cães não empata: perde quem primeiro ficar sem jogada legal no seu turno.' },
    ],
    diagram: {
      rows: ['XX*...', 'X*....', '......', '....OO', '....O*'],
      caption: 'À esquerda, duas casas (★) onde só os teus Gatos podem jogar; à direita, uma casa (★) exclusiva dos Cães.',
    },
  },
  {
    id: 'gc-final-1', gameId: 'gatos-caes', patternId: 'gatos-caes:jogada-garantida', title: 'Final resolvido: a casa exata',
    prompt: 'Posição real, resolvida por análise completa: jogam os Gatos (X) e há cinco casas legais, mas só uma vence. Qual?',
    hint: 'Conta as reservas que cada casa te deixa — e as que deixa ao adversário.', correctOptionId: 'casa2',
    options: [
      { id: 'casa1', label: 'Casa 1', explanation: 'Demonstrado que perde: depois desta casa, o adversário consegue sempre esgotar-te as respostas primeiro.' },
      { id: 'casa2', label: 'Casa 2', explanation: 'Certo — e provado: a análise de todas as continuações mostra que só esta casa garante que é o adversário a ficar sem jogada.' },
      { id: 'casa3', label: 'Casa 3', explanation: 'Demonstrado que perde: parece guardar mobilidade, mas o adversário responde e fica com a última casa útil.' },
    ],
    diagram: {
      rows: ['OO.X1.OO', '..XX.X.O', '.O..O.2.', 'X.XX.O.O', 'X3.XX.X.', '.XX..O.X', 'O..O.O.X', '.OO.O.X.'],
      caption: 'Jogam os Gatos (X). Final real resolvido por busca completa (94 posições analisadas): das cinco casas legais, apenas uma vence.',
    },
  },
  {
    id: 'do-paridade-1', gameId: 'dominorio', patternId: 'dominorio:paridade', title: 'Contar antes de cortar',
    prompt: 'Uma região isolada admite exatamente quatro dominós alternados. Quem jogar primeiro nessa região fará também a última jogada?',
    hint: 'Conta as jogadas: 1, 2, 3, 4.', correctOptionId: 'nao',
    options: [
      { id: 'sim', label: 'Sim, porque começou', explanation: 'Com quatro jogadas, o primeiro joga a 1.ª e a 3.ª; não joga a última.' },
      { id: 'nao', label: 'Não, o segundo fará a quarta', explanation: 'Certo: numa sequência par, quem responde joga a última peça dessa região.' },
      { id: 'depende', label: 'É impossível contar', explanation: 'Quando a região já tem uma sequência forçada, a paridade permite contar exatamente.' },
    ],
    diagram: {
      rows: ['****', '****'],
      caption: 'Uma região isolada de 2×4: cabem exatamente quatro dominós — a paridade é par.',
    },
  },
  {
    id: 'do-corte-1', gameId: 'dominorio', patternId: 'dominorio:corte', title: 'Duas regiões, dois problemas',
    prompt: 'Uma jogada divide o espaço livre em duas zonas que já não se tocam. Qual passa a ser a melhor forma de analisar?',
    hint: 'Uma peça numa zona já não altera a outra.', correctOptionId: 'separar',
    options: [
      { id: 'separar', label: 'Contar cada zona separadamente', explanation: 'Certo: componentes independentes podem ser avaliados e depois combinados pelo número de respostas.' },
      { id: 'ignorar', label: 'Ignorar a zona menor', explanation: 'Mesmo uma zona pequena pode decidir quem conserva a última jogada disponível.' },
      { id: 'centro', label: 'Olhar apenas para o centro original', explanation: 'Depois do corte, a conectividade das novas zonas é mais importante que o centro antigo.' },
    ],
  },
  {
    id: 'do-corredor-1', gameId: 'dominorio', patternId: 'dominorio:corredor', title: 'Corredor forçado',
    prompt: 'Num corredor estreito só cabem três dominós na tua orientação e nenhum na orientação rival. O que tens aí?',
    hint: 'Só um jogador consegue usar esse espaço.', correctOptionId: 'reserva',
    options: [
      { id: 'reserva', label: 'Uma reserva exclusiva de três jogadas', explanation: 'Certo: o corredor guarda respostas que o adversário não consegue consumir.' },
      { id: 'empate', label: 'Um empate automático', explanation: 'Dominório não termina empatado; as reservas alteram quem fica sem jogada primeiro.' },
      { id: 'ameaça', label: 'Três jogadas do adversário', explanation: 'Se a orientação rival não cabe, esse corredor não lhe oferece jogadas.' },
    ],
    diagram: {
      rows: ['#*#', '#*#', '#*#', '#*#', '#*#', '#*#'],
      caption: 'Um corredor de largura 1: cabem três dominós verticais e nenhum horizontal.',
    },
  },
  {
    id: 'do-espelho-1', gameId: 'dominorio', patternId: 'dominorio:espelhamento', title: 'Espelho no Dominório',
    prompt: 'O tabuleiro está simétrico e decides copiar cada jogada adversária na posição espelhada. Quando falha esta estratégia?',
    hint: 'Olha para o que acontece nas casas centrais.', correctOptionId: 'centro',
    options: [
      { id: 'nunca', label: 'Nunca, o espelho é imbatível', explanation: 'O espelho quebra quando uma jogada e a sua imagem partilham casas — aí a cópia deixa de ser legal.' },
      { id: 'centro', label: 'Quando a jogada toca o eixo central', explanation: 'Certo: no eixo, o dominó e o seu reflexo sobrepõem-se; a cópia fica ilegal e a paridade quebra-se.' },
      { id: 'cores', label: 'Quando as orientações trocam', explanation: 'O espelho já conta com orientações diferentes; o problema real são as casas partilhadas no eixo.' },
    ],
    diagram: {
      rows: ['..*..', '..*..', '..*..', '..*..'],
      caption: 'O eixo central do tabuleiro: um dominó que toque estas casas sobrepõe-se ao próprio reflexo.',
    },
  },
  {
    id: 'do-paridade-2', gameId: 'dominorio', patternId: 'dominorio:paridade', title: 'Reservas contadas',
    prompt: 'Já só existem regiões exclusivas: tu cabes em 3 jogadas, o rival em 2, e é a tua vez. Qual é o desfecho com jogo correto?',
    hint: 'Alterna os turnos e vê quem fica sem jogada.', correctOptionId: 'vences',
    options: [
      { id: 'vences', label: 'Vences: ele esgota primeiro', explanation: 'Certo: tu 3→2, ele 2→1, tu 2→1, ele 1→0, tu ainda jogas — e ele fica sem resposta.' },
      { id: 'perdes', label: 'Perdes: gastas mais jogadas', explanation: 'Ter mais reservas exclusivas é vantagem: quem tem menos fica sem jogada primeiro.' },
      { id: 'depende', label: 'Depende do tamanho das regiões', explanation: 'Com regiões exclusivas já contadas em jogadas, só a contagem e a vez importam.' },
    ],
  },
  {
    id: 'do-corte-2', gameId: 'dominorio', patternId: 'dominorio:corte', title: 'Cortar ou esperar',
    prompt: 'Podes fechar já uma fronteira que divide o espaço em duas zonas. Que conta deves fazer antes de cortar?',
    hint: 'O corte fixa o valor de cada zona.', correctOptionId: 'depois',
    options: [
      { id: 'sempre', label: 'Cortar é sempre bom', explanation: 'Um corte pode fixar zonas favoráveis ao adversário; sem contar primeiro, é um risco.' },
      { id: 'depois', label: 'Comparar as respostas de cada lado após o corte', explanation: 'Certo: só vale cortar se, somadas as zonas, ficares tu com a última jogada disponível.' },
      { id: 'tamanho', label: 'Escolher sempre a zona maior', explanation: 'O que importa não é a área: é quantas jogadas de cada orientação cabem em cada zona.' },
    ],
  },
  {
    id: 'do-final-1', gameId: 'dominorio', patternId: 'dominorio:paridade', title: 'Final resolvido: um dominó certo',
    prompt: 'Posição real, resolvida por análise completa: jogas na horizontal (X) e tens quatro dominós possíveis, mas só um vence. Qual escolhes?',
    hint: 'Cada colocação muda a paridade das zonas que restam.', correctOptionId: 'casa2',
    options: [
      { id: 'casa1', label: 'Dominó a partir da Casa 1 (para a direita)', explanation: 'Demonstrado que perde: gasta uma zona onde ainda cabias duas vezes e entrega a última colocação ao adversário.' },
      { id: 'casa2', label: 'Dominó a partir da Casa 2 (para a direita)', explanation: 'Certo — e provado: analisadas todas as continuações, só este dominó garante que és tu a fazer a última colocação.' },
      { id: 'casa3', label: 'Dominó a partir da Casa 3 (para a direita)', explanation: 'Demonstrado que perde: fecha o teu próprio canto e a contagem final fica favorável ao adversário.' },
    ],
    diagram: {
      rows: ['OOOOO1..', 'OOOOOOXX', '.OXX.OXX', '.OXXOXXO', 'XXOOO.OO', '.OOO2.O.', '.OXXXXXX', 'XXXXXX3.'],
      caption: 'Jogas na horizontal (X); as casas numeradas são o início de cada dominó candidato. Final real resolvido por busca completa (23 posições).',
    },
  },
  {
    id: 'qu-misere-1', gameId: 'quelhas', patternId: 'quelhas:misere-final', title: 'Pensar ao contrário',
    prompt: 'Resta uma única jogada legal no teu turno. Segundo a regra misère de Quelhas, o que acontece se a fizeres?',
    hint: 'Em Quelhas, fazer a última jogada não é o objetivo.', correctOptionId: 'perdes',
    options: [
      { id: 'ganhas', label: 'Ganhas por jogar por último', explanation: 'Essa é a regra normal de muitos jogos, mas Quelhas usa a condição misère inversa.' },
      { id: 'perdes', label: 'Perdes por fazer a última jogada', explanation: 'Certo: em Quelhas, quem é obrigado a colocar o último segmento perde.' },
      { id: 'empata', label: 'A partida empata', explanation: 'A regra misère determina um vencedor; não existe empate por acabar o espaço.' },
    ],
  },
  {
    id: 'qu-simetria-1', gameId: 'quelhas', patternId: 'quelhas:simetria', title: 'Espelho com cuidado',
    prompt: 'Antes de espelhar uma jogada do adversário, que pergunta tens de responder primeiro?',
    hint: 'A simetria só ajuda se a resposta continuar legal e não te entregar o fim.', correctOptionId: 'ultima',
    options: [
      { id: 'cor', label: 'A cor do tabuleiro muda?', explanation: 'Quelhas não atribui valor estratégico a cores; importam orientação, espaço e ordem das jogadas.' },
      { id: 'ultima', label: 'A resposta é legal e evita que eu fique com a última?', explanation: 'Certo: o espelho é uma ferramenta, mas deve respeitar orientação e paridade misère.' },
      { id: 'maior', label: 'O meu segmento é sempre maior?', explanation: 'Copiar com um segmento maior pode destruir a paridade que a simetria pretendia conservar.' },
    ],
  },
  {
    id: 'qu-fratura-1', gameId: 'quelhas', patternId: 'quelhas:fratura', title: 'Fraturar o tabuleiro',
    prompt: 'Uma jogada separa o tabuleiro em componentes independentes. O que deves estimar em cada componente?',
    hint: 'Compara o mínimo e o máximo de segmentos que cada orientação ainda consegue jogar.', correctOptionId: 'intervalos',
    options: [
      { id: 'area', label: 'Apenas o número de casas', explanation: 'A mesma área pode permitir quantidades muito diferentes de segmentos conforme a forma.' },
      { id: 'intervalos', label: 'As reservas mínima e máxima de jogadas', explanation: 'Certo: esses intervalos mostram quem pode controlar a duração e a paridade do fim.' },
      { id: 'primeira', label: 'A primeira jogada da partida', explanation: 'Num fim fraturado, a estrutura atual das componentes é a informação decisiva.' },
    ],
  },
  {
    id: 'qu-isolamento-1', gameId: 'quelhas', patternId: 'quelhas:isolamento-forcado', title: 'A bolsa de uma jogada',
    prompt: 'Consegues criar uma bolsa isolada onde cabe exatamente um segmento. Qual é o melhor uso dessa bolsa?',
    hint: 'Quem for obrigado a jogar por último perde.', correctOptionId: 'guardar',
    options: [
      { id: 'usar', label: 'Ocupá-la já, antes que desapareça', explanation: 'Gastá-la cedo devolve a iniciativa; a bolsa vale mais como ferramenta de paridade no final.' },
      { id: 'guardar', label: 'Guardá-la para ajustar a paridade do fim', explanation: 'Certo: a bolsa permite alterar quem faz a última jogada — usá-la no momento certo decide o misère.' },
      { id: 'ignorar', label: 'Ignorá-la, uma jogada não conta', explanation: 'Em finais misère apertados, uma única jogada extra muda quem é empurrado para a última.' },
    ],
  },
  {
    id: 'qu-paridade-1', gameId: 'quelhas', patternId: 'quelhas:misere-final', title: 'Par ou ímpar no fim',
    prompt: 'Contas que restam exatamente 4 jogadas forçadas e é a tua vez. Como corre o final com jogo correto?',
    hint: 'Distribui as 4 jogadas pelos turnos.', correctOptionId: 'rival',
    options: [
      { id: 'tu-perdes', label: 'Perdes: começas a sequência', explanation: 'Começar não obriga a acabar: com 4 jogadas, tu fazes a 1.ª e a 3.ª; a última é dele.' },
      { id: 'rival', label: 'O rival faz a 4.ª jogada e perde', explanation: 'Certo: num total par de jogadas restantes, quem responde faz a última — e em misère isso é derrota.' },
      { id: 'sorte', label: 'É imprevisível', explanation: 'Uma sequência forçada conta-se: paridade par com a vez a teu favor é vitória garantida.' },
    ],
  },
  {
    id: 'qu-tempo-1', gameId: 'quelhas', patternId: 'quelhas:simetria', title: 'Quebrar o espelho',
    prompt: 'O adversário copia todas as tuas jogadas em espelho. Que tipo de jogada desmonta a estratégia dele?',
    hint: 'Procura uma jogada que coincida com a própria imagem.', correctOptionId: 'eixo',
    options: [
      { id: 'grande', label: 'Um segmento o mais comprido possível', explanation: 'O comprimento não impede a cópia; o que a impede é o reflexo deixar de estar disponível.' },
      { id: 'eixo', label: 'Uma jogada sobre o eixo de simetria', explanation: 'Certo: uma jogada auto-simétrica não pode ser copiada — o espelho quebra e a paridade muda de mãos.' },
      { id: 'esperar', label: 'Não há defesa contra o espelho', explanation: 'O espelho tem pontos fracos: o eixo central e os momentos em que a cópia fica ilegal.' },
    ],
  },
  {
    id: 'qu-final-1', gameId: 'quelhas', patternId: 'quelhas:misere-final', title: 'Final resolvido: fugir da última',
    prompt: 'Posição real, resolvida por análise completa: jogas segmentos horizontais de 2 casas e há seis jogadas legais — só uma vence. Onde começas?',
    hint: 'Em Quelhas perde quem for obrigado a fazer a última jogada: conta a paridade de cada zona.', correctOptionId: 'casa3',
    options: [
      { id: 'casa1', label: 'Segmento a partir da Casa 1', explanation: 'Demonstrado que perde: a paridade das zonas restantes obriga-te a ti à última colocação.' },
      { id: 'casa2', label: 'Segmento a partir da Casa 2', explanation: 'Demonstrado que perde: fecha a zona errada e devolve o controlo do final ao adversário.' },
      { id: 'casa3', label: 'Segmento a partir da Casa 3', explanation: 'Certo — e provado: com jogo perfeito dos dois lados, só este segmento empurra o adversário para a última jogada.' },
    ],
    diagram: {
      rows: ['N1.NNNN3.N', 'N..NNNNN.N', 'NNNNN2.N.N', 'NNNNNNNNNN', 'N.NNNNNNNN', 'N.NNNNN.NN', 'NNNNN.N..N', 'NNNNNNNNNN', '..NNNNNNNN', '.NNN.NNN.N'],
      caption: 'As casas cinzentas estão ocupadas; cada número marca o início de um segmento horizontal de 2. Final real resolvido por busca completa (247 posições).',
    },
  },
  {
    id: 'pr-equilibrio-1', gameId: 'produto', patternId: 'produto:equilibrio', title: 'Dois fatores fortes',
    prompt: 'Os teus dois maiores grupos têm tamanhos 8 e 2. Outra jogada pode deixá-los com 6 e 4. Qual produto é maior?',
    hint: 'Calcula 8×2 e 6×4.', correctOptionId: 'equilibrado',
    options: [
      { id: 'oito', label: '8×2, porque tem o maior grupo', explanation: '8×2 vale 16; um grupo enorme não compensa sempre um segundo grupo fraco.' },
      { id: 'equilibrado', label: '6×4, porque vale 24', explanation: 'Certo: equilibrar os dois fatores aumenta o produto de 16 para 24.' },
      { id: 'igual', label: 'São iguais porque usam 10 peças', explanation: 'Com a mesma soma, distribuições mais equilibradas podem produzir valores maiores.' },
    ],
    diagram: {
      rows: ['XXXX....', 'XXXX..XX'],
      caption: 'Esquema: grupos de 8 e 2 dão produto 16; redistribuídos em 6 e 4 dariam 24.',
    },
  },
  {
    id: 'pr-fusao-1', gameId: 'produto', patternId: 'produto:fusao-adversaria', title: 'Sabotagem por fusão',
    prompt: 'O adversário tem grupos de 5, 4 e 3. Podes ligar os grupos de 5 e 4. Que comparação tens de fazer?',
    hint: 'Depois da fusão, quais serão os dois maiores grupos?', correctOptionId: 'segundo',
    options: [
      { id: 'pontos', label: 'Contar apenas as peças oferecidas', explanation: 'Dar peças não é por si só vantajoso; o efeito importante é sobre os dois fatores do produto.' },
      { id: 'segundo', label: 'Comparar 5×4 com 9×3', explanation: 'Certo: a fusão muda o produto de 20 para 27; só é sabotagem se as outras opções forem ainda melhores para o rival.' },
      { id: 'zero', label: 'Assumir que o produto fica zero', explanation: 'O adversário ainda conserva pelo menos dois grupos, portanto o produto não fica automaticamente zero.' },
    ],
  },
  {
    id: 'pr-grupo-1', gameId: 'produto', patternId: 'produto:grupo-isolado', title: 'Guardar o segundo grupo',
    prompt: 'Tens um grupo grande e um grupo médio isolado. Qual é o risco de ligar imediatamente os dois?',
    hint: 'A pontuação precisa de dois grupos distintos.', correctOptionId: 'fator',
    options: [
      { id: 'fator', label: 'Perder o segundo fator do produto', explanation: 'Certo: fundir os dois grupos pode deixar apenas um grupo útil e fazer o produto cair para zero.' },
      { id: 'captura', label: 'As peças serão capturadas', explanation: 'Produto não tem capturas; a ameaça é perder a estrutura de dois grupos.' },
      { id: 'cor', label: 'As peças mudam de cor', explanation: 'Uma ligação não altera cores; altera a composição e o tamanho dos grupos.' },
    ],
  },
  {
    id: 'pr-dupla-1', gameId: 'produto', patternId: 'produto:fusao-adversaria', title: 'Uma jogada, dois efeitos',
    prompt: 'Entre duas casas, uma só faz crescer o teu grupo; a outra cresce o teu grupo E ameaça fundir dois grupos rivais. Qual preferes?',
    hint: 'Conta os efeitos de cada peça colocada.', correctOptionId: 'dupla',
    options: [
      { id: 'simples', label: 'A que só faz crescer', explanation: 'Crescer é bom, mas uma jogada com dois efeitos pressiona o adversário ao mesmo tempo.' },
      { id: 'dupla', label: 'A que cresce e ameaça o rival', explanation: 'Certo: jogadas com efeito duplo obrigam o adversário a escolher que problema resolve — e um fica por resolver.' },
      { id: 'nenhuma', label: 'Guardar as peças para depois', explanation: 'No Produto não se guardam peças: cada turno coloca duas, e o valor está em maximizar os efeitos.' },
    ],
  },
  {
    id: 'pr-fim-1', gameId: 'produto', patternId: 'produto:equilibrio', title: 'Última peça, maior produto',
    prompt: 'Fim de jogo: tens grupos de 8 e 4, e uma peça pode ir para qualquer um. 9×4 ou 8×5 — qual escolhes?',
    hint: 'Calcula os dois produtos.', correctOptionId: 'segundo',
    options: [
      { id: 'maior', label: 'Crescer o de 8: fica 9×4=36', explanation: 'Aumentar o grupo grande rende menos: 36 contra os 40 da outra opção.' },
      { id: 'segundo', label: 'Crescer o de 4: fica 8×5=40', explanation: 'Certo: acrescentar ao fator mais pequeno aumenta mais o produto — 40 em vez de 36.' },
      { id: 'indiferente', label: 'É igual, a soma é a mesma', explanation: 'Com a mesma soma, o produto cresce quando aproximas os fatores: 8×5 supera 9×4.' },
    ],
    diagram: {
      rows: ['XXXX*.XX', 'XXXX..XX', '......*.'],
      caption: 'Esquema: as duas casas ★ crescem o grupo de 8 (9×4=36) ou o grupo de 4 (8×5=40).',
    },
  },
  {
    id: 'pr-cores-1', gameId: 'produto', patternId: 'produto:grupo-isolado', title: 'A peça do rival como muro',
    prompt: 'Os teus dois grupos estão quase a tocar-se e queres mantê-los separados. Como pode ajudar a peça de cor adversária que colocas neste turno?',
    hint: 'Uma peça rival também ocupa espaço.', correctOptionId: 'muro',
    options: [
      { id: 'longe', label: 'Colocá-la o mais longe possível', explanation: 'Longe não estraga nada — mas também não protege a tua estrutura de dois fatores.' },
      { id: 'muro', label: 'Usá-la como muro entre os teus grupos', explanation: 'Certo: uma peça rival no ponto de contacto impede a fusão acidental e preserva os teus dois fatores.' },
      { id: 'colar', label: 'Colá-la ao maior grupo dele', explanation: 'Colar ao grupo grande dele até o pode ajudar a fundir; pensa primeiro na tua estrutura.' },
    ],
  },
  {
    id: 'pr-final-1', gameId: 'produto', patternId: 'produto:equilibrio', title: 'Final resolvido: o par exato',
    prompt: 'Posição real, resolvida por análise completa: faltam 6 casas e jogas com as pretas (X). Das 60 combinações possíveis do teu turno, só uma vence. Qual?',
    hint: 'Pensa no que cada par de peças faz aos teus dois maiores grupos — e aos dele.', correctOptionId: 'ambas',
    options: [
      { id: 'ambas', label: 'Casas 1 e 2, ambas com a tua cor', explanation: 'Certo — e provado: analisadas todas as continuações, só este par garante o produto vencedor no fim.' },
      { id: 'afastada', label: 'Casas 1 e 3, ambas com a tua cor', explanation: 'Demonstrado: não ganha o jogo — a casa 3 desperdiça a peça longe da estrutura decisiva.' },
      { id: 'mista', label: 'Casa 1 com a tua cor e casa 2 com a cor dele', explanation: 'Demonstrado: não ganha o jogo — dar-lhe a casa 2 estraga exatamente a ligação de que precisas.' },
    ],
    diagram: {
      rows: ['##XOOO.##', '#XO.OXX##', '#OXXXXXX#', '3OXX.XXX#', 'OXXOXOXXX', 'XOOXOOXX#', '#XOXXOOO#', '#XOXO12##', '##XOXOO##'],
      caption: 'Jogas com as pretas (X); cada turno coloca duas peças de cores à tua escolha. Final real resolvido por busca completa (140 posições analisadas).',
      hexOffset: true,
    },
  },
  {
    id: 'ag-atari-1', gameId: 'atari-go', patternId: 'atari-go:atari', title: 'Uma liberdade',
    prompt: 'Um grupo adversário tem exatamente uma liberdade. Como se chama esta situação e qual é a prioridade?',
    hint: 'A próxima pedra nessa liberdade pode terminar a partida.', correctOptionId: 'capturar',
    options: [
      { id: 'capturar', label: 'Atari: verificar a captura imediata', explanation: 'Certo: ocupar a última liberdade captura o grupo e vence imediatamente no Atari Go.' },
      { id: 'longe', label: 'Jogar longe para ganhar território', explanation: 'Território não decide esta variante; uma captura imediata tem prioridade.' },
      { id: 'passar', label: 'Passar o turno', explanation: 'A variante implementada não usa passe e a captura disponível pode decidir já o jogo.' },
    ],
    diagram: {
      rows: ['..X..', '.XOX.', '.XO*.', '..X..'],
      caption: 'O grupo branco tem uma única liberdade (★): ocupá-la captura e vence a partida.',
    },
  },
  {
    id: 'ag-escada-1', gameId: 'atari-go', patternId: 'atari-go:ladder', title: 'Ler a escada',
    prompt: 'Numa escada, o adversário foge sempre para uma nova liberdade e tu voltas a dar atari. O que tens de verificar antes de iniciar?',
    hint: 'Segue mentalmente a diagonal até à borda.', correctOptionId: 'apoio',
    options: [
      { id: 'apoio', label: 'Se aparece uma pedra de apoio no caminho', explanation: 'Certo: uma pedra de apoio pode quebrar a sequência forçada e inverter a captura.' },
      { id: 'territorio', label: 'Quantos pontos de território ganhas', explanation: 'Atari Go termina na primeira captura; a leitura é sobre liberdades e apoio, não território.' },
      { id: 'aleatorio', label: 'Nada: toda escada funciona', explanation: 'Escadas falham quando o grupo perseguido encontra apoio ou espaço para aumentar liberdades.' },
    ],
  },
  {
    id: 'ag-rede-1', gameId: 'atari-go', patternId: 'atari-go:net', title: 'Rede em vez de contacto',
    prompt: 'Não consegues dar atari imediato, mas podes fechar todas as rotas de fuga com distância. Que padrão procuras?',
    hint: 'Nem toda captura começa por tocar diretamente no grupo.', correctOptionId: 'rede',
    options: [
      { id: 'rede', label: 'Uma rede de envolvimento', explanation: 'Certo: a rede limita as saídas à distância e prepara uma captura inevitável.' },
      { id: 'ponte', label: 'Uma ponte de Nex', explanation: 'Pontes são padrões de conexão de Nex; aqui analisam-se liberdades e rotas de fuga.' },
      { id: 'produto', label: 'Equilibrar dois grupos', explanation: 'Equilibrar grupos pertence ao Produto e não resolve a fuga de pedras no Atari Go.' },
    ],
  },
  {
    id: 'ag-duplo-1', gameId: 'atari-go', patternId: 'atari-go:double-atari', title: 'Dois ataris de uma vez',
    prompt: 'Uma jogada tua deixa dois grupos adversários com uma só liberdade cada. Porque é quase sempre decisiva?',
    hint: 'O adversário só tem um turno de resposta.', correctOptionId: 'um-so',
    options: [
      { id: 'um-so', label: 'Ele só consegue salvar um dos grupos', explanation: 'Certo: com uma resposta por turno, o segundo grupo em atari cai — e a primeira captura vence.' },
      { id: 'medo', label: 'Assusta o adversário', explanation: 'A força é concreta, não psicológica: duas ameaças de captura e uma única resposta possível.' },
      { id: 'liberdades', label: 'Ganha liberdades ao teu grupo', explanation: 'O efeito principal é criar duas ameaças de captura simultâneas, não reforçar o teu grupo.' },
    ],
    diagram: {
      rows: ['.....', '.X.X.', '.O*O.', '.X.X.', '.....'],
      caption: 'Jogar em ★ deixa as duas pedras brancas em atari ao mesmo tempo — só uma pode escapar.',
    },
  },
  {
    id: 'ag-snapback-1', gameId: 'atari-go', patternId: 'atari-go:snapback', title: 'Cuidado com o snapback',
    prompt: 'No Go clássico há sacrifícios em que deixas capturar uma pedra para recapturar de seguida. Porque não podes contar com isso no Atari Go?',
    hint: 'Relembra a condição de vitória desta variante.', correctOptionId: 'primeira',
    options: [
      { id: 'proibido', label: 'Porque o sacrifício é ilegal', explanation: 'Não é uma questão de legalidade: a jogada existe, mas a partida acaba antes da recaptura.' },
      { id: 'primeira', label: 'Porque a primeira captura termina o jogo', explanation: 'Certo: no Atari Go quem captura primeiro vence — deixar capturar uma pedra é perder de imediato.' },
      { id: 'funciona', label: 'Podes: o snapback funciona igual', explanation: 'No Atari Go nunca chegas a recapturar: a captura da tua pedra fecha a partida contra ti.' },
    ],
  },
  {
    id: 'ag-defesa-1', gameId: 'atari-go', patternId: 'atari-go:atari', title: 'Atacar ou defender?',
    prompt: 'O teu grupo está em atari, mas um grupo adversário também está — e é a tua vez. O que fazes?',
    hint: 'Só uma das opções termina o jogo já.', correctOptionId: 'capturar',
    options: [
      { id: 'defender', label: 'Defender o teu grupo primeiro', explanation: 'Defender dá-lhe o turno seguinte para te capturar noutra frente; a captura disponível vence já.' },
      { id: 'capturar', label: 'Capturar imediatamente', explanation: 'Certo: a primeira captura vence o jogo — quando podes capturar, nenhuma defesa é prioritária.' },
      { id: 'fugir', label: 'Fugir com o grupo para o centro', explanation: 'Fugir gasta o turno em que podias simplesmente vencer com a captura disponível.' },
    ],
    diagram: {
      rows: ['.O...X.', 'OXO.XOX', 'OXO.XOX', '.....*.'],
      caption: 'O teu grupo (esquerda) está em atari, mas o grupo branco (direita) também: capturar em ★ vence já.',
    },
  },
  {
    id: 'ag-mestre-abertura-1', gameId: 'atari-go', patternId: 'atari-go:abertura', title: 'A abertura do Mestre',
    prompt: 'A rede AlphaZero treinou com 60 000 partidas contra si própria. Na posição inicial, onde concentra ela quase toda a preferência?',
    hint: 'A rede avalia a posição inicial em +0,57 para quem começa — a vantagem constrói-se com apoio perto do centro.', correctOptionId: 'diagonais',
    options: [
      { id: 'cantos', label: 'Nos cantos, como no Go clássico', explanation: 'No Atari Go os cantos valem pouco: a rede dá-lhes cerca de 0,02% de preferência — sem território para defender, o canto só oferece poucas liberdades.' },
      { id: 'diagonais', label: 'Nas quatro casas em diagonal junto ao centro', explanation: 'Certo: a rede reparte ~25% por cada uma das casas (3,3), (3,5), (5,3) e (5,5) — perto do centro para ter liberdades, sem ocupar o ponto central exposto.' },
      { id: 'tengen', label: 'No ponto central exato', explanation: 'Surpresa: o centro exato recebe ~0,1% da preferência da rede — uma pedra isolada no meio é cercável por todos os lados.' },
    ],
    diagram: {
      rows: ['.........', '.........', '.........', '...*.*...', '.........', '...*.*...', '.........', '.........', '.........'],
      caption: 'As quatro aberturas preferidas da rede az-v1 (★), com ~25% de preferência cada; cantos e centro exato ficam perto de 0%.',
    },
  },
  {
    id: 'ag-mestre-defesa-1', gameId: 'atari-go', patternId: 'atari-go:atari', title: 'A última liberdade',
    prompt: 'Posição real do treino do Mestre: uma pedra tua (pretas) está em atari e o adversário captura na próxima jogada. Qual das três casas salva o grupo?',
    hint: 'Conta as liberdades da pedra ameaçada — e as que cada casa lhe acrescenta.', correctOptionId: 'casa2',
    options: [
      { id: 'casa1', label: 'Casa 1', explanation: 'A pedra ameaçada continua com uma só liberdade: ele joga lá e captura — no Atari Go, a primeira captura termina o jogo (a rede avalia esta casa em −0,97).' },
      { id: 'casa2', label: 'Casa 2', explanation: 'Certo: ocupas a última liberdade da tua pedra, ligas as duas pedras e o grupo novo fica com duas liberdades — a ameaça de captura desaparece (avaliação +0,99).' },
      { id: 'casa3', label: 'Casa 3', explanation: 'Não toca na ameaça: a captura continua disponível na jogada seguinte e o jogo acaba (avaliação −0,99).' },
    ],
    diagram: {
      rows: ['.........', '.........', '..O.O.X..', '...O.....', '....OX...', '.OXXXOX..', '.OX.OOX..', '.OXOXOX..', '..X123...'],
      caption: 'Pretas (X) jogam. A pedra preta da penúltima linha tem uma única liberdade; do treino az-v1 (iteração 27), verificado por MCTS a 800 simulações.',
    },
  },
  {
    id: 'ag-mestre-contra-1', gameId: 'atari-go', patternId: 'atari-go:atari', title: 'Defender atacando',
    prompt: 'Posição real do treino do Mestre: o teu grupo está a ser cercado. Uma das três casas passa ao ataque; as outras duas recuam e perdem.',
    hint: 'Procura a casa que, além de dar ar ao teu grupo, deixa uma pedra dele com uma só liberdade.', correctOptionId: 'casa3',
    options: [
      { id: 'casa1', label: 'Casa 1', explanation: 'Recuar na diagonal não ameaça nada: ele continua o cerco e a rede avalia a posição em −0,45 para ti.' },
      { id: 'casa2', label: 'Casa 2', explanation: 'Defende de forma passiva: ele mantém a iniciativa do cerco e a avaliação cai para −0,37.' },
      { id: 'casa3', label: 'Casa 3', explanation: 'Certo: esta casa dá liberdades ao teu grupo E deixa a pedra dele de cima em atari — ele é obrigado a responder e a iniciativa passa para ti (avaliação +0,72).' },
    ],
    diagram: {
      rows: ['.........', '.1.......', '..3......', '.2OX.....', '..XOO....', '...XOO...', '..X......', '.........', '.........'],
      caption: 'Tu jogas com X. Depois da Casa 3, a pedra O adjacente fica com uma única liberdade; do treino az-v1, verificado por MCTS a 800 simulações.',
    },
  },
  {
    id: 'ag-mestre-conexao-1', gameId: 'atari-go', patternId: 'atari-go:conexao', title: 'Ligar antes do corte',
    prompt: 'Posição real do treino do Mestre: duas pedras tuas quase se tocam. A rede vê aqui uma única jogada certa — qual?',
    hint: 'O que acontece à tua pedra de (3,3) se for ele a jogar entre as tuas duas pedras?', correctOptionId: 'casa2',
    options: [
      { id: 'casa1', label: 'Casa 1', explanation: 'Ataca as pedras dele, mas deixa o corte disponível: ele separa as tuas pedras e a avaliação fica praticamente empatada (+0,05) — a vantagem evapora-se.' },
      { id: 'casa2', label: 'Casa 2', explanation: 'Certo: liga as tuas duas pedras num só grupo com cinco liberdades. Sem esta ligação, ele corta aqui e caça a pedra de (3,3) — a rede avalia a conexão em +0,73.' },
      { id: 'casa3', label: 'Casa 3', explanation: 'Mergulha na zona onde ele é mais forte e ignora o corte: a rede avalia esta casa em −0,63 para ti.' },
    ],
    diagram: {
      rows: ['.........', '.........', '.1X2.....', '.OOX.....', '.3XOO....', '...XOO...', '..X......', '.........', '.........'],
      caption: 'Tu jogas com X. A Casa 2 liga (2,2) a (3,3); do treino az-v1 (iteração 27), verificado por MCTS a 800 simulações.',
    },
  },
  {
    id: 'nx-ponte-1', gameId: 'nex', patternId: 'nex:ponte', title: 'Ligação virtual',
    prompt: 'Duas peças tuas têm duas casas alternativas que completam a ligação entre elas. Porque essa ponte é resistente?',
    hint: 'Se o adversário ocupar uma alternativa, ainda tens a outra.', correctOptionId: 'duas',
    options: [
      { id: 'duas', label: 'Existem duas respostas para completar a ligação', explanation: 'Certo: o adversário não consegue cortar as duas alternativas com uma única jogada.' },
      { id: 'neutra', label: 'Toda casa vazia já é neutra', explanation: 'Casas vazias não são peças neutras; só se tornam neutras por uma colocação.' },
      { id: 'captura', label: 'A ponte captura peças', explanation: 'Nex não tem capturas; a ponte protege conectividade entre as margens-alvo.' },
    ],
    diagram: {
      rows: ['X*', '*X'],
      caption: 'Ponte: as duas casas ★ são alternativas de ligação — uma única jogada rival não corta ambas.',
      hexOffset: true,
    },
  },
  {
    id: 'nx-ameaca-1', gameId: 'nex', patternId: 'nex:ameaca-dupla', title: 'Duas rotas',
    prompt: 'Uma jogada própria abre dois caminhos independentes para a margem final. O que o adversário enfrenta?',
    hint: 'Uma resposta só consegue bloquear uma casa.', correctOptionId: 'dupla',
    options: [
      { id: 'dupla', label: 'Uma ameaça dupla de conexão', explanation: 'Certo: duas rotas independentes obrigam o rival a escolher qual tenta bloquear.' },
      { id: 'empate', label: 'Um empate automático', explanation: 'Nex não termina empatado; as ameaças múltiplas procuram forçar uma ligação vencedora.' },
      { id: 'troca', label: 'Uma nova regra da torta', explanation: 'A regra da torta só aparece após a abertura, não em qualquer ameaça dupla.' },
    ],
  },
  {
    id: 'nx-bloqueio-1', gameId: 'nex', patternId: 'nex:bloqueio-central', title: 'A neutra certa',
    prompt: 'Ao colocar uma peça própria e uma neutra, onde tende a ser mais valiosa a neutra defensiva?',
    hint: 'Compara o caminho mínimo adversário antes e depois.', correctOptionId: 'corte',
    options: [
      { id: 'corte', label: 'Numa casa de corte do caminho rival', explanation: 'Certo: uma neutra na rota mínima pode aumentar a distância de ligação do adversário.' },
      { id: 'canto', label: 'Sempre num canto vazio', explanation: 'Um canto sem ligação ao caminho rival pode não atrasar a ameaça principal.' },
      { id: 'propria', label: 'Em cima de uma peça própria', explanation: 'A colocação normal exige uma casa vazia diferente para a peça neutra.' },
    ],
  },
  {
    id: 'nx-tripla-1', gameId: 'nex', patternId: 'nex:tripla-ameaca', title: 'Porquê três rotas',
    prompt: 'No Nex, cada jogada rival coloca uma peça própria E uma neutra. O que muda isso na defesa contra as tuas ameaças?',
    hint: 'Uma jogada dele pode tapar duas casas.', correctOptionId: 'tres',
    options: [
      { id: 'nada', label: 'Nada, uma ameaça dupla continua a chegar', explanation: 'Com peça própria + neutra, uma única jogada rival pode neutralizar duas rotas — a dupla nem sempre basta.' },
      { id: 'tres', label: 'Podem tapar duas rotas — três ameaças é que garantem', explanation: 'Certo: como cada turno rival cobre até duas casas, só uma terceira rota independente força a ligação.' },
      { id: 'uma', label: 'Basta uma rota bem escondida', explanation: 'Não há rotas escondidas: com caminhos visíveis, é o número de ameaças independentes que decide.' },
    ],
  },
  {
    id: 'nx-substituicao-1', gameId: 'nex', patternId: 'nex:ponte', title: 'O valor da substituição',
    prompt: 'Podes converter duas peças neutras em tuas (tornando uma peça tua neutra). Quando brilha esta jogada?',
    hint: 'Olha para as neutras que já estão no teu caminho.', correctOptionId: 'caminho',
    options: [
      { id: 'sempre', label: 'Sempre: duas peças por uma é lucro', explanation: 'Também entregas uma posição tua ao tabuleiro neutro; só compensa se as convertidas valerem mais.' },
      { id: 'caminho', label: 'Quando as neutras convertidas completam a tua ligação', explanation: 'Certo: neutras já pousadas na tua rota tornam-se tuas de uma vez — muitas vezes é a jogada que fecha o jogo.' },
      { id: 'inicio', label: 'Logo na abertura', explanation: 'Na abertura há poucas neutras úteis; a substituição ganha força no meio-jogo, sobre rotas reais.' },
    ],
  },
  {
    id: 'nx-defesa-1', gameId: 'nex', patternId: 'nex:bloqueio-central', title: 'Defender uma ponte rival',
    prompt: 'O adversário tem uma ponte (duas casas alternativas de ligação). Colocar uma peça numa das casas resolve?',
    hint: 'Ele responde na outra casa.', correctOptionId: 'sobreposicao',
    options: [
      { id: 'resolve', label: 'Sim, a ponte fica cortada', explanation: 'Cortar uma alternativa deixa a outra livre: ele completa a ligação na jogada seguinte.' },
      { id: 'sobreposicao', label: 'Não: bloqueia onde as rotas dele se sobrepõem ou cria a tua ameaça', explanation: 'Certo: ou encontras uma casa comum a várias rotas, ou respondes com uma ameaça tua mais rápida.' },
      { id: 'neutra-dupla', label: 'Só com duas neutras no mesmo turno', explanation: 'Cada turno coloca uma neutra apenas; contra uma ponte sólida, procura sobreposições ou contra-ataque.' },
    ],
  },
  {
    id: 'nx-ligacao-1', gameId: 'nex', patternId: 'nex:ponte', title: 'A casa que liga já',
    prompt: 'Posição real de uma corrida de ligações: jogas com X (ligas topo a fundo). Verificámos todas as casas do tabuleiro: exatamente uma completa a tua ligação nesta jogada. Qual?',
    hint: 'Segue a tua cadeia de cima para baixo e procura o único elo em falta.', correctOptionId: 'casa2',
    options: [
      { id: 'casa1', label: 'Casa 1', explanation: 'Não liga já: fica encostada à cadeia mas deixa o elo crítico por fechar — e a corrida continua.' },
      { id: 'casa2', label: 'Casa 2', explanation: 'Certo — e verificado exaustivamente: é a única casa do tabuleiro que completa a tua ligação de imediato (nenhuma substituição vence já).' },
      { id: 'casa3', label: 'Casa 3', explanation: 'Não liga já: aproxima as tuas pedras, mas a cadeia continua interrompida no elo decisivo.' },
    ],
    diagram: {
      rows: ['..O.NXN', '..NOX.O', '..N.X.X', 'NNNXON.', '.N.2X3O', '...NX.N', '.N1X...', 'N.NX...', '.O.X...', '.O.X..N', 'N.XNOO.'],
      caption: 'Excerto do tabuleiro (X liga topo↕fundo; N são neutras). Verificação exaustiva: só a Casa 2 liga já — as outras não vencem de imediato.',
      hexOffset: true,
    },
  },
];

export function getPuzzlesForGame(gameId: GameId): PuzzleDefinition[] {
  return PUZZLES.filter((puzzle) => puzzle.gameId === gameId);
}

/**
 * Ordem de apresentação das opções, baralhada aleatoriamente a cada visita
 * ao puzzle (o chamador deve memoizar durante uma tentativa para a ordem
 * não mudar entre escolher e confirmar). `random` é injetável para testes.
 */
export function getDisplayOptions(
  puzzle: PuzzleDefinition,
  random: () => number = Math.random,
): PuzzleOption[] {
  const order = puzzle.options.map((_, index) => index);
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  return order.map((index) => puzzle.options[index]!);
}

export function evaluatePuzzleAnswer(
  puzzle: PuzzleDefinition,
  optionId: string,
): { correct: boolean; explanation: string } {
  const option = puzzle.options.find((candidate) => candidate.id === optionId);
  if (!option) {
    return {
      correct: false,
      explanation: 'Escolhe uma das três opções antes de confirmar.',
    };
  }
  return {
    correct: option.id === puzzle.correctOptionId,
    explanation: option.explanation,
  };
}
