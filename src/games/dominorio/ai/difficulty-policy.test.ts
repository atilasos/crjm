import { describe, expect, test } from 'bun:test';
import { selectDidacticBeginnerMove } from './difficulty-policy';

describe('Dominório beginner policy', () => {
  test('prefere uma jogada periférica e previsível no N1', () => {
    expect(selectDidacticBeginnerMove([27, 0, 18], 0)).toBe(0);
    expect(selectDidacticBeginnerMove([27, 0, 18], 1)).toBe(0);
  });
});
