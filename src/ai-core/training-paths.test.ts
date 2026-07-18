import { describe, expect, test } from 'bun:test';
import type { GameId } from './types';
import { TRAINING_PATHS } from './training-paths';
import { getPuzzlesForGame } from './puzzles';

const GAME_IDS: GameId[] = ['gatos-caes', 'dominorio', 'quelhas', 'produto', 'atari-go', 'nex'];

describe('percursos de treino para o campeonato', () => {
  test('cada jogo tem quatro etapas com o desenho Descobrir→Campeonato', () => {
    for (const gameId of GAME_IDS) {
      const path = TRAINING_PATHS[gameId];
      expect(path.steps.map((step) => step.title)).toEqual([
        'Descobrir',
        'Táticas',
        'Estratégia',
        'Campeonato',
      ]);
      for (const step of path.steps) {
        expect(step.checkpoints.length).toBeGreaterThan(0);
        expect(step.desafio?.length ?? 0).toBeGreaterThan(10);
      }
    }
  });

  test('os puzzleIds das etapas existem e pertencem ao jogo certo, cobrindo todos os puzzles', () => {
    for (const gameId of GAME_IDS) {
      const puzzleIds = new Set(getPuzzlesForGame(gameId).map((puzzle) => puzzle.id));
      const referenced = TRAINING_PATHS[gameId].steps.flatMap((step) => step.puzzleIds ?? []);
      expect(new Set(referenced).size).toBe(referenced.length);
      for (const id of referenced) {
        expect(puzzleIds.has(id)).toBe(true);
      }
      expect(referenced.length).toBe(puzzleIds.size);
    }
  });
});
