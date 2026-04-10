import { STARTER_ACHIEVEMENTS } from '../../ai-core/gamification';
import type { GameId } from '../../ai-core/types';
import { sanitizeProfile, type AchievementPopupState, type GamificationProfile, type MissionProgress } from './gamification-state';
import type { LearnerCommandResponse, LearnerDashboardPayload } from '../../types/learner-core';

export interface GamificationBootstrapResult {
  profile: GamificationProfile;
  missions: MissionProgress[];
  importFingerprint: string | null;
  legacyImportConsumed: boolean;
}

function toClientProfile(payload: LearnerDashboardPayload, sessionXp = 0): GamificationProfile {
  return sanitizeProfile({
    displayName: payload.profile.displayName,
    locale: payload.profile.locale,
    cycleOrGrade: payload.profile.cycleOrGrade,
    totalXp: payload.profile.totalXp,
    sessionXp,
    streakDays: payload.profile.currentStreakDays,
    lastActiveDate: payload.profile.lastActiveOn,
    achievements: payload.achievements,
    gameProgress: payload.gameProgress,
    recentEvents: payload.recentEvents,
  });
}

interface FetchLike {
  (input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

async function fetchDashboard(fetchImpl: FetchLike): Promise<LearnerDashboardPayload> {
  const response = await fetchImpl('/api/learner/dashboard', { credentials: 'include' });
  if (!response.ok) {
    throw new Error(`dashboard bootstrap failed: ${response.status}`);
  }

  return (await response.json()) as LearnerDashboardPayload;
}

export async function bootstrapGamification(fetchImpl: FetchLike, localProfile: unknown): Promise<GamificationBootstrapResult> {
  await fetchImpl('/api/auth/session', { credentials: 'include' });

  let legacyImportConsumed = false;
  let payload = await fetchDashboard(fetchImpl);

  if (localProfile && payload.importFingerprint === null) {
    const importResponse = await fetchImpl('/api/learner/import-local-profile', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile: localProfile }),
    }).catch(() => undefined);

    legacyImportConsumed = Boolean(importResponse?.ok);
    if (legacyImportConsumed) {
      payload = await fetchDashboard(fetchImpl);
    } else if (importResponse && !importResponse.ok) {
      const refreshedPayload = await fetchDashboard(fetchImpl);
      if (refreshedPayload.importFingerprint !== null) {
        payload = refreshedPayload;
        legacyImportConsumed = true;
      }
    }
  } else if (localProfile && payload.importFingerprint !== null) {
    legacyImportConsumed = true;
  }

  return {
    profile: toClientProfile(payload, 0),
    missions: payload.missions,
    importFingerprint: payload.importFingerprint,
    legacyImportConsumed,
  };
}

function popupsFromUnlocks(ids: string[]): AchievementPopupState[] {
  return ids
    .map((id) => STARTER_ACHIEVEMENTS.find((achievement) => achievement.id === id))
    .filter((achievement): achievement is NonNullable<typeof achievement> => Boolean(achievement))
    .map((achievement) => ({ achievement }));
}

export async function postGameCompleted(fetchImpl: FetchLike, gameId: GameId, won: boolean): Promise<{ profile: GamificationProfile; missions: MissionProgress[]; popups: AchievementPopupState[]; sessionXpDelta: number }> {
  const response = await fetchImpl('/api/learner/events/game-completed', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gameId, won }),
  });
  if (!response.ok) {
    throw new Error(`game completion failed: ${response.status}`);
  }
  const payload = (await response.json()) as LearnerCommandResponse;
  return {
    profile: toClientProfile(payload.dashboard, payload.sessionXpDelta),
    missions: payload.dashboard.missions,
    popups: popupsFromUnlocks(payload.unlockedAchievementIds),
    sessionXpDelta: payload.sessionXpDelta,
  };
}

export async function postReviewCompleted(fetchImpl: FetchLike, gameId: GameId): Promise<{ profile: GamificationProfile; missions: MissionProgress[]; popups: AchievementPopupState[]; sessionXpDelta: number }> {
  const response = await fetchImpl('/api/learner/events/review-completed', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gameId }),
  });
  if (!response.ok) {
    throw new Error(`review completion failed: ${response.status}`);
  }
  const payload = (await response.json()) as LearnerCommandResponse;
  return {
    profile: toClientProfile(payload.dashboard, payload.sessionXpDelta),
    missions: payload.dashboard.missions,
    popups: popupsFromUnlocks(payload.unlockedAchievementIds),
    sessionXpDelta: payload.sessionXpDelta,
  };
}
