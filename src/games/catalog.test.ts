import { describe, expect, test } from 'bun:test';
import { getGamesFor, isGameAvailable, isIntegrationPreview, type GameDefinition } from './catalog';

describe('seleção de jogos por percurso', () => {
  test.each(['faisca', 'y'] as const)('%s disponibiliza apenas capacidades implementadas na integração', gameId => {
    expect(getGamesFor('local', true).find(game => game.id === gameId)?.capabilities).toEqual(['local', 'ai', 'tutor', 'review', 'puzzles', 'training', 'strategy', 'progress']);
    expect(getGamesFor('progress', true).some(game => game.id === gameId)).toBe(true);
    for (const capability of ['ai', 'tutor', 'review', 'puzzles', 'training', 'strategy', 'tournament'] as const) {
      expect(getGamesFor(capability, true).some(game => game.id === gameId)).toBe(capability === 'ai' || capability === 'tutor' || capability === 'review'
        || ['puzzles', 'training', 'strategy'].includes(capability));
    }
  });
  test('mantém os seis jogos públicos em todos os percursos atuais', () => {
    for (const capability of ['local', 'puzzles', 'training', 'strategy', 'tournament', 'progress'] as const) {
      expect(getGamesFor(capability).map(game => game.id)).toEqual([
        'gatos-caes', 'dominorio', 'quelhas', 'produto', 'atari-go', 'nex',
      ]);
    }
  });

  test('um percurso em integração só é visível na pré-visualização explícita', () => {
    const game: GameDefinition = {
      id: 'jogo-em-integracao', name: 'Jogo em integração', description: '', accent: '', mark: '',
      cycles: [], selection: 'integration', capabilities: ['local'],
    };
    expect(isGameAvailable(game, 'local')).toBe(false);
    expect(isGameAvailable(game, 'local', isIntegrationPreview('?integracao=1'))).toBe(true);
    for (const capability of ['ai', 'tutor', 'review', 'puzzles', 'training', 'strategy', 'tournament'] as const) {
      expect(isGameAvailable(game, capability, true)).toBe(false);
    }
    expect(isIntegrationPreview('')).toBe(false);
    expect(isIntegrationPreview('?integracao=0')).toBe(false);
    expect(getGamesFor('local').map(game => game.id)).not.toContain(game.id);
  });
});
