import { describe, expect, test } from 'bun:test';
import type { GameId } from './types';
import { PUZZLES, evaluatePuzzleAnswer, getDisplayOptions, getPuzzlesForGame } from './puzzles';
import { PATTERN_CARDS } from './gamification';

const GAME_IDS: GameId[] = ['gatos-caes', 'dominorio', 'quelhas', 'produto', 'atari-go', 'nex'];

describe('catálogo de puzzles estratégicos', () => {
  test('oferece seis puzzles válidos por jogo', () => {
    expect(PUZZLES).toHaveLength(36);
    for (const gameId of GAME_IDS) {
      const puzzles = getPuzzlesForGame(gameId);
      expect(puzzles).toHaveLength(6);
      expect(new Set(puzzles.map((puzzle) => puzzle.id)).size).toBe(6);
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

describe('apresentação dos puzzles', () => {
  test('o baralhamento preserva as três opções e cobre todas as posições', () => {
    for (const puzzle of PUZZLES) {
      const positions = new Set<number>();
      for (let trial = 0; trial < 60; trial += 1) {
        const display = getDisplayOptions(puzzle);
        expect(new Set(display.map((option) => option.id)).size).toBe(3);
        positions.add(display.findIndex((option) => option.id === puzzle.correctOptionId));
      }
      // P(uma posição nunca sair em 60 tentativas) ≈ 3×(2/3)^60 < 1e-10.
      expect([...positions].sort()).toEqual([0, 1, 2]);
    }
  });

  test('a ordem é reproduzível quando o gerador aleatório é injetado', () => {
    const seeded = () => {
      let state = 42;
      return () => {
        state = (state * 1664525 + 1013904223) % 4294967296;
        return state / 4294967296;
      };
    };
    for (const puzzle of PUZZLES) {
      expect(getDisplayOptions(puzzle, seeded()).map((option) => option.id)).toEqual(
        getDisplayOptions(puzzle, seeded()).map((option) => option.id),
      );
    }
  });

  test('os diagramas são retangulares e usam apenas símbolos conhecidos', () => {
    const allowed = new Set(['.', 'X', 'O', 'N', '*', '#']);
    const withDiagram = PUZZLES.filter((puzzle) => puzzle.diagram);
    expect(withDiagram.length).toBeGreaterThanOrEqual(10);
    for (const puzzle of withDiagram) {
      const rows = puzzle.diagram!.rows;
      expect(rows.length).toBeGreaterThan(0);
      const width = rows[0]!.length;
      for (const row of rows) {
        expect(row.length).toBe(width);
        for (const symbol of row) {
          expect(allowed.has(symbol)).toBe(true);
        }
      }
      expect(puzzle.diagram!.caption.length).toBeGreaterThan(20);
    }
  });
});
