import type { GameId } from './types';

export interface PuzzleOption {
  id: string;
  label: string;
  explanation: string;
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
    id: 'do-paridade-1', gameId: 'dominorio', patternId: 'dominorio:paridade', title: 'Contar antes de cortar',
    prompt: 'Uma região isolada admite exatamente quatro dominós alternados. Quem jogar primeiro nessa região fará também a última jogada?',
    hint: 'Conta as jogadas: 1, 2, 3, 4.', correctOptionId: 'nao',
    options: [
      { id: 'sim', label: 'Sim, porque começou', explanation: 'Com quatro jogadas, o primeiro joga a 1.ª e a 3.ª; não joga a última.' },
      { id: 'nao', label: 'Não, o segundo fará a quarta', explanation: 'Certo: numa sequência par, quem responde joga a última peça dessa região.' },
      { id: 'depende', label: 'É impossível contar', explanation: 'Quando a região já tem uma sequência forçada, a paridade permite contar exatamente.' },
    ],
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
    id: 'pr-equilibrio-1', gameId: 'produto', patternId: 'produto:equilibrio', title: 'Dois fatores fortes',
    prompt: 'Os teus dois maiores grupos têm tamanhos 8 e 2. Outra jogada pode deixá-los com 6 e 4. Qual produto é maior?',
    hint: 'Calcula 8×2 e 6×4.', correctOptionId: 'equilibrado',
    options: [
      { id: 'oito', label: '8×2, porque tem o maior grupo', explanation: '8×2 vale 16; um grupo enorme não compensa sempre um segundo grupo fraco.' },
      { id: 'equilibrado', label: '6×4, porque vale 24', explanation: 'Certo: equilibrar os dois fatores aumenta o produto de 16 para 24.' },
      { id: 'igual', label: 'São iguais porque usam 10 peças', explanation: 'Com a mesma soma, distribuições mais equilibradas podem produzir valores maiores.' },
    ],
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
    id: 'ag-atari-1', gameId: 'atari-go', patternId: 'atari-go:atari', title: 'Uma liberdade',
    prompt: 'Um grupo adversário tem exatamente uma liberdade. Como se chama esta situação e qual é a prioridade?',
    hint: 'A próxima pedra nessa liberdade pode terminar a partida.', correctOptionId: 'capturar',
    options: [
      { id: 'capturar', label: 'Atari: verificar a captura imediata', explanation: 'Certo: ocupar a última liberdade captura o grupo e vence imediatamente no Atari Go.' },
      { id: 'longe', label: 'Jogar longe para ganhar território', explanation: 'Território não decide esta variante; uma captura imediata tem prioridade.' },
      { id: 'passar', label: 'Passar o turno', explanation: 'A variante implementada não usa passe e a captura disponível pode decidir já o jogo.' },
    ],
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
    id: 'nx-ponte-1', gameId: 'nex', patternId: 'nex:ponte', title: 'Ligação virtual',
    prompt: 'Duas peças tuas têm duas casas alternativas que completam a ligação entre elas. Porque essa ponte é resistente?',
    hint: 'Se o adversário ocupar uma alternativa, ainda tens a outra.', correctOptionId: 'duas',
    options: [
      { id: 'duas', label: 'Existem duas respostas para completar a ligação', explanation: 'Certo: o adversário não consegue cortar as duas alternativas com uma única jogada.' },
      { id: 'neutra', label: 'Toda casa vazia já é neutra', explanation: 'Casas vazias não são peças neutras; só se tornam neutras por uma colocação.' },
      { id: 'captura', label: 'A ponte captura peças', explanation: 'Nex não tem capturas; a ponte protege conectividade entre as margens-alvo.' },
    ],
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
];

export function getPuzzlesForGame(gameId: GameId): PuzzleDefinition[] {
  return PUZZLES.filter((puzzle) => puzzle.gameId === gameId);
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
