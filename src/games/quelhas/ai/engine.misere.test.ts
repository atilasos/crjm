import { describe, expect, test } from 'bun:test';
import { __internal, searchBestMove } from './engine';
import { DIFFICULTY_PRESETS } from './types';

type Celula = 'vazia' | 'ocupada';

function makeBoard(emptyIdxs: number[]): Celula[][] {
  const empty = new Set(emptyIdxs);
  const b: Celula[][] = [];
  for (let r = 0; r < 10; r++) {
    const row: Celula[] = [];
    for (let c = 0; c < 10; c++) {
      row.push(empty.has(r * 10 + c) ? 'vazia' : 'ocupada');
    }
    b.push(row);
  }
  return b;
}

describe('Quelhas AI (misère)', () => {
  test('os cinco níveis reduzem progressivamente os erros controlados', () => {
    expect(DIFFICULTY_PRESETS.beginner.selectionQuantile).toBeGreaterThan(DIFFICULTY_PRESETS.easy.selectionQuantile);
    expect(DIFFICULTY_PRESETS.easy.selectionQuantile).toBeGreaterThan(DIFFICULTY_PRESETS.medium.selectionQuantile);
    expect(DIFFICULTY_PRESETS.medium.selectionQuantile).toBeGreaterThan(DIFFICULTY_PRESETS.hard.selectionQuantile);
    expect(DIFFICULTY_PRESETS.hard.selectionQuantile).toBeGreaterThan(DIFFICULTY_PRESETS.master.selectionQuantile);
  });

  test('N1 não preserva a melhor variante numa posição com alternativas', () => {
    const board = makeBoard(Array.from({ length: 100 }, (_, index) => index));
    const best = searchBestMove(board, 'vertical', {
      timeBudgetMs: 20,
      maxDepth: 1,
      topN: 0,
      scoreDelta: 0,
      selectionQuantile: 0,
    });
    const beginner = searchBestMove(board, 'vertical', {
      timeBudgetMs: 20,
      maxDepth: 1,
      topN: 0,
      scoreDelta: 0,
      selectionQuantile: DIFFICULTY_PRESETS.beginner.selectionQuantile,
    });

    expect(beginner.bestMove).not.toEqual(best.bestMove);
  });

  test('mantém uma jogada legal mesmo quando o orçamento acaba antes da profundidade um', () => {
    const board = makeBoard(Array.from({ length: 100 }, (_, index) => index));
    const result = searchBestMove(board, 'vertical', {
      timeBudgetMs: 1,
      maxDepth: 5,
      topN: 0,
      scoreDelta: 0,
    });

    expect(result.bestMove).not.toBeNull();
  });

  test('rollout: se o adversário não tem jogadas, raiz perde', () => {
    // Estado com:
    // - vertical tem uma jogada em (4,5)-(5,5)
    // - horizontal tem uma jogada em (5,5)-(5,6)
    // Se vertical jogar (4,5)-(5,5), horizontal fica SEM jogadas e portanto GANHA (misère),
    // logo a raiz (vertical) PERDE.
    const board = makeBoard([0, 10, 45, 55, 56]);
    const occ0 = __internal.boardToOcc(board as any);

    const losingMove = __internal.encMove(45, 2, 0);
    const occAfter = __internal.applyMove(occ0, losingMove);

    const rootWins = __internal.rolloutWinForRoot(occAfter, 0, () => 0.5, 5);
    expect(rootWins).toBe(false);
  });
});
