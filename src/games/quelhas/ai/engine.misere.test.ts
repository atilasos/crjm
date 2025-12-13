import { describe, expect, test } from 'bun:test';
import { __internal } from './engine';

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

