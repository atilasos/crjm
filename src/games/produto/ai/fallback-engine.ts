import { calcularPontuacao, encontrarGrupos } from '../logic';
import type { Celula, JogadaDupla, Posicao, ProdutoState } from '../types';
import { gerarPosicoesValidas, posToKey } from '../types';
import type { AIDifficulty, ProdutoPackedMove, ProdutoPackedState } from './types';

const POSITIONS = gerarPosicoesValidas();
const KEY_TO_INDEX = new Map<string, number>(POSITIONS.map((pos, index) => [posToKey(pos), index]));

interface DifficultyTuning {
  topCells: number;
  maxCandidates: number;
  responseCandidates: number;
  lookahead: boolean;
  pickFromTop: number;
}

const TUNING: Record<AIDifficulty, DifficultyTuning> = {
  easy: { topCells: 6, maxCandidates: 20, responseCandidates: 8, lookahead: false, pickFromTop: 3 },
  medium: { topCells: 8, maxCandidates: 36, responseCandidates: 10, lookahead: false, pickFromTop: 2 },
  hard: { topCells: 10, maxCandidates: 60, responseCandidates: 12, lookahead: true, pickFromTop: 1 },
  'very-hard': { topCells: 12, maxCandidates: 90, responseCandidates: 14, lookahead: true, pickFromTop: 1 },
  max: { topCells: 14, maxCandidates: 120, responseCandidates: 18, lookahead: true, pickFromTop: 1 },
};

function getColorsForPlayer(state: ProdutoState): { own: 'preta' | 'branca'; opponent: 'preta' | 'branca' } {
  const own: 'preta' | 'branca' = state.jogadorAtual === 'jogador1' ? 'preta' : 'branca';
  return { own, opponent: own === 'preta' ? 'branca' : 'preta' };
}

function applyMove(board: Record<string, Celula>, move: JogadaDupla): Record<string, Celula> {
  const next = { ...board };
  next[posToKey(move.pos1)] = move.cor1;
  if (move.pos2 && move.cor2) {
    next[posToKey(move.pos2)] = move.cor2;
  }
  return next;
}

function countAdjacentOccupied(board: Record<string, Celula>, pos: Posicao): number {
  const dirs = [
    { q: 1, r: 0 },
    { q: 1, r: -1 },
    { q: 0, r: -1 },
    { q: -1, r: 0 },
    { q: -1, r: 1 },
    { q: 0, r: 1 },
  ];
  let count = 0;
  for (const dir of dirs) {
    const key = `${pos.q + dir.q},${pos.r + dir.r}`;
    const cell = board[key];
    if (cell && cell !== 'vazia') count++;
  }
  return count;
}

function distanceToCenter(pos: Posicao): number {
  return Math.abs(pos.q) + Math.abs(pos.r) + Math.abs(pos.q + pos.r);
}

function rankEmptyCells(board: Record<string, Celula>): Posicao[] {
  return POSITIONS
    .filter((pos) => board[posToKey(pos)] === 'vazia')
    .sort((a, b) => {
      const frontierDiff = countAdjacentOccupied(board, b) - countAdjacentOccupied(board, a);
      if (frontierDiff !== 0) return frontierDiff;
      return distanceToCenter(a) - distanceToCenter(b);
    });
}

function buildCandidateMoves(state: ProdutoState, difficulty: AIDifficulty): JogadaDupla[] {
  const tuning = TUNING[difficulty];
  const empties = rankEmptyCells(state.tabuleiro).slice(0, tuning.topCells);
  const { own, opponent } = getColorsForPlayer(state);
  const colorPairs: Array<readonly ['preta' | 'branca', 'preta' | 'branca']> = [
    [own, own],
    [own, opponent],
    [opponent, own],
    [opponent, opponent],
  ];

  if (state.primeiraJogada) {
    return empties.slice(0, tuning.topCells).flatMap((pos) => [
      { pos1: pos, cor1: own, pos2: null, cor2: null },
      { pos1: pos, cor1: opponent, pos2: null, cor2: null },
    ]);
  }

  const candidates: JogadaDupla[] = [];
  for (let i = 0; i < empties.length; i++) {
    const pos1 = empties[i];
    if (!pos1) continue;
    for (let j = i + 1; j < empties.length; j++) {
      const pos2 = empties[j];
      if (!pos2) continue;
      for (const [cor1, cor2] of colorPairs) {
        candidates.push({ pos1, cor1, pos2, cor2 });
        if (candidates.length >= tuning.maxCandidates) {
          return candidates;
        }
      }
    }
  }
  return candidates;
}

function scoreBoard(board: Record<string, Celula>, state: ProdutoState): number {
  const { own, opponent } = getColorsForPlayer(state);
  const ownScore = calcularPontuacao(board, own);
  const opponentScore = calcularPontuacao(board, opponent);
  const ownGroups = encontrarGrupos(board, own);
  const opponentGroups = encontrarGrupos(board, opponent);

  let score = ownScore.produto * 1.2 - opponentScore.produto * 1.45;

  if (ownGroups.length < 2) score -= 220;
  if (opponentGroups.length < 2 && opponentScore.totalPecas > 0) score += 240;

  if (ownScore.maiorGrupo > 0 && ownScore.segundoMaiorGrupo > 0) {
    const balance =
      Math.min(ownScore.maiorGrupo, ownScore.segundoMaiorGrupo) /
      Math.max(ownScore.maiorGrupo, ownScore.segundoMaiorGrupo);
    score += balance * 80;
  }

  if (opponentGroups.length >= 2) {
    score -= Math.abs(opponentScore.maiorGrupo - opponentScore.segundoMaiorGrupo) * 4;
  }

  score -= ownScore.totalPecas * 0.12;
  score += opponentScore.totalPecas * 0.08;

  return score;
}

function togglePlayer(state: ProdutoState, board: Record<string, Celula>): ProdutoState {
  return {
    ...state,
    tabuleiro: board,
    jogadorAtual: state.jogadorAtual === 'jogador1' ? 'jogador2' : 'jogador1',
    primeiraJogada: false,
    pontuacaoPretas: calcularPontuacao(board, 'preta'),
    pontuacaoBrancas: calcularPontuacao(board, 'branca'),
    jogadaEmCurso: { pos1: null, cor1: null },
    casasVazias: POSITIONS.filter((pos) => board[posToKey(pos)] === 'vazia'),
  };
}

function scoreMove(move: JogadaDupla, state: ProdutoState, difficulty: AIDifficulty): number {
  const board = applyMove(state.tabuleiro, move);
  let score = scoreBoard(board, state);
  const tuning = TUNING[difficulty];

  if (state.primeiraJogada) {
    score += Math.max(0, 20 - distanceToCenter(move.pos1) * 4);
  } else {
    score += countAdjacentOccupied(state.tabuleiro, move.pos1) * 4;
    if (move.pos2) score += countAdjacentOccupied(state.tabuleiro, move.pos2) * 4;
  }

  if (!tuning.lookahead) {
    return score;
  }

  const replyState = togglePlayer(state, board);
  const replyMoves = buildCandidateMoves(replyState, difficulty).slice(0, tuning.responseCandidates);
  if (replyMoves.length === 0) {
    return score + 400;
  }

  let bestReply = -Infinity;
  for (const reply of replyMoves) {
    const replyBoard = applyMove(replyState.tabuleiro, reply);
    const replyScore = -scoreBoard(replyBoard, replyState);
    if (replyScore > bestReply) bestReply = replyScore;
  }

  return score - bestReply * 0.8;
}

function makeRng(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0xffffffff;
  };
}

export function chooseFallbackMoveFromState(
  state: ProdutoState,
  difficulty: AIDifficulty,
  seed = Date.now(),
): JogadaDupla | null {
  const candidates = buildCandidateMoves(state, difficulty);
  if (candidates.length === 0) return null;

  const rng = makeRng(seed);
  const ranked = candidates
    .map((move) => ({ move, score: scoreMove(move, state, difficulty) }))
    .sort((a, b) => b.score - a.score);

  const topPool = ranked.slice(0, TUNING[difficulty].pickFromTop);
  const choice = topPool[Math.floor(rng() * topPool.length)] ?? ranked[0];
  return choice?.move ?? null;
}

function unpackState(packed: ProdutoPackedState): ProdutoState {
  const board: Record<string, Celula> = {};
  for (const pos of POSITIONS) {
    board[posToKey(pos)] = 'vazia';
  }

  for (let idx = 0; idx < POSITIONS.length; idx++) {
    const pos = POSITIONS[idx];
    if (!pos) continue;
    const key = posToKey(pos);
    const bit = idx < 32 ? 1 << idx : 1 << (idx - 32);
    const isBlack = idx < 32 ? (packed.blackLo & bit) !== 0 : (packed.blackHi & bit) !== 0;
    const isWhite = idx < 32 ? (packed.whiteLo & bit) !== 0 : (packed.whiteHi & bit) !== 0;
    if (isBlack) board[key] = 'preta';
    else if (isWhite) board[key] = 'branca';
  }

  return {
    tabuleiro: board,
    modo: 'vs-computador',
    jogadorAtual: packed.playerToMove === 0 ? 'jogador1' : 'jogador2',
    estado: 'a-jogar',
    primeiraJogada: packed.primeiraJogada,
    pontuacaoPretas: calcularPontuacao(board, 'preta'),
    pontuacaoBrancas: calcularPontuacao(board, 'branca'),
    jogadaEmCurso: { pos1: null, cor1: null },
    casasVazias: POSITIONS.filter((pos) => board[posToKey(pos)] === 'vazia'),
  };
}

export function packMove(move: JogadaDupla): ProdutoPackedMove | null {
  const posA = KEY_TO_INDEX.get(posToKey(move.pos1));
  if (posA === undefined) return null;

  const colorA = move.cor1 === 'preta' ? 0 : 1;
  if (!move.pos2 || !move.cor2) {
    return { posA, colorA, posB: -1, colorB: colorA };
  }

  const posB = KEY_TO_INDEX.get(posToKey(move.pos2));
  if (posB === undefined) return null;

  return {
    posA,
    colorA,
    posB,
    colorB: move.cor2 === 'preta' ? 0 : 1,
  };
}

export function chooseFallbackPackedMove(
  packed: ProdutoPackedState,
  difficulty: AIDifficulty,
  seed = Date.now(),
): ProdutoPackedMove | null {
  const move = chooseFallbackMoveFromState(unpackState(packed), difficulty, seed);
  return move ? packMove(move) : null;
}
