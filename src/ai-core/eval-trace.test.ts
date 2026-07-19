import { describe, expect, test } from 'bun:test';
import { findTurningPoint, normalizeEngineScore } from './eval-trace';

describe('traço de avaliação (F4)', () => {
  test('normaliza para a perspetiva do humano em [-1, 1]', () => {
    // score positivo do MOTOR = vantagem da IA = desvantagem do humano
    expect(normalizeEngineScore(200)).toBeCloseTo(-Math.tanh(1), 5);
    expect(normalizeEngineScore(-200)).toBeCloseTo(Math.tanh(1), 5);
    expect(normalizeEngineScore(0)).toBe(-0);
    expect(normalizeEngineScore(100_000)).toBeCloseTo(-1, 3);
  });

  test('encontra a maior queda na perspetiva do humano', () => {
    const values = [0.4, 0.5, 0.1, 0.2, -0.6];
    const tp = findTurningPoint(values);
    expect(tp).toEqual({ turn: 4, drop: 0.2 - -0.6 });
  });

  test('sem queda relevante devolve null', () => {
    expect(findTurningPoint([0.1, 0.2, 0.3])).toBeNull();
    expect(findTurningPoint([0.5])).toBeNull();
    expect(findTurningPoint([0.5, 0.45], 0.15)).toBeNull();
  });
});
