import { describe, expect, test } from 'bun:test';
import {
  DIFFICULTY_PROFILES,
  clampDifficultyLevel,
  clampDifficultyLevelForGame,
  getDifficultyProfile,
  getMaxDifficultyLevel,
} from './difficulty';

describe('dificuldade — nível 6 (Mestre) apenas no Atari Go', () => {
  test('perfil 6 existe com budget de 2000 ms', () => {
    expect(DIFFICULTY_PROFILES[6]).toMatchObject({
      level: 6,
      label: 'Mestre',
      timeBudgetMs: 2000,
    });
  });

  test('máximo por jogo: 6 no atari-go e quelhas, 5 nos restantes', () => {
    expect(getMaxDifficultyLevel('atari-go')).toBe(6);
    expect(getMaxDifficultyLevel('quelhas')).toBe(6);
    expect(getMaxDifficultyLevel('nex')).toBe(5);
    expect(getMaxDifficultyLevel()).toBe(5);
  });

  test('clamp clássico continua limitado a 5', () => {
    expect(clampDifficultyLevel(6)).toBe(5);
    expect(clampDifficultyLevel(99)).toBe(5);
    expect(clampDifficultyLevel(0)).toBe(1);
  });

  test('clamp por jogo permite 6 no atari-go e quelhas', () => {
    expect(clampDifficultyLevelForGame(6, 'atari-go')).toBe(6);
    expect(clampDifficultyLevelForGame(9, 'atari-go')).toBe(6);
    expect(clampDifficultyLevelForGame(6, 'quelhas')).toBe(6);
    expect(clampDifficultyLevelForGame(6, 'nex')).toBe(5);
    expect(clampDifficultyLevelForGame(6)).toBe(5);
  });

  test('getDifficultyProfile respeita o jogo', () => {
    expect(getDifficultyProfile(6, 'atari-go').level).toBe(6);
    expect(getDifficultyProfile(6).level).toBe(5);
    expect(getDifficultyProfile(6, 'produto').level).toBe(5);
  });
});
