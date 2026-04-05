import type { AchievementDefinition, MissionDefinition } from '../../ai-core/gamification';
import { STARTER_ACHIEVEMENTS, STARTER_MISSIONS } from '../../ai-core/gamification';
import type { GameId } from '../../ai-core/types';

export interface GameProgressSnapshot {
  played: number;
  wins: number;
  reviews: number;
  rules: number;
  strategy: number;
  mastery: number;
}

export interface GamificationEvent {
  type: 'game_completed' | 'review_completed';
  gameId: GameId;
  at: string;
  won?: boolean;
}

export interface AchievementUnlock {
  unlockedAt: string;
}

export interface GamificationProfile {
  totalXp: number;
  sessionXp: number;
  streakDays: number;
  lastActiveDate: string | null;
  achievements: Record<string, AchievementUnlock>;
  gameProgress: Record<GameId, GameProgressSnapshot>;
  recentEvents: GamificationEvent[];
}

export interface MissionProgress extends MissionDefinition {
  progress: number;
  target: number;
  completed: boolean;
}

export interface AchievementPopupState {
  achievement: AchievementDefinition;
}

export const GAMIFICATION_STORAGE_KEY = 'crjm.gamification.v1';

const GAME_IDS: GameId[] = ['gatos-caes', 'dominorio', 'quelhas', 'produto', 'atari-go', 'nex'];

function createGameProgress(): GameProgressSnapshot {
  return {
    played: 0,
    wins: 0,
    reviews: 0,
    rules: 0,
    strategy: 0,
    mastery: 0,
  };
}

export function createInitialProfile(): GamificationProfile {
  return {
    totalXp: 0,
    sessionXp: 0,
    streakDays: 0,
    lastActiveDate: null,
    achievements: {},
    gameProgress: {
      'gatos-caes': createGameProgress(),
      dominorio: createGameProgress(),
      quelhas: createGameProgress(),
      produto: createGameProgress(),
      'atari-go': createGameProgress(),
      nex: createGameProgress(),
    },
    recentEvents: [],
  };
}

export function sanitizeProfile(input: unknown): GamificationProfile {
  if (!input || typeof input !== 'object') return createInitialProfile();
  const profile = input as Partial<GamificationProfile>;
  const base = createInitialProfile();
  return {
    ...base,
    totalXp: typeof profile.totalXp === 'number' ? profile.totalXp : 0,
    sessionXp: typeof profile.sessionXp === 'number' ? profile.sessionXp : 0,
    streakDays: typeof profile.streakDays === 'number' ? profile.streakDays : 0,
    lastActiveDate: typeof profile.lastActiveDate === 'string' ? profile.lastActiveDate : null,
    achievements: typeof profile.achievements === 'object' && profile.achievements ? profile.achievements : {},
    gameProgress: GAME_IDS.reduce((acc, gameId) => {
      const maybe = profile.gameProgress?.[gameId];
      acc[gameId] = {
        ...createGameProgress(),
        ...(maybe ?? {}),
      };
      return acc;
    }, {} as Record<GameId, GameProgressSnapshot>),
    recentEvents: Array.isArray(profile.recentEvents) ? profile.recentEvents.slice(-500) : [],
  };
}

export function getLevelFromXp(totalXp: number): number {
  if (totalXp < 50) return 1;
  if (totalXp < 120) return 2;
  if (totalXp < 220) return 3;
  if (totalXp < 360) return 4;
  if (totalXp < 550) return 5;
  return 6 + Math.floor((totalXp - 550) / 250);
}

export function getLevelTitle(level: number): string {
  if (level <= 1) return 'Explorador';
  if (level === 2) return 'Aprendiz';
  if (level === 3) return 'Estratega';
  if (level === 4) return 'Desafiador';
  if (level === 5) return 'Campeão';
  return 'Mestre em Formação';
}

export function getXpWindow(totalXp: number): { current: number; next: number } {
  const level = getLevelFromXp(totalXp);
  if (level === 1) return { current: 0, next: 50 };
  if (level === 2) return { current: 50, next: 120 };
  if (level === 3) return { current: 120, next: 220 };
  if (level === 4) return { current: 220, next: 360 };
  if (level === 5) return { current: 360, next: 550 };
  const extra = level - 6;
  return { current: 550 + extra * 250, next: 550 + (extra + 1) * 250 };
}

export function recordGameCompletion(
  profile: GamificationProfile,
  gameId: GameId,
  opts: { won: boolean; now: Date },
): { profile: GamificationProfile; popups: AchievementPopupState[] } {
  const xpGain = 10 + (opts.won ? 8 : 0);
  const nowIso = opts.now.toISOString();
  const next = structuredClone(profile) as GamificationProfile;
  next.totalXp += xpGain;
  next.sessionXp += xpGain;
  next.recentEvents.push({ type: 'game_completed', gameId, at: nowIso, won: opts.won });
  next.recentEvents = next.recentEvents.slice(-500);
  updateStreak(next, opts.now);

  const game = next.gameProgress[gameId];
  game.played += 1;
  if (opts.won) game.wins += 1;
  game.rules = Math.min(5, Math.max(game.rules, Math.ceil(game.played / 2)));
  game.strategy = Math.min(5, Math.max(game.strategy, Math.ceil(game.wins / 2)));

  const popups = unlockAchievements(next, opts.now);
  return { profile: next, popups };
}

export function recordReviewCompletion(
  profile: GamificationProfile,
  gameId: GameId,
  now: Date,
): { profile: GamificationProfile; popups: AchievementPopupState[] } {
  const next = structuredClone(profile) as GamificationProfile;
  next.totalXp += 10;
  next.sessionXp += 10;
  next.recentEvents.push({ type: 'review_completed', gameId, at: now.toISOString() });
  next.recentEvents = next.recentEvents.slice(-500);
  updateStreak(next, now);

  const game = next.gameProgress[gameId];
  game.reviews += 1;
  game.mastery = Math.min(5, Math.max(game.mastery, Math.ceil(game.reviews / 2)));

  const popups = unlockAchievements(next, now);
  return { profile: next, popups };
}

function updateStreak(profile: GamificationProfile, now: Date): void {
  const today = now.toISOString().slice(0, 10);
  if (!profile.lastActiveDate) {
    profile.lastActiveDate = today;
    profile.streakDays = 1;
    return;
  }
  if (profile.lastActiveDate === today) return;

  const prev = new Date(`${profile.lastActiveDate}T00:00:00Z`);
  const curr = new Date(`${today}T00:00:00Z`);
  const diffDays = Math.round((curr.getTime() - prev.getTime()) / (24 * 60 * 60 * 1000));
  profile.streakDays = diffDays === 1 ? profile.streakDays + 1 : 1;
  profile.lastActiveDate = today;
}

function unlockAchievements(profile: GamificationProfile, now: Date): AchievementPopupState[] {
  const unlocked: AchievementPopupState[] = [];
  const allGames = profile.recentEvents.filter((event) => event.type === 'game_completed');
  const wins = allGames.filter((event) => event.won);
  const reviews = profile.recentEvents.filter((event) => event.type === 'review_completed');

  const maybeUnlock = (id: string) => {
    if (profile.achievements[id]) return;
    const achievement = STARTER_ACHIEVEMENTS.find((item) => item.id === id);
    if (!achievement) return;
    profile.achievements[id] = { unlockedAt: now.toISOString() };
    profile.totalXp += achievement.xp;
    profile.sessionXp += achievement.xp;
    unlocked.push({ achievement });
  };

  if (allGames.length >= 1) maybeUnlock('first_game');
  if (wins.length >= 1) maybeUnlock('first_win');
  if (reviews.length >= 1) maybeUnlock('first_review');
  if (reviews.length >= 3) maybeUnlock('review_streak_3');

  for (const achievement of STARTER_ACHIEVEMENTS) {
    if (!achievement.gameId || profile.achievements[achievement.id]) continue;
    const game = profile.gameProgress[achievement.gameId];
    if (!game) continue;
    if (achievement.id === 'atari_hunter' && game.wins >= 1) maybeUnlock(achievement.id);
    if (achievement.id === 'balanced_builder' && game.played >= 1) maybeUnlock(achievement.id);
    if (achievement.id === 'bridge_builder' && game.played >= 1) maybeUnlock(achievement.id);
  }

  return unlocked;
}

export function getMissionProgress(profile: GamificationProfile, now: Date): MissionProgress[] {
  const today = now.toISOString().slice(0, 10);
  const weekAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
  const eventsToday = profile.recentEvents.filter((event) => event.at.slice(0, 10) === today);
  const recentWeek = profile.recentEvents.filter((event) => new Date(event.at) >= weekAgo);
  const weeklyGames = new Set(recentWeek.filter((event) => event.type === 'game_completed').map((event) => event.gameId));

  return STARTER_MISSIONS.map((mission) => {
    let progress = 0;
    let target = 1;

    if (mission.id === 'daily-play-2') {
      progress = eventsToday.filter((event) => event.type === 'game_completed').length;
      target = 2;
    } else if (mission.id === 'daily-review-1') {
      progress = eventsToday.filter((event) => event.type === 'review_completed').length;
      target = 1;
    } else if (mission.id === 'weekly-three-games') {
      progress = weeklyGames.size;
      target = 3;
    } else if (mission.id === 'weekly-product-sabotage') {
      progress = recentWeek.some((event) => event.gameId === 'produto' && event.type === 'game_completed') ? 1 : 0;
      target = 1;
    }

    return {
      ...mission,
      progress,
      target,
      completed: progress >= target,
    };
  });
}
