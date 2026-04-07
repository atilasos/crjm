import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { GameId } from '../../ai-core/types';
import type { AchievementDefinition } from '../../ai-core/gamification';
import {
  createInitialProfile,
  getLevelFromXp,
  getLevelTitle,
  getXpWindow,
  GAMIFICATION_STORAGE_KEY,
  type AchievementPopupState,
  type GamificationProfile,
  type MissionProgress,
} from './gamification-state';
import { bootstrapGamification, postGameCompleted, postReviewCompleted } from './backend-client';

interface GamificationContextValue {
  profile: GamificationProfile;
  level: number;
  levelTitle: string;
  xpWindow: { current: number; next: number };
  missions: MissionProgress[];
  activePopup: AchievementDefinition | null;
  isReady: boolean;
  recordGameCompleted: (gameId: GameId, won: boolean) => void;
  recordReviewCompleted: (gameId: GameId) => void;
  dismissPopup: () => void;
}

const GamificationContext = createContext<GamificationContextValue | null>(null);

function readLegacyProfile(): unknown | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(GAMIFICATION_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function clearLegacyProfile(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(GAMIFICATION_STORAGE_KEY);
}

export function GamificationProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<GamificationProfile>(() => createInitialProfile());
  const [missions, setMissions] = useState<MissionProgress[]>([]);
  const [queue, setQueue] = useState<AchievementPopupState[]>([]);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const legacyProfile = readLegacyProfile();
      try {
        const result = await bootstrapGamification(fetch, legacyProfile);
        if (cancelled) return;
        setProfile({ ...result.profile, sessionXp: 0 });
        setMissions(result.missions);
        if (legacyProfile) clearLegacyProfile();
      } catch {
        if (cancelled) return;
        setProfile(createInitialProfile());
        setMissions([]);
      } finally {
        if (!cancelled) setIsReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const applyCommandResult = useCallback((result: Awaited<ReturnType<typeof postGameCompleted>>) => {
    setProfile((current) => ({ ...result.profile, sessionXp: current.sessionXp + result.sessionXpDelta }));
    setQueue((prev) => [...prev, ...result.popups]);
    setMissions(result.missions);
  }, []);

  const recordGameCompletedHandler = useCallback((gameId: GameId, won: boolean) => {
    void postGameCompleted(fetch, gameId, won).then(applyCommandResult).catch(() => undefined);
  }, [applyCommandResult]);

  const recordReviewCompletedHandler = useCallback((gameId: GameId) => {
    void postReviewCompleted(fetch, gameId).then(applyCommandResult).catch(() => undefined);
  }, [applyCommandResult]);

  const dismissPopup = useCallback(() => {
    setQueue((prev) => prev.slice(1));
  }, []);

  const level = getLevelFromXp(profile.totalXp);
  const value = useMemo<GamificationContextValue>(
    () => ({
      profile,
      level,
      levelTitle: getLevelTitle(level),
      xpWindow: getXpWindow(profile.totalXp),
      missions,
      activePopup: queue[0]?.achievement ?? null,
      isReady,
      recordGameCompleted: recordGameCompletedHandler,
      recordReviewCompleted: recordReviewCompletedHandler,
      dismissPopup,
    }),
    [dismissPopup, isReady, level, missions, profile, queue, recordGameCompletedHandler, recordReviewCompletedHandler],
  );

  return <GamificationContext.Provider value={value}>{children}</GamificationContext.Provider>;
}

export function useGamification() {
  const context = useContext(GamificationContext);
  if (!context) {
    throw new Error('useGamification must be used inside GamificationProvider');
  }
  return context;
}
