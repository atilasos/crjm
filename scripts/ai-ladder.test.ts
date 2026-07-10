import { describe, expect, test } from 'bun:test';
import { getPairThreshold, summarizePair } from './ai-ladder';

describe('ai-ladder helpers', () => {
  test('usa os gates distintos das duas famílias', () => {
    expect(getPairThreshold('gatos-caes', 2, 1)).toBe(0.6);
    expect(getPairThreshold('dominorio', 5, 4)).toBe(0.54);
    expect(getPairThreshold('nex', 2, 1)).toBe(0.62);
    expect(getPairThreshold('atari-go', 5, 4)).toBe(0.55);
  });

  test('não classifica como monotónico um par abaixo do gate', () => {
    const summary = summarizePair('nex', 3, 2, [
      { winner: 'stronger', illegalMoves: 0 },
      { winner: 'weaker', illegalMoves: 0 },
    ]);

    expect(summary.score).toBe(0.5);
    expect(summary.monotonic).toBe(false);
    expect(summary.pass).toBe(false);
  });

  test('ilegalidade bloqueia o par mesmo com vitórias suficientes', () => {
    const summary = summarizePair('dominorio', 2, 1, [
      { winner: 'stronger', illegalMoves: 1 },
      { winner: 'stronger', illegalMoves: 0 },
    ]);
    expect(summary.score).toBe(1);
    expect(summary.pass).toBe(false);
  });
});
