import { describe, expect, test } from 'bun:test';
import { getGamesFor, isGameAvailable, isIntegrationPreview, type GameDefinition } from './catalog';

describe('seleção de jogos por percurso', () => {
  test.each(['faisca', 'y'] as const)('%s disponibiliza todos os modos da edição atual', gameId => {
    expect(getGamesFor('local', true).find(game => game.id === gameId)?.capabilities).toEqual(['local', 'ai', 'tutor', 'review', 'puzzles', 'training', 'strategy', 'progress', 'tournament']);
    expect(getGamesFor('progress', true).some(game => game.id === gameId)).toBe(true);
    for (const capability of ['ai', 'tutor', 'review', 'puzzles', 'training', 'strategy', 'tournament'] as const) {
      expect(getGamesFor(capability, true).some(game => game.id === gameId)).toBe(true);
    }
  });
  test('apresenta os seis jogos do 11.º CRJM em todos os percursos atuais', () => {
    for (const capability of ['local', 'puzzles', 'training', 'strategy', 'tournament', 'progress'] as const) {
      expect(getGamesFor(capability).map(game => game.id)).toEqual([
        'dominorio', 'quelhas', 'produto', 'atari-go', 'faisca', 'y',
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
