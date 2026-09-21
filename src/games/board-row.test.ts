import { describe, expect, test } from 'bun:test';
import { boardRow } from './board-row';

describe('board row access', () => {
  test('retains row identity and permits ordinary cell reads and writes', () => {
    const row = ['vazia'];
    const board = [row];
    expect(boardRow(board, 0)).toBe(row);
    expect(boardRow(board, 0)[3]).toBeUndefined();
    boardRow(board, 0)[3] = 'ocupada';
    expect(row[3]).toBe('ocupada');
  });

  test('retains failure on short or sparse outer boards', () => {
    const sparse: string[][] = [];
    sparse.length = 2;
    for (const board of [[], sparse, [[]]]) {
      expect(() => boardRow(board, 1)[0]).toThrow(TypeError);
    }
    expect(boardRow([[]], 0)[0]).toBeUndefined();
  });
});
