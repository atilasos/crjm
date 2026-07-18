import type { GameId } from '../ai-core/types';
import type {
  AchievementUnlock,
  GameProgressSnapshot,
  GamificationEvent,
  MissionProgress,
  PatternProgress,
} from '../components/gamification/gamification-state';

export interface LearnerProfileRecord {
  userId: string;
  displayName: string;
  locale: 'pt-PT';
  cycleOrGrade: string | null;
  totalXp: number;
  currentStreakDays: number;
  lastActiveOn: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LearnerGameProgressRecord {
  userId: string;
  gameId: GameId;
  playedCount: number;
  winCount: number;
  reviewCount: number;
  rulesLevel: number;
  strategyLevel: number;
  masteryLevel: number;
  lastPlayedAt: string | null;
  updatedAt: string;
}

export interface LearnerActivityEventRecord {
  id: string;
  userId: string;
  gameId: GameId;
  eventType: 'game_completed' | 'review_completed' | 'puzzle_solved';
  occurredAt: string;
  won: boolean | null;
  xpDelta: number;
}

export interface LevelProgressSnapshot {
  played: number;
  wins: number;
  currentWinStreak: number;
  bestWinStreak: number;
}

/** Progresso por nível de dificuldade: gameId → nível (1..6) → contadores. */
export type LevelProgressByGame = Partial<Record<GameId, Record<number, LevelProgressSnapshot>>>;

export interface LearnerDashboardPayload {
  profile: LearnerProfileRecord;
  gameProgress: Record<GameId, GameProgressSnapshot>;
  levelProgress: LevelProgressByGame;
  achievements: Record<string, AchievementUnlock>;
  patterns: Record<string, PatternProgress>;
  missionClaims: Record<string, { claimedAt: string }>;
  solvedPuzzleIds: string[];
  streakShieldWeeks: string[];
  missions: MissionProgress[];
  recentEvents: GamificationEvent[];
  importFingerprint: string | null;
}

export interface LearnerCommandResponse {
  dashboard: LearnerDashboardPayload;
  sessionXpDelta: number;
  unlockedAchievementIds: string[];
}
