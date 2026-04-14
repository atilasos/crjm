import { describe, expect, test } from 'bun:test';
import { buildTutorContextItems } from './tutor-context';
import type { AIResponseV1 } from './types';

describe('buildTutorContextItems', () => {
  test('emits confidence, engine, and threat chips when available', () => {
    const response: AIResponseV1<string> = {
      version: '1.0',
      requestId: 'r1',
      gameId: 'dominorio',
      mode: 'tutor',
      bestMove: 'a',
      topMoves: [{ move: 'a', rank: 1 }],
      explainText: 'texto',
      confidence: 0.82,
      criticalThreats: [
        {
          id: 't1',
          severity: 'high',
          title: 'ameaça',
          description: 'desc',
        },
      ],
      stats: {
        elapsedMs: 10,
        usedWasm: true,
        engine: 'rust-wasm',
      },
    };

    const items = buildTutorContextItems(response);
    expect(items.map((item) => item.label)).toContain('Análise WASM');
    expect(items.map((item) => item.label)).toContain('Ameaça crítica');
    expect(items.map((item) => item.label)).toContain('Plano forte');
    expect(items.map((item) => item.label)).toContain('Linha forçada');
  });

  test('prefers opening-book label over fallback chip', () => {
    const response: AIResponseV1<string> = {
      version: '1.0',
      requestId: 'r2',
      gameId: 'dominorio',
      mode: 'tutor',
      bestMove: 'a',
      topMoves: [{ move: 'a', rank: 1 }],
      explainText: 'texto',
      confidence: 0.5,
      explainTags: ['opening-book'],
      stats: {
        elapsedMs: 0,
        usedWasm: false,
        engine: 'ts-fallback',
      },
    };

    const items = buildTutorContextItems(response);
    expect(items.map((item) => item.label)).toContain('Livro de abertura');
    expect(items.map((item) => item.label)).not.toContain('Fallback TS');
  });
});
