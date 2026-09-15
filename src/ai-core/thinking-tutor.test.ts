import { describe, expect, test } from 'bun:test';
import { advanceThinking, thinkingLevel, thinkingTurnKey } from './thinking-tutor';
import { criarEstadoInicial, colocarPeca, cancelarJogadaEmCurso } from '../games/produto/logic';

describe('requested tutor support', () => {
  test('a new turn never inherits revealed answers', () => {
    let state = { turn: 'a', level: 0 as const };
    const first = advanceThinking(state, 'a');
    const second = advanceThinking(first, 'a');
    const third = advanceThinking(second, 'a');
    expect([first.level, second.level, third.level]).toEqual([1, 2, 3]);
    expect(thinkingLevel(third, 'b')).toBe(0);
    expect(advanceThinking(third, 'b').level).toBe(1);
  });

  test('Produto preserves hint exposure through both placements and cancellation', () => {
    const opening = colocarPeca(criarEstadoInicial('vs-computador'), { q: 0, r: 0 }, 'preta');
    const first = colocarPeca(opening, { q: 1, r: 0 }, 'branca');
    const complete = colocarPeca(first, { q: 2, r: 0 }, 'branca');
    const key = thinkingTurnKey(opening, 'jogador2', 3);
    expect(thinkingTurnKey(first, 'jogador2', 3)).toBe(key);
    expect(thinkingTurnKey(cancelarJogadaEmCurso(first), 'jogador2', 3)).toBe(key);
    expect(thinkingTurnKey(complete, 'jogador2', 3)).not.toBe(key);
  });
});
