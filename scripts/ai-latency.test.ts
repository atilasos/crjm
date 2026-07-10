import { describe, expect, test } from 'bun:test';
import { percentile, summarizeLevel } from './ai-latency';

describe('ai-latency helpers', () => {
  test('calcula percentis sem alterar as amostras', () => {
    const values = [40, 10, 30, 20];
    expect(percentile(values, 0.5)).toBe(20);
    expect(percentile(values, 0.95)).toBe(40);
    expect(values).toEqual([40, 10, 30, 20]);
  });

  test('falha o gate quando há ilegalidade ou excede 2×budget + 100ms', () => {
    expect(summarizeLevel(100, [90, 250], 0).pass).toBe(true);
    expect(summarizeLevel(100, [90, 301], 0).pass).toBe(false);
    expect(summarizeLevel(100, [90], 1).pass).toBe(false);
  });
});
