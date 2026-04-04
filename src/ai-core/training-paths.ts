import type { GameId } from './types';

export interface TrainingPathStep {
  title: string;
  checkpoints: string[];
}

export interface TrainingPath {
  focusNow: string;
  commonMistake: string;
  steps: TrainingPathStep[];
}

export const TRAINING_PATHS: Record<GameId, TrainingPath> = {
  'gatos-caes': {
    focusNow: 'Preservar mobilidade: joga para continuares com mais casas legais do que o adversário.',
    commonMistake: 'Fechar cedo as casas centrais ou encostar peças que bloqueiam demasiadas respostas.',
    steps: [
      {
        title: 'Base',
        checkpoints: [
          'Aprender as regras especiais das primeiras jogadas.',
          'Valorizar centro e casas que mantêm várias respostas abertas.',
        ],
      },
      {
        title: 'Intermédio',
        checkpoints: [
          'Contar casas legais tuas vs. do adversário após cada jogada.',
          'Reconhecer posições em que uma única casa decide a partida.',
        ],
      },
      {
        title: 'Campeonato',
        checkpoints: [
          'Forçar finais onde o adversário fica sem resposta no turno seguinte.',
          'Antecipar 2-3 turnos de bloqueio sem perder mobilidade própria.',
        ],
      },
    ],
  },
  dominorio: {
    focusNow: 'Controlar o espaço útil e guardar o ritmo do fim de jogo.',
    commonMistake: 'Gastar cedo corredores completos sem garantir vantagem no número de respostas.',
    steps: [
      {
        title: 'Base',
        checkpoints: [
          'Ver imediatamente se a posição pede dominó vertical ou horizontal.',
          'Evitar reduzir demasiado o espaço do teu próprio lado.',
        ],
      },
      {
        title: 'Intermédio',
        checkpoints: [
          'Ler finais curtos e comparar quantas respostas ficam para cada jogador.',
          'Treinar escolhas que mantêm duas ou três alternativas fortes.',
        ],
      },
      {
        title: 'Campeonato',
        checkpoints: [
          'Planear o final desde o meio-jogo e reconhecer posições instáveis.',
          'Usar a melhor jogada para tirar mobilidade ao adversário sem perder a tua.',
        ],
      },
    ],
  },
  quelhas: {
    focusNow: 'Manter segmentos curtos disponíveis para não seres empurrado para a última jogada.',
    commonMistake: 'Fechar faixas grandes cedo e deixar uma única saída para o fim.',
    steps: [
      {
        title: 'Base',
        checkpoints: [
          'Visualizar segmentos válidos na horizontal e vertical.',
          'Preferir jogadas que fechem pouco espaço quando ainda há muitas opções.',
        ],
      },
      {
        title: 'Intermédio',
        checkpoints: [
          'Reconhecer quando um segmento curto guarda o controlo do final.',
          'Comparar quantas saídas restam depois de cada segmento.',
        ],
      },
      {
        title: 'Campeonato',
        checkpoints: [
          'Entrar em finais com plano misère: obrigar o adversário a jogar por último.',
          'Identificar faixas críticas e gerir o comprimento ideal do segmento.',
        ],
      },
    ],
  },
  produto: {
    focusNow: 'Criar dois grupos fortes teus e, sempre que possível, estragar o produto do adversário.',
    commonMistake: 'Fazer um grupo gigante único e ficar com produto zero.',
    steps: [
      {
        title: 'Base',
        checkpoints: [
          'Perceber que cada turno coloca duas peças e que as cores são livres.',
          'Construir cedo duas zonas promissoras em vez de um só aglomerado.',
        ],
      },
      {
        title: 'Intermédio',
        checkpoints: [
          'Aprender a usar a cor do adversário para partir ou fundir grupos dele.',
          'Comparar produto atual e produto potencial depois da tua jogada dupla.',
        ],
      },
      {
        title: 'Campeonato',
        checkpoints: [
          'Equilibrar os dois maiores grupos para maximizar o produto final.',
          'Sabotar conscientemente a segunda maior cadeia do adversário.',
        ],
      },
    ],
  },
  'atari-go': {
    focusNow: 'Contar liberdades e reagir primeiro às ameaças de captura imediata.',
    commonMistake: 'Atacar sem confirmar se o teu grupo fica em atari no lance seguinte.',
    steps: [
      {
        title: 'Base',
        checkpoints: [
          'Contar liberdades de grupos pequenos antes de jogar.',
          'Defender primeiro grupos em atari.',
        ],
      },
      {
        title: 'Intermédio',
        checkpoints: [
          'Criar ameaças de captura em duas frentes.',
          'Usar jogadas que aumentam as tuas liberdades e reduzem as do adversário.',
        ],
      },
      {
        title: 'Campeonato',
        checkpoints: [
          'Reconhecer capturas forçadas e sequências de pressão local.',
          'Escolher sempre entre ataque imediato e defesa crítica com leitura curta correta.',
        ],
      },
    ],
  },
  nex: {
    focusNow: 'Reduzir a tua distância de ligação e usar a peça neutra para bloquear o caminho rival.',
    commonMistake: 'Colocar a peça própria bem, mas desperdiçar a neutra sem bloquear a melhor rota adversária.',
    steps: [
      {
        title: 'Base',
        checkpoints: [
          'Entender as margens que cada cor liga.',
          'Separar o papel da peça própria e da peça neutra numa jogada de colocação.',
        ],
      },
      {
        title: 'Intermédio',
        checkpoints: [
          'Comparar caminhos mínimos teus e do adversário.',
          'Usar a regra da torta quando a abertura rival te oferece melhor cor.',
        ],
      },
      {
        title: 'Campeonato',
        checkpoints: [
          'Escolher entre colocação e substituição conforme a ligação disponível.',
          'Fechar ligações vencedoras ou cortar a rede rival com a neutra certa.',
        ],
      },
    ],
  },
};

export function getTrainingPath(gameId: GameId): TrainingPath {
  return TRAINING_PATHS[gameId];
}
