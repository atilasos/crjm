import { describe, expect, test } from 'bun:test';
import type { GameId } from './types';
import { PUZZLES, evaluatePuzzleAnswer, getPuzzlesForGame } from './puzzles';
import { PATTERN_CARDS } from './gamification';

const GAME_IDS: GameId[] = ['gatos-caes', 'dominorio', 'quelhas', 'produto', 'atari-go', 'nex'];

describe('catálogo de puzzles estratégicos', () => {
  test('oferece três puzzles válidos por jogo', () => {
    expect(PUZZLES).toHaveLength(18);
    for (const gameId of GAME_IDS) {
      const puzzles = getPuzzlesForGame(gameId);
      expect(puzzles).toHaveLength(3);
      expect(new Set(puzzles.map((puzzle) => puzzle.id)).size).toBe(3);
      for (const puzzle of puzzles) {
        expect(puzzle.options).toHaveLength(3);
        expect(puzzle.options.some((option) => option.id === puzzle.correctOptionId)).toBe(true);
        expect(PATTERN_CARDS.some((card) => card.id === puzzle.patternId && card.gameId === gameId)).toBe(true);
      }
    }
  });

  test('devolve feedback explicativo para resposta certa e desconhecida', () => {
    const puzzle = PUZZLES[0]!;
    const correct = evaluatePuzzleAnswer(puzzle, puzzle.correctOptionId);
    const unknown = evaluatePuzzleAnswer(puzzle, 'missing');

    expect(correct.correct).toBe(true);
    expect(correct.explanation.length).toBeGreaterThan(20);
    expect(unknown).toEqual({
      correct: false,
      explanation: 'Escolhe uma das três opções antes de confirmar.',
    });
  });
});
