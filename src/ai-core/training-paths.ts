import type { GameId } from './types';
import type { LevelProgressSnapshot } from '../types/learner-core';

/** Objetivo verificável de um desafio contra a IA (níveis ≥ `level` contam). */
export interface DesafioGoal {
  level: number;
  /** Vitórias necessárias. */
  wins?: number;
  /** Vitórias seguidas necessárias (melhor sequência num nível ≥ level). */
  streak?: number;
  /** Meta de ≥50% de vitórias com pelo menos 4 jogos disputados. */
  half?: boolean;
}

export interface TrainingPathStep {
  title: string;
  checkpoints: string[];
  /** Puzzles do Laboratório cuja resolução completa esta etapa automaticamente. */
  puzzleIds?: string[];
  /** Desafio prático contra a IA, em texto. */
  desafio?: string;
  /** Objetivos que tornam o desafio verificável com o progresso por nível. */
  desafioGoals?: DesafioGoal[];
}

export interface DesafioEvaluation {
  done: boolean;
  /** Progresso legível, ex.: «vitórias N2+: 1/2 seguidas». */
  progress: string[];
}

export function evaluateDesafioGoals(
  goals: DesafioGoal[] | undefined,
  levelProgress: Record<number, LevelProgressSnapshot> | undefined,
): DesafioEvaluation | null {
  if (!goals || goals.length === 0) return null;
  const levels = levelProgress ?? {};
  const atLeast = (minimum: number) => {
    let wins = 0;
    let played = 0;
    let bestStreak = 0;
    for (const [key, snapshot] of Object.entries(levels)) {
      if (Number(key) < minimum) continue;
      wins += snapshot.wins;
      played += snapshot.played;
      bestStreak = Math.max(bestStreak, snapshot.bestWinStreak);
    }
    return { wins, played, bestStreak };
  };

  let done = true;
  const progress: string[] = [];
  for (const goal of goals) {
    const totals = atLeast(goal.level);
    if (goal.streak !== undefined) {
      const met = totals.bestStreak >= goal.streak;
      done &&= met;
      progress.push(`N${goal.level}+: ${Math.min(totals.bestStreak, goal.streak)}/${goal.streak} seguidas`);
    } else if (goal.half) {
      const met = totals.played >= 4 && totals.wins * 2 >= totals.played;
      done &&= met;
      progress.push(`N${goal.level}+: ${totals.wins} vitórias em ${totals.played} jogos (meta: ≥50% em ≥4)`);
    } else {
      const target = goal.wins ?? 1;
      const met = totals.wins >= target;
      done &&= met;
      progress.push(`N${goal.level}+: ${Math.min(totals.wins, target)}/${target} vitórias`);
    }
  }
  return { done, progress };
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
        title: 'Descobrir',
        checkpoints: [
          'Aprender as regras especiais das primeiras jogadas.',
          'Perceber que perde quem ficar sem casa legal.',
        ],
        puzzleIds: ['gc-centro-1'],
        desafio: 'Vence o N1 uma vez.',
        desafioGoals: [{ level: 1, wins: 1 }],
      },
      {
        title: 'Táticas',
        checkpoints: [
          'Comparar o valor de casas pelas respostas que preservam.',
          'Reconhecer casas garantidas (só a tua espécie pode lá jogar).',
        ],
        puzzleIds: ['gc-mobilidade-1', 'gc-bloqueio-1'],
        desafio: 'Vence o N2 duas vezes seguidas.',
        desafioGoals: [{ level: 2, streak: 2 }],
      },
      {
        title: 'Estratégia',
        checkpoints: [
          'Ocupar casas em disputa antes das exclusivas.',
          'Contar reservas de ambos os lados para ler o final.',
        ],
        puzzleIds: ['gc-tempo-1', 'gc-parede-1', 'gc-contagem-1'],
        desafio: 'Vence o N3 e depois o N4, uma vez cada.',
        desafioGoals: [{ level: 3, wins: 1 }, { level: 4, wins: 1 }],
      },
      {
        title: 'Campeonato',
        checkpoints: [
          'Jogar com as duas espécies e gerir o relógio.',
          'Rever duas derrotas e identificar a jogada que perdeu mobilidade.',
        ],
        desafio: 'Ganha pelo menos metade dos jogos contra o N4.',
        desafioGoals: [{ level: 4, half: true }],
      },
    ],
  },
  dominorio: {
    focusNow: 'Controlar o espaço útil e guardar o ritmo do fim de jogo.',
    commonMistake: 'Gastar cedo corredores completos sem garantir vantagem no número de respostas.',
    steps: [
      {
        title: 'Descobrir',
        checkpoints: [
          'Ver imediatamente se a posição pede dominó vertical ou horizontal.',
          'Perceber que perde quem ficar sem jogada legal.',
        ],
        puzzleIds: ['do-paridade-1'],
        desafio: 'Vence o N1 uma vez.',
        desafioGoals: [{ level: 1, wins: 1 }],
      },
      {
        title: 'Táticas',
        checkpoints: [
          'Analisar zonas separadas de forma independente.',
          'Reconhecer corredores exclusivos como reservas de jogadas.',
        ],
        puzzleIds: ['do-corte-1', 'do-corredor-1'],
        desafio: 'Vence o N2 duas vezes seguidas.',
        desafioGoals: [{ level: 2, streak: 2 }],
      },
      {
        title: 'Estratégia',
        checkpoints: [
          'Saber quando o espelho funciona e onde quebra.',
          'Contar reservas exclusivas e decidir cortes pelo total de respostas.',
        ],
        puzzleIds: ['do-espelho-1', 'do-paridade-2', 'do-corte-2'],
        desafio: 'Vence o N3 e depois o N4, uma vez cada.',
        desafioGoals: [{ level: 3, wins: 1 }, { level: 4, wins: 1 }],
      },
      {
        title: 'Campeonato',
        checkpoints: [
          'Jogar com as duas orientações e gerir o relógio.',
          'Rever duas derrotas e encontrar o corte ou corredor mal avaliado.',
        ],
        desafio: 'Ganha pelo menos metade dos jogos contra o N4.',
        desafioGoals: [{ level: 4, half: true }],
      },
    ],
  },
  quelhas: {
    focusNow: 'Manter segmentos curtos disponíveis para não seres empurrado para a última jogada.',
    commonMistake: 'Fechar faixas grandes cedo e deixar uma única saída para o fim.',
    steps: [
      {
        title: 'Descobrir',
        checkpoints: [
          'Visualizar segmentos válidos na horizontal e na vertical.',
          'Interiorizar a regra misère: quem faz a última jogada perde.',
        ],
        puzzleIds: ['qu-misere-1'],
        desafio: 'Vence o N1 uma vez.',
        desafioGoals: [{ level: 1, wins: 1 }],
      },
      {
        title: 'Táticas',
        checkpoints: [
          'Usar simetria com cuidado, confirmando legalidade e paridade.',
          'Avaliar componentes fraturadas pelos seus intervalos de jogadas.',
        ],
        puzzleIds: ['qu-simetria-1', 'qu-fratura-1'],
        desafio: 'Vence o N2 duas vezes seguidas.',
        desafioGoals: [{ level: 2, streak: 2 }],
      },
      {
        title: 'Estratégia',
        checkpoints: [
          'Criar e guardar bolsas de uma jogada para ajustar a paridade.',
          'Contar sequências forçadas e quebrar espelhos pelo eixo.',
        ],
        puzzleIds: ['qu-isolamento-1', 'qu-paridade-1', 'qu-tempo-1'],
        desafio: 'Vence o N3 e depois o N4, uma vez cada.',
        desafioGoals: [{ level: 3, wins: 1 }, { level: 4, wins: 1 }],
      },
      {
        title: 'Campeonato',
        checkpoints: [
          'Entrar em finais com plano misère definido.',
          'Rever duas derrotas e localizar onde a paridade fugiu.',
        ],
        desafio: 'Ganha pelo menos metade dos jogos contra o N4.',
        desafioGoals: [{ level: 4, half: true }],
      },
    ],
  },
  produto: {
    focusNow: 'Criar dois grupos fortes teus e, sempre que possível, estragar o produto do adversário.',
    commonMistake: 'Fazer um grupo gigante único e ficar com produto zero.',
    steps: [
      {
        title: 'Descobrir',
        checkpoints: [
          'Perceber que cada turno coloca duas peças e que as cores são livres.',
          'Saber que a pontuação multiplica os dois maiores grupos.',
        ],
        puzzleIds: ['pr-equilibrio-1'],
        desafio: 'Vence o N1 uma vez.',
        desafioGoals: [{ level: 1, wins: 1 }],
      },
      {
        title: 'Táticas',
        checkpoints: [
          'Avaliar fusões adversárias comparando os produtos antes e depois.',
          'Proteger o segundo grupo — sem ele o produto cai para zero.',
        ],
        puzzleIds: ['pr-fusao-1', 'pr-grupo-1'],
        desafio: 'Vence o N2 duas vezes seguidas.',
        desafioGoals: [{ level: 2, streak: 2 }],
      },
      {
        title: 'Estratégia',
        checkpoints: [
          'Preferir jogadas com dois efeitos (crescer e ameaçar).',
          'No fim, reforçar o fator mais pequeno e usar a cor rival como muro.',
        ],
        puzzleIds: ['pr-dupla-1', 'pr-fim-1', 'pr-cores-1'],
        desafio: 'Vence o N3 e depois o N4, uma vez cada.',
        desafioGoals: [{ level: 3, wins: 1 }, { level: 4, wins: 1 }],
      },
      {
        title: 'Campeonato',
        checkpoints: [
          'Equilibrar os dois maiores grupos até ao último turno.',
          'Rever duas derrotas e encontrar a fusão ou separação decisiva.',
        ],
        desafio: 'Ganha pelo menos metade dos jogos contra o N4.',
        desafioGoals: [{ level: 4, half: true }],
      },
    ],
  },
  'atari-go': {
    focusNow: 'Contar liberdades e reagir primeiro às ameaças de captura imediata.',
    commonMistake: 'Atacar sem confirmar se o teu grupo fica em atari no lance seguinte.',
    steps: [
      {
        title: 'Descobrir',
        checkpoints: [
          'Contar liberdades de grupos pequenos antes de jogar.',
          'Saber que a primeira captura vence a partida.',
        ],
        puzzleIds: ['ag-atari-1'],
        desafio: 'Vence o N1 uma vez.',
        desafioGoals: [{ level: 1, wins: 1 }],
      },
      {
        title: 'Táticas',
        checkpoints: [
          'Ler escadas até à borda e procurar pedras de apoio.',
          'Capturar com redes quando o contacto direto não chega.',
        ],
        puzzleIds: ['ag-escada-1', 'ag-rede-1'],
        desafio: 'Vence o N2 duas vezes seguidas.',
        desafioGoals: [{ level: 2, streak: 2 }],
      },
      {
        title: 'Estratégia',
        checkpoints: [
          'Criar ataris duplos e escolher sempre capturar quando é possível.',
          'Não confiar em sacrifícios do Go clássico: aqui a primeira captura fecha o jogo.',
        ],
        puzzleIds: ['ag-duplo-1', 'ag-snapback-1', 'ag-defesa-1'],
        desafio: 'Vence o N3 e depois o N4, uma vez cada.',
        desafioGoals: [{ level: 3, wins: 1 }, { level: 4, wins: 1 }],
      },
      {
        title: 'Campeonato',
        checkpoints: [
          'Aproveitar a iniciativa: quem começa tem vantagem real — disputa-a.',
          'Resolver os puzzles do Mestre: posições reais do treino AlphaZero.',
          'Rever duas derrotas e encontrar o atari ignorado.',
        ],
        puzzleIds: [
          'ag-mestre-abertura-1',
          'ag-mestre-defesa-1',
          'ag-mestre-contra-1',
          'ag-mestre-conexao-1',
        ],
        desafio: 'Ganha metade dos jogos contra o N4 e desafia o N6 «Mestre».',
        desafioGoals: [{ level: 4, half: true }],
      },
    ],
  },
  nex: {
    focusNow: 'Reduzir a tua distância de ligação e usar a peça neutra para bloquear o caminho rival.',
    commonMistake: 'Colocar a peça própria bem, mas desperdiçar a neutra sem bloquear a melhor rota adversária.',
    steps: [
      {
        title: 'Descobrir',
        checkpoints: [
          'Entender as margens que cada cor liga.',
          'Separar o papel da peça própria e da peça neutra numa jogada.',
        ],
        puzzleIds: ['nx-ponte-1'],
        desafio: 'Vence o N1 uma vez.',
        desafioGoals: [{ level: 1, wins: 1 }],
      },
      {
        title: 'Táticas',
        checkpoints: [
          'Construir pontes e ameaças duplas de ligação.',
          'Colocar neutras nas casas de corte do caminho rival.',
        ],
        puzzleIds: ['nx-ameaca-1', 'nx-bloqueio-1'],
        desafio: 'Vence o N2 duas vezes seguidas.',
        desafioGoals: [{ level: 2, streak: 2 }],
      },
      {
        title: 'Estratégia',
        checkpoints: [
          'Montar ameaças triplas: uma jogada rival só cobre duas casas.',
          'Usar a substituição quando as neutras convertidas completam a ligação.',
        ],
        puzzleIds: ['nx-tripla-1', 'nx-substituicao-1', 'nx-defesa-1'],
        desafio: 'Vence o N3 e depois o N4, uma vez cada.',
        desafioGoals: [{ level: 3, wins: 1 }, { level: 4, wins: 1 }],
      },
      {
        title: 'Campeonato',
        checkpoints: [
          'Decidir entre colocação e substituição pela ligação disponível.',
          'Rever duas derrotas e encontrar a neutra desperdiçada.',
        ],
        desafio: 'Ganha pelo menos metade dos jogos contra o N4.',
        desafioGoals: [{ level: 4, half: true }],
      },
    ],
  },
};

export function getTrainingPath(gameId: GameId): TrainingPath {
  return TRAINING_PATHS[gameId];
}
