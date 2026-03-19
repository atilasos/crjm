import type { DifficultyLevel } from './types';

export interface DifficultyProfile {
  level: DifficultyLevel;
  label: string;
  timeBudgetMs: number;
  searchIntensity: number;
  randomness: number;
  autoHintLevel: 'H0' | 'H1' | 'H2' | 'H3';
}

export const DIFFICULTY_PROFILES: Record<DifficultyLevel, DifficultyProfile> = {
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
};

export function clampDifficultyLevel(level: number): DifficultyLevel {
  const safe = Math.trunc(level);
  if (safe <= 1) return 1;
  if (safe >= 5) return 5;
  return safe as DifficultyLevel;
}

export function getDifficultyProfile(level: number | DifficultyLevel): DifficultyProfile {
  return DIFFICULTY_PROFILES[clampDifficultyLevel(level)];
}

export function withDifficultyOverrides(
  level: number | DifficultyLevel,
  overrides: Partial<Omit<DifficultyProfile, 'level'>>,
): DifficultyProfile {
  const base = getDifficultyProfile(level);
  return {
    ...base,
    ...overrides,
    level: base.level,
  };
}
