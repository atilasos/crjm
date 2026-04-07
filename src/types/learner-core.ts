import type { GameId } from '../ai-core/types';
import type {
  AchievementUnlock,
  GameProgressSnapshot,
  GamificationEvent,
  MissionProgress,
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
  eventType: 'game_completed' | 'review_completed';
  occurredAt: string;
  won: boolean | null;
  xpDelta: number;
}

export interface LearnerDashboardPayload {
  profile: LearnerProfileRecord;
  gameProgress: Record<GameId, GameProgressSnapshot>;
  achievements: Record<string, AchievementUnlock>;
  missions: MissionProgress[];
  recentEvents: GamificationEvent[];
  importFingerprint: string | null;
}

export interface LearnerCommandResponse {
  dashboard: LearnerDashboardPayload;
  sessionXpDelta: number;
  unlockedAchievementIds: string[];
}
