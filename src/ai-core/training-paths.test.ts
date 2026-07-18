import { describe, expect, test } from 'bun:test';
import type { GameId } from './types';
import { TRAINING_PATHS, evaluateDesafioGoals } from './training-paths';
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

describe('avaliação dos desafios por nível', () => {
  const snapshot = (wins: number, played: number, bestWinStreak: number) => ({
    wins,
    played,
    bestWinStreak,
    currentWinStreak: 0,
  });

  test('sem objetivos ou sem dados devolve estado honesto', () => {
    expect(evaluateDesafioGoals(undefined, undefined)).toBeNull();
    const empty = evaluateDesafioGoals([{ level: 1, wins: 1 }], undefined);
    expect(empty?.done).toBe(false);
    expect(empty?.progress).toEqual(['N1+: 0/1 vitórias']);
  });

  test('vitórias em níveis superiores contam para objetivos inferiores', () => {
    const result = evaluateDesafioGoals(
      [{ level: 1, wins: 1 }],
      { 4: snapshot(2, 3, 1) },
    );
    expect(result?.done).toBe(true);
  });

  test('sequências e meta de 50% avaliam pelos contadores certos', () => {
    const levels = { 2: snapshot(3, 5, 2), 4: snapshot(2, 4, 1) };
    expect(evaluateDesafioGoals([{ level: 2, streak: 2 }], levels)?.done).toBe(true);
    expect(evaluateDesafioGoals([{ level: 2, streak: 3 }], levels)?.done).toBe(false);
    const half = evaluateDesafioGoals([{ level: 4, half: true }], levels);
    expect(half?.done).toBe(true);
    expect(half?.progress).toEqual(['N4+: 2 vitórias em 4 jogos (meta: ≥50% em ≥4)']);
    expect(evaluateDesafioGoals([{ level: 4, half: true }], { 4: snapshot(1, 3, 1) })?.done).toBe(false);
  });

  test('objetivos múltiplos exigem todos cumpridos', () => {
    const levels = { 3: snapshot(1, 1, 1) };
    expect(evaluateDesafioGoals([{ level: 3, wins: 1 }, { level: 4, wins: 1 }], levels)?.done).toBe(false);
    expect(
      evaluateDesafioGoals(
        [{ level: 3, wins: 1 }, { level: 4, wins: 1 }],
        { ...levels, 4: snapshot(1, 2, 1) },
      )?.done,
    ).toBe(true);
  });
});
