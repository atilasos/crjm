import type { AchievementDefinition, MissionDefinition } from './gamification';
import { PATTERN_CARDS, STARTER_ACHIEVEMENTS, STARTER_MISSIONS } from './gamification';
import type { GameId } from './types';

export interface GameProgressSnapshot {
  played: number;
  wins: number;
  reviews: number;
  rules: number;
  strategy: number;
  mastery: number;
}

export type PatternState = 'seen' | 'used_with_help' | 'used_alone' | 'mastered';
export type PatternEvidence = Exclude<PatternState, 'mastered'>;

export interface PatternProgress {
  state: PatternState;
  soloContextIds: string[];
  updatedAt: string;
}

export type GamificationEvent = {
  type: 'game_completed' | 'review_completed' | 'puzzle_solved';
  gameId: GameId;
  at: string;
  won?: boolean;
  puzzleId?: string;
  usedHint?: boolean;
};

export interface AchievementUnlock {
  unlockedAt: string;
}

export interface GamificationProfile {
  totalXp: number;
  sessionXp: number;
  streakDays: number;
  streakShieldWeeks: string[];
  lastActiveDate: string | null;
  achievements: Record<string, AchievementUnlock>;
  patterns: Record<string, PatternProgress>;
  missionClaims: Record<string, { claimedAt: string }>;
  solvedPuzzleIds: string[];
  gameProgress: Record<GameId, GameProgressSnapshot>;
  recentEvents: GamificationEvent[];
}

export interface MissionProgress extends MissionDefinition {
  progress: number;
  target: number;
  completed: boolean;
  claimed: boolean;
}

export interface AchievementPopupState {
  achievement: AchievementDefinition;
}

const GAME_IDS: GameId[] = ['gatos-caes', 'dominorio', 'quelhas', 'produto', 'atari-go', 'nex'];
const PATTERN_STATE_RANK: Record<PatternState, number> = {
  seen: 1,
  used_with_help: 2,
  used_alone: 3,
  mastered: 4,
};

function isIndependentPattern(progress: PatternProgress | undefined): boolean {
  return Boolean(progress && PATTERN_STATE_RANK[progress.state] >= PATTERN_STATE_RANK.used_alone);
}

function evidenceAchievementUnlocks(
  recentEvents: ReadonlyArray<GamificationEvent>,
  patterns: Readonly<Record<string, PatternProgress>>,
): Map<string, string> {
  const unlocks = new Map<string, string>();
  const lostGames = new Set<GameId>();

  for (const event of recentEvents) {
    if (event.type === 'game_completed') {
      if (event.won && lostGames.has(event.gameId)) unlocks.set('comeback_win', event.at);
      if (!event.won) lostGames.add(event.gameId);
    }
    if (event.type === 'puzzle_solved' && event.usedHint === false) {
      unlocks.set('explain_move', event.at);
    }
    if (event.type === 'puzzle_solved' && event.usedHint === true) {
      unlocks.set('after_hint_recovery', event.at);
    }
  }

  for (const progress of Object.values(patterns)) {
    if (isIndependentPattern(progress)) unlocks.set('top3_move', progress.updatedAt);
    if (progress.state === 'mastered') unlocks.set('improvement_streak', progress.updatedAt);
  }

  return unlocks;
}

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
    streakShieldWeeks: [],
    lastActiveDate: null,
    achievements: {},
    patterns: {},
    missionClaims: {},
    solvedPuzzleIds: [],
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
    streakShieldWeeks: Array.isArray(profile.streakShieldWeeks)
      ? [...new Set(profile.streakShieldWeeks.filter((item): item is string => typeof item === 'string'))].slice(-52)
      : [],
    lastActiveDate: typeof profile.lastActiveDate === 'string' ? profile.lastActiveDate : null,
    achievements: typeof profile.achievements === 'object' && profile.achievements ? profile.achievements : {},
    patterns: typeof profile.patterns === 'object' && profile.patterns ? profile.patterns : {},
    missionClaims: typeof profile.missionClaims === 'object' && profile.missionClaims ? profile.missionClaims : {},
    solvedPuzzleIds: Array.isArray(profile.solvedPuzzleIds)
      ? [...new Set(profile.solvedPuzzleIds.filter((item): item is string => typeof item === 'string'))]
      : [],
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

export function hydrateProfileFromSnapshot(
  input: Pick<GamificationProfile, 'totalXp' | 'streakDays' | 'lastActiveDate' | 'gameProgress' | 'recentEvents'> &
    Partial<Pick<GamificationProfile, 'patterns' | 'missionClaims' | 'solvedPuzzleIds' | 'streakShieldWeeks'>>,
): GamificationProfile {
  const profile = sanitizeProfile({
    totalXp: input.totalXp,
    sessionXp: 0,
    streakDays: input.streakDays,
    lastActiveDate: input.lastActiveDate,
    gameProgress: input.gameProgress,
    recentEvents: input.recentEvents,
    patterns: input.patterns,
    missionClaims: input.missionClaims,
    solvedPuzzleIds: input.solvedPuzzleIds,
    streakShieldWeeks: input.streakShieldWeeks,
  });
  profile.achievements = deriveAchievementUnlocks({
    gameProgress: profile.gameProgress,
    recentEvents: profile.recentEvents,
    lastActiveDate: profile.lastActiveDate,
    streakDays: profile.streakDays,
    patterns: profile.patterns,
  });
  return profile;
}

export function deriveAchievementUnlocks(
  input: Pick<GamificationProfile, 'gameProgress' | 'recentEvents' | 'lastActiveDate'> &
    Partial<Pick<GamificationProfile, 'patterns' | 'streakDays'>>,
): Record<string, AchievementUnlock> {
  const gameEvents = input.recentEvents.filter((event) => event.type === 'game_completed');
  const reviewEvents = input.recentEvents.filter((event) => event.type === 'review_completed');
  const puzzleEvents = input.recentEvents.filter((event) => event.type === 'puzzle_solved');
  const totalPlayed = Object.values(input.gameProgress).reduce((sum, progress) => sum + progress.played, 0);
  const totalWins = Object.values(input.gameProgress).reduce((sum, progress) => sum + progress.wins, 0);
  const totalReviews = Object.values(input.gameProgress).reduce((sum, progress) => sum + progress.reviews, 0);
  const fallbackDate = input.lastActiveDate ? `${input.lastActiveDate}T00:00:00.000Z` : new Date(0).toISOString();
  const achievementMap: Record<string, AchievementUnlock> = {};

  const maybeUnlock = (id: string, unlockedAt?: string | null) => {
    if (!achievementMap[id]) {
      achievementMap[id] = { unlockedAt: unlockedAt ?? fallbackDate };
    }
  };

  if (totalPlayed > 0 || gameEvents.length > 0) {
    maybeUnlock('first_game', gameEvents[0]?.at);
  }
  if (totalWins > 0 || gameEvents.some((event) => event.won)) {
    maybeUnlock('first_win', gameEvents.find((event) => event.won)?.at);
  }
  if (totalReviews > 0 || reviewEvents.length > 0) {
    maybeUnlock('first_review', reviewEvents[0]?.at);
  }
  if (totalReviews >= 3 || reviewEvents.length >= 3) {
    maybeUnlock('review_streak_3', reviewEvents[2]?.at ?? reviewEvents.at(-1)?.at);
  }
  if (puzzleEvents.length > 0) maybeUnlock('first_puzzle', puzzleEvents[0]?.at);
  if (totalPlayed >= 3) maybeUnlock('three_clean_games', gameEvents[2]?.at ?? gameEvents.at(-1)?.at);
  if ((input.streakDays ?? 0) >= 3) maybeUnlock('daily_streak_3');
  if ((input.streakDays ?? 0) >= 7) maybeUnlock('daily_streak_7');

  const patterns = input.patterns ?? {};
  if (Object.keys(patterns).length >= 5) maybeUnlock('pattern_collector_5');
  for (const [achievementId, unlockedAt] of evidenceAchievementUnlocks(input.recentEvents, patterns)) {
    maybeUnlock(achievementId, unlockedAt);
  }
  for (const [patternId, achievementId] of Object.entries(PATTERN_ACHIEVEMENTS)) {
    if (isIndependentPattern(patterns[patternId])) maybeUnlock(achievementId);
  }

  return achievementMap;
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

export function recordPuzzleSolved(
  profile: GamificationProfile,
  gameId: GameId,
  now: Date,
  evidence: { puzzleId?: string; usedHint?: boolean } = {},
): { profile: GamificationProfile; popups: AchievementPopupState[]; awarded: boolean } {
  if (evidence.puzzleId && profile.solvedPuzzleIds.includes(evidence.puzzleId)) {
    return { profile, popups: [], awarded: false };
  }
  const next = structuredClone(profile) as GamificationProfile;
  next.totalXp += 6;
  next.sessionXp += 6;
  next.recentEvents.push({
    type: 'puzzle_solved',
    gameId,
    at: now.toISOString(),
    puzzleId: evidence.puzzleId,
    usedHint: evidence.usedHint,
  });
  next.recentEvents = next.recentEvents.slice(-500);
  if (evidence.puzzleId) next.solvedPuzzleIds.push(evidence.puzzleId);
  updateStreak(next, now);

  const solvedForGame = next.recentEvents.filter(
    (event) => event.type === 'puzzle_solved' && event.gameId === gameId,
  ).length;
  next.gameProgress[gameId].strategy = Math.min(
    5,
    Math.max(next.gameProgress[gameId].strategy, Math.ceil(solvedForGame / 2)),
  );

  const popups = unlockAchievements(next, now);
  return { profile: next, popups, awarded: true };
}

export function recordPatternProgress(
  profile: GamificationProfile,
  input: {
    gameId: GameId;
    patternId: string;
    evidence: PatternEvidence;
    contextId: string;
    now: Date;
  },
): { profile: GamificationProfile; popups: AchievementPopupState[] } {
  const definition = PATTERN_CARDS.find(
    (pattern) => pattern.id === input.patternId && pattern.gameId === input.gameId,
  );
  if (!definition) return { profile, popups: [] };

  const next = structuredClone(profile) as GamificationProfile;
  const current = next.patterns[input.patternId];
  const soloContextIds = [...new Set(current?.soloContextIds ?? [])];
  if (input.evidence === 'used_alone' && !soloContextIds.includes(input.contextId)) {
    soloContextIds.push(input.contextId);
  }

  const candidate = soloContextIds.length >= 3 ? 'mastered' : input.evidence;
  const currentRank = current ? PATTERN_STATE_RANK[current.state] : 0;
  const nextState = PATTERN_STATE_RANK[candidate] > currentRank ? candidate : current?.state ?? candidate;
  next.patterns[input.patternId] = {
    state: nextState,
    soloContextIds,
    updatedAt: input.now.toISOString(),
  };

  if (PATTERN_STATE_RANK[nextState] > currentRank) {
    next.totalXp += 3;
    next.sessionXp += 3;
  }

  next.gameProgress[input.gameId].strategy = Math.min(
    5,
    Math.max(next.gameProgress[input.gameId].strategy, PATTERN_STATE_RANK[nextState]),
  );
  updateStreak(next, input.now);

  const popups = unlockAchievements(next, input.now);
  return { profile: next, popups };
}

export function claimMissionReward(
  profile: GamificationProfile,
  missionId: string,
  now: Date,
): { profile: GamificationProfile; popups: AchievementPopupState[]; claimed: boolean } {
  const mission = getMissionProgress(profile, now).find((item) => item.id === missionId);
  if (!mission?.completed) return { profile, popups: [], claimed: false };

  const claimKey = `${mission.id}:${missionPeriodKey(mission.frequency, now)}`;
  if (profile.missionClaims[claimKey]) return { profile, popups: [], claimed: false };

  const next = structuredClone(profile) as GamificationProfile;
  next.missionClaims[claimKey] = { claimedAt: now.toISOString() };
  next.totalXp += mission.rewardXp;
  next.sessionXp += mission.rewardXp;
  const popups = mission.frequency === 'weekly'
    ? unlockAchievementIds(next, now, ['weekly_mission'])
    : [];
  return { profile: next, popups, claimed: true };
}

export function rebuildProfileFromEvents(events: ReadonlyArray<GamificationEvent>): GamificationProfile {
  return events.reduce((profile, event) => {
    if (event.type === 'game_completed') {
      return recordGameCompletion(profile, event.gameId, {
        won: Boolean(event.won),
        now: new Date(event.at),
      }).profile;
    }
    if (event.type === 'review_completed') {
      return recordReviewCompletion(profile, event.gameId, new Date(event.at)).profile;
    }
    return recordPuzzleSolved(profile, event.gameId, new Date(event.at), {
      puzzleId: event.puzzleId,
      usedHint: event.usedHint,
    }).profile;
  }, createInitialProfile());
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
  const weekKey = missionPeriodKey('weekly', now);
  if (diffDays === 1) {
    profile.streakDays += 1;
  } else if (diffDays === 2 && !profile.streakShieldWeeks.includes(weekKey)) {
    profile.streakDays += 1;
    profile.streakShieldWeeks.push(weekKey);
    profile.streakShieldWeeks = profile.streakShieldWeeks.slice(-52);
  } else {
    profile.streakDays = 1;
  }
  profile.lastActiveDate = today;
}

function unlockAchievementIds(
  profile: GamificationProfile,
  now: Date,
  ids: ReadonlyArray<string>,
): AchievementPopupState[] {
  const unlocked: AchievementPopupState[] = [];
  for (const id of ids) {
    if (profile.achievements[id]) continue;
    const achievement = STARTER_ACHIEVEMENTS.find((item) => item.id === id);
    if (!achievement) continue;
    profile.achievements[id] = { unlockedAt: now.toISOString() };
    profile.totalXp += achievement.xp;
    profile.sessionXp += achievement.xp;
    unlocked.push({ achievement });
  }
  return unlocked;
}

function missionPeriodKey(frequency: MissionDefinition['frequency'], now: Date): string {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (frequency === 'daily') return date.toISOString().slice(0, 10);

  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return date.toISOString().slice(0, 10);
}

function unlockAchievements(profile: GamificationProfile, now: Date): AchievementPopupState[] {
  const allGames = profile.recentEvents.filter((event) => event.type === 'game_completed');
  const wins = allGames.filter((event) => event.won);
  const reviews = profile.recentEvents.filter((event) => event.type === 'review_completed');
  const puzzles = profile.recentEvents.filter((event) => event.type === 'puzzle_solved');
  const ids: string[] = [];

  if (allGames.length >= 1) ids.push('first_game');
  if (wins.length >= 1) ids.push('first_win');
  if (reviews.length >= 1) ids.push('first_review');
  if (reviews.length >= 3) ids.push('review_streak_3');
  if (puzzles.length >= 1) ids.push('first_puzzle');
  if (allGames.length >= 3) ids.push('three_clean_games');
  if (profile.streakDays >= 3) ids.push('daily_streak_3');
  if (profile.streakDays >= 7) ids.push('daily_streak_7');
  if (Object.keys(profile.patterns).length >= 5) ids.push('pattern_collector_5');
  ids.push(...evidenceAchievementUnlocks(profile.recentEvents, profile.patterns).keys());
  for (const [patternId, achievementId] of Object.entries(PATTERN_ACHIEVEMENTS)) {
    if (isIndependentPattern(profile.patterns[patternId])) ids.push(achievementId);
  }

  return unlockAchievementIds(profile, now, ids);
}

export function getMissionProgress(profile: GamificationProfile, now: Date): MissionProgress[] {
  const today = now.toISOString().slice(0, 10);
  const weekStart = new Date(`${missionPeriodKey('weekly', now)}T00:00:00.000Z`);
  const eventsToday = profile.recentEvents.filter((event) => event.at.slice(0, 10) === today);
  const recentWeek = profile.recentEvents.filter((event) => new Date(event.at) >= weekStart);
  const weeklyWinningGames = new Set(
    recentWeek.filter((event) => event.type === 'game_completed' && event.won).map((event) => event.gameId),
  );
  const weeklyPatterns = Object.values(profile.patterns).filter((progress) => new Date(progress.updatedAt) >= weekStart);

  return STARTER_MISSIONS.map((mission) => {
    let progress = 0;
    let target = 1;

    if (mission.id === 'daily-play-2') {
      progress = eventsToday.filter((event) => event.type === 'game_completed').length;
      target = 2;
    } else if (mission.id === 'daily-review-1') {
      progress = eventsToday.filter((event) => event.type === 'review_completed').length;
      target = 1;
    } else if (mission.id === 'daily-puzzle-2') {
      progress = eventsToday.filter((event) => event.type === 'puzzle_solved').length;
      target = 2;
    } else if (mission.id === 'daily-hints-2') {
      const activity = eventsToday.filter((event) => event.type === 'game_completed' || event.type === 'puzzle_solved').length;
      const hints = eventsToday.filter((event) => event.type === 'puzzle_solved' && event.usedHint).length;
      progress = activity > 0 && hints <= 2 ? 1 : 0;
      target = 1;
    } else if (mission.id === 'weekly-review-5') {
      progress = recentWeek.filter((event) => event.type === 'review_completed').length;
      target = 5;
    } else if (mission.id === 'weekly-two-game-wins') {
      progress = weeklyWinningGames.size;
      target = 2;
    } else if (mission.id === 'weekly-three-patterns') {
      progress = weeklyPatterns.length;
      target = 3;
    } else if (mission.id === 'weekly-strategy-up') {
      progress = weeklyPatterns.length > 0 ? 1 : 0;
      target = 1;
    }

    return {
      ...mission,
      progress,
      target,
      completed: progress >= target,
      claimed: Boolean(profile.missionClaims[`${mission.id}:${missionPeriodKey(mission.frequency, now)}`]),
    };
  });
}

const PATTERN_ACHIEVEMENTS: Record<string, string> = {
  'gatos-caes:centro': 'center_keeper',
  'gatos-caes:jogada-garantida': 'block_master',
  'dominorio:paridade': 'parity_guardian',
  'dominorio:corredor': 'last_move_master',
  'dominorio:espelhamento': 'opening_reader',
  'quelhas:misere-final': 'misere_mind',
  'quelhas:isolamento-forcado': 'endgame_architect',
  'produto:equilibrio': 'balanced_builder',
  'produto:fusao-adversaria': 'elegant_saboteur',
  'atari-go:atari': 'atari_hunter',
  'atari-go:double-atari': 'double_atari',
  'atari-go:ladder': 'ladder_spotter',
  'nex:ponte': 'bridge_builder',
  'nex:tripla-ameaca': 'triple_threat',
};
