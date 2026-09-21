import { describe, expect, test } from 'bun:test';
import { buildIndexMaps } from './types';
import { gerarPosicoesValidas, posToKey } from '../types';
import type { Posicao } from '../types';

describe('Produto index maps', () => {
  test('preserves the generated array and visits all board positions in order', () => {
    const positions = gerarPosicoesValidas();
    const visited: Posicao[] = [];
    const result = buildIndexMaps(() => positions, pos => {
      visited.push(pos);
      return posToKey(pos);
    });
    expect(result.idxToPos).toBe(positions);
    expect(visited).toEqual(positions);
    expect([...result.keyToIdx]).toEqual(positions.map((pos, i) => [posToKey(pos), i]));
  });

  test('preserves empty input and the last index for duplicate keys', () => {
    expect(buildIndexMaps(() => [], posToKey).keyToIdx.size).toBe(0);
    const positions = [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 0, r: 0 }];
    expect([...buildIndexMaps(() => positions, posToKey).keyToIdx]).toEqual([
      ['0,0', 2], ['1,0', 1],
    ]);
  });

  test('observes positions appended by the key callback', () => {
    const positions = [{ q: 0, r: 0 }];
    const result = buildIndexMaps(() => positions, pos => {
      if (pos.q === 0) positions.push({ q: 1, r: 0 });
      return posToKey(pos);
    });
    expect([...result.keyToIdx]).toEqual([['0,0', 0], ['1,0', 1]]);
  });

  test('observes array truncation by the key callback', () => {
    const positions = [{ q: 0, r: 0 }, { q: 1, r: 0 }];
    const result = buildIndexMaps(() => positions, pos => {
      positions.length = 1;
      return posToKey(pos);
    });
    expect([...result.keyToIdx]).toEqual([['0,0', 0]]);
  });
});
