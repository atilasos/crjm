import type { DifficultyLevel, GameId } from './types';

/**
 * Nível estendido: o 6 («Mestre», rede neuronal no servidor) só está
 * disponível nos jogos listados em MAX_DIFFICULTY_LEVEL_BY_GAME.
 * O contrato V1 (AIRequestV1.level) mantém-se em 1..5.
 */
export type ExtendedDifficultyLevel = DifficultyLevel | 6;

export interface DifficultyProfile {
  level: ExtendedDifficultyLevel;
  label: string;
  timeBudgetMs: number;
  searchIntensity: number;
  randomness: number;
  autoHintLevel: 'H0' | 'H1' | 'H2' | 'H3';
}

export const DIFFICULTY_PROFILES: Record<ExtendedDifficultyLevel, DifficultyProfile> = {
  1: {
    level: 1,
    label: 'Explorar',
    timeBudgetMs: 100,
    searchIntensity: 0.35,
    randomness: 0.3,
    autoHintLevel: 'H3',
  },
  2: {
    level: 2,
    label: 'Praticar',
    timeBudgetMs: 250,
    searchIntensity: 0.5,
    randomness: 0.22,
    autoHintLevel: 'H2',
  },
  3: {
    level: 3,
    label: 'Desafiar',
    timeBudgetMs: 500,
    searchIntensity: 0.7,
    randomness: 0.12,
    autoHintLevel: 'H2',
  },
  4: {
    level: 4,
    label: 'Competir',
    timeBudgetMs: 1000,
    searchIntensity: 0.88,
    randomness: 0.05,
    autoHintLevel: 'H1',
  },
  5: {
    level: 5,
    label: 'Dominar',
    timeBudgetMs: 2000,
    searchIntensity: 1,
    randomness: 0,
    autoHintLevel: 'H1',
  },
  6: {
    level: 6,
    label: 'Mestre',
    timeBudgetMs: 2000,
    searchIntensity: 1,
    randomness: 0,
    autoHintLevel: 'H1',
  },
};

export const DEFAULT_MAX_DIFFICULTY_LEVEL: ExtendedDifficultyLevel = 5;

/** Máximo por jogo — só o Atari Go expõe o nível 6 (IA no servidor). */
export const MAX_DIFFICULTY_LEVEL_BY_GAME: Partial<Record<GameId, ExtendedDifficultyLevel>> = {
  'atari-go': 6,
  quelhas: 6,
};

export function getMaxDifficultyLevel(gameId?: GameId): ExtendedDifficultyLevel {
  return (gameId && MAX_DIFFICULTY_LEVEL_BY_GAME[gameId]) || DEFAULT_MAX_DIFFICULTY_LEVEL;
}

export function clampDifficultyLevel(level: number): DifficultyLevel {
  const safe = Math.trunc(level);
  if (safe <= 1) return 1;
  if (safe >= 5) return 5;
  return safe as DifficultyLevel;
}

export function clampDifficultyLevelForGame(
  level: number,
  gameId?: GameId,
): ExtendedDifficultyLevel {
  const max = getMaxDifficultyLevel(gameId);
  const safe = Math.trunc(level);
  if (safe <= 1) return 1;
  if (safe >= max) return max;
  return safe as ExtendedDifficultyLevel;
}

export function getDifficultyProfile(
  level: number | ExtendedDifficultyLevel,
  gameId?: GameId,
): DifficultyProfile {
  return DIFFICULTY_PROFILES[clampDifficultyLevelForGame(level, gameId)];
}

export function withDifficultyOverrides(
  level: number | ExtendedDifficultyLevel,
  overrides: Partial<Omit<DifficultyProfile, 'level'>>,
): DifficultyProfile {
  const base = getDifficultyProfile(level);
  return {
    ...base,
    ...overrides,
    level: base.level,
  };
}
