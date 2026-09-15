import { describe, expect, test } from 'bun:test';
import { calcularIntervalosJogadas, calcularJogadasValidas, parseTabuleiroASCII } from '../logic';
import { __internal, analyzeTurnCounts, searchBestMove, trySolveEndgameMove } from './engine';

// Two independent strips. Vertical can finish in one move (or stretch to five),
// horizontal in one (or four). Vertical wins by exhausting its strip now.
const independentStrips = () => parseTabuleiroASCII([
  '.#########',
  '.#########',
  '.#########',
  '.#########',
  '.#........',
  '.#########',
  '.#########',
  '.#########',
  '.#########',
  '.#########',
].join('\n'));

describe('Quelhas: count future turns, then control the last move', () => {
  test('counts turns rather than overlapping legal placements', () => {
    expect(calcularIntervalosJogadas(independentStrips(), 'vertical', 'horizontal')).toEqual({
      minJogadasIA: 1,
      maxJogadasIA: 5,
      minJogadasAdversario: 1,
      maxJogadasAdversario: 4,
    });
  });

  test('even a one-ply search takes the immediate forced win with a long segment', () => {
    const board = independentStrips();
    const result = searchBestMove(board, 'vertical', {
      timeBudgetMs: 100,
      maxDepth: 1,
      topN: 0,
      scoreDelta: 0,
    });
    expect(result.bestMove).not.toBeNull();
    const move = result.bestMove!;
    for (let offset = 0; offset < move.comprimento; offset++) {
      board[move.inicio.linha + offset]![move.inicio.coluna] = 'ocupada';
    }
    expect(calcularJogadasValidas(board, 'horizontal').length).toBeGreaterThan(0);
    expect(calcularJogadasValidas(board, 'vertical')).toHaveLength(0);
  });
});

// A separate rules oracle: straight segments on a 3x3 corner, represented by
// their cells. It neither calls the search move generator nor its evaluator.
function legalMasks(empty: number, side: 0 | 1): number[] {
  const moves: number[] = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    let mask = 0;
    for (let offset = 0; offset < 3; offset++) {
      const rr = side === 0 ? r + offset : r;
      const cc = side === 1 ? c + offset : c;
      if (rr >= 3 || cc >= 3) break;
      const cell = 1 << (rr * 3 + cc);
      if (!(empty & cell)) break;
      mask |= cell;
      if (offset >= 1) moves.push(mask);
    }
  }
  return moves;
}

test('TS search and tempo proofs preserve every winning 3x3 endgame', () => {
  const memo = new Map<number, boolean>();
  function win(empty: number, side: 0 | 1): boolean {
    const key = empty * 2 + side;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;
    const moves = legalMasks(empty, side);
    const result = moves.length === 0 || moves.some(move => !win(empty & ~move, side === 0 ? 1 : 0));
    memo.set(key, result);
    return result;
  }
  for (let empty = 0; empty < 512; empty++) {
    const board = parseTabuleiroASCII(Array.from({ length: 10 }, (_, r) =>
      Array.from({ length: 10 }, (_, c) => r < 3 && c < 3 && (empty & (1 << (r * 3 + c))) ? '.' : '#').join('')).join('\n'));
    const counts = analyzeTurnCounts(board);
    for (const side of [0, 1] as const) {
      const expected = win(empty, side);
      const proven = side === 0 ? __internal.tempoOutcome(counts.vertical, counts.horizontal) : __internal.tempoOutcome(counts.horizontal, counts.vertical);
      if (proven !== null) expect(proven).toBe(expected);
      if (legalMasks(empty, side).length === 0) continue;
      const result = searchBestMove(board, side === 0 ? 'vertical' : 'horizontal', {
        timeBudgetMs: 50, maxDepth: 6, topN: 0, scoreDelta: 0,
      });
      expect(result.bestMove).not.toBeNull();
      const move = result.bestMove!;
      let mask = 0;
      for (let k = 0; k < move.comprimento; k++) {
        const r = move.inicio.linha + (side === 0 ? k : 0);
        const c = move.inicio.coluna + (side === 1 ? k : 0);
        mask |= 1 << (r * 3 + c);
      }
      expect(legalMasks(empty, side)).toContain(mask);
      if (expected) expect(win(empty & ~mask, side === 0 ? 1 : 0)).toBe(false);
    }
  }
});

test('the exact solver counts turns even when a long strip offers 45 overlapping placements', () => {
  const result = trySolveEndgameMove(independentStrips(), 'vertical');
  expect(result?.comprimento).toBeGreaterThanOrEqual(8);
});
