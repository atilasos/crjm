import { describe, expect, test } from 'bun:test';
import { criarEstadoInicial, isJogadaValida } from '../logic';
import { idxToPos } from './ai-client';
import { __internal, chooseFallbackMoveIndex } from './fallback-engine';

describe('Atari Go fallback engine', () => {
  test('devolve uma jogada legal quando o worker não está disponível', () => {
    const state = criarEstadoInicial('vs-computador');
    const move = chooseFallbackMoveIndex(state);

    expect(move).not.toBeNull();
    expect(isJogadaValida(state, idxToPos(move!))).toBe(true);
  });

  test('N1 e N5 têm políticas de pesquisa realmente distintas', () => {
    expect(__internal.policies[1].evalCap).toBeLessThan(__internal.policies[5].evalCap);
    expect(__internal.policies[1].blunderRate).toBeGreaterThan(__internal.policies[5].blunderRate);
    expect(__internal.policies[5].replyCap).toBeGreaterThan(0);
  });

  test('respeita um orçamento curto sem perder legalidade', () => {
    const state = criarEstadoInicial('vs-computador');
    const started = performance.now();
    const move = chooseFallbackMoveIndex(state, { level: 5, seed: 3, timeBudgetMs: 20 });

    expect(move).not.toBeNull();
    expect(isJogadaValida(state, idxToPos(move!))).toBe(true);
    expect(performance.now() - started).toBeLessThan(150);
  });
});
