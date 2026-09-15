import type { GameId } from './types';

export type ThinkingLevel = 0 | 1 | 2 | 3;

/** A requested hint belongs to a turn, including all parts of a compound move. */
export interface ThinkingState { turn: string; level: ThinkingLevel }

export function thinkingTurnKey(state: {
  tabuleiro: unknown;
  modo: string;
  jogadorAtual: string;
  estado: string;
  jogadaEmCurso?: { pos1: { q: number; r: number } | null };
  swapDisponivel?: boolean;
  trocaDisponivel?: boolean;
}, player: string, difficulty: number): string {
  let board = state.tabuleiro;
  // Produto puts its first stone on the board before the turn is complete.
  // Cancelling/changing that stone must not turn assisted play into solo play.
  if (state.jogadaEmCurso?.pos1) {
    const { q, r } = state.jogadaEmCurso.pos1;
    board = { ...board as Record<string, unknown>, [`${q},${r}`]: 'vazia' };
  }
  return JSON.stringify([board, state.modo, state.jogadorAtual, state.estado, player, difficulty, state.swapDisponivel, state.trocaDisponivel]);
}

export function thinkingLevel(state: ThinkingState, turn: string): ThinkingLevel {
  return state.turn === turn ? state.level : 0;
}

export function advanceThinking(state: ThinkingState, turn: string): ThinkingState {
  return { turn, level: Math.min(3, thinkingLevel(state, turn) + 1) as ThinkingLevel };
}

export const THINKING_PROMPTS: Record<GameId, { question: string; principle: string; compare: string }> = {
  'gatos-caes': {
    question: 'Escolhe uma casa. Onde poderá o adversário jogar depois?',
    principle: 'Conta as casas legais de cada espécie. Uma casa exclusiva pode ficar guardada.',
    compare: 'Imagina duas escolhas tuas e uma resposta do adversário a cada uma. Em qual conservas mais casas legais?',
  },
  dominorio: {
    question: 'Escolhe um dominó. Que espaço deixas à outra orientação?',
    principle: 'Procura corredores onde só caiba a tua orientação e zonas que ambos podem usar.',
    compare: 'Compara dois dominós. Depois de cada um, conta uma resposta tua e uma do adversário.',
  },
  quelhas: {
    question: 'Escolhe um segmento. Quem poderá ser obrigado a jogar o último?',
    principle: 'Aqui perde quem faz a última jogada. Confirma quais os segmentos que restam para cada orientação.',
    compare: 'Experimenta mentalmente um segmento curto e um comprido. Alterna as respostas até ao fim, se forem forçadas.',
  },
  produto: {
    question: 'Planeia as duas peças. Como ficam os dois maiores grupos de cada cor?',
    principle: 'A pontuação é o produto dos dois maiores grupos. As duas peças podem ter qualquer cor.',
    compare: 'Calcula a pontuação antes e depois de duas escolhas. Confirma se alguma peça junta grupos que querias separados.',
  },
  'atari-go': {
    question: 'Escolhe uma interseção. O adversário poderá capturar logo a seguir?',
    principle: 'Conta as liberdades dos grupos em contacto. A primeira captura termina a partida.',
    compare: 'Compara atacar e proteger. Depois de cada escolha, verifica se algum grupo fica com uma só liberdade.',
  },
  nex: {
    question: 'Planeia a ação completa. Que ligação pode o adversário ameaçar depois?',
    principle: 'A peça própria e a neutra têm efeitos diferentes. Confirma também se uma substituição ajuda a ligar as margens.',
    compare: 'Compara duas ações completas. Em cada uma, segue o teu caminho e procura um corte ou uma ligação imediata do adversário.',
  },
};
