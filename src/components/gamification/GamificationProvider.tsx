import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { GameId } from '../../ai-core/types';
import type { AchievementDefinition } from '../../ai-core/gamification';
import {
  createInitialProfile,
  GAMIFICATION_STORAGE_KEY,
  getLevelFromXp,
  getLevelTitle,
  getMissionProgress,
  getXpWindow,
  recordGameCompletion,
  recordReviewCompletion,
  sanitizeProfile,
  type AchievementPopupState,
  type GamificationProfile,
} from './gamification-state';

interface GamificationContextValue {
  profile: GamificationProfile;
  level: number;
  levelTitle: string;
  xpWindow: { current: number; next: number };
  missions: ReturnType<typeof getMissionProgress>;
  activePopup: AchievementDefinition | null;
  recordGameCompleted: (gameId: GameId, won: boolean) => void;
  recordReviewCompleted: (gameId: GameId) => void;
  dismissPopup: () => void;
}

const GamificationContext = createContext<GamificationContextValue | null>(null);

export function GamificationProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<GamificationProfile>(() => createInitialProfile());
  const [queue, setQueue] = useState<AchievementPopupState[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(GAMIFICATION_STORAGE_KEY);
      if (raw) {
        setProfile(sanitizeProfile(JSON.parse(raw)));
      }
    } catch {
      setProfile(createInitialProfile());
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(GAMIFICATION_STORAGE_KEY, JSON.stringify(profile));
  }, [profile]);

  const recordGameCompletedHandler = useCallback((gameId: GameId, won: boolean) => {
    const now = new Date();
    setProfile((current) => {
      const result = recordGameCompletion(current, gameId, { won, now });
      if (result.popups.length > 0) {
        setQueue((prev) => [...prev, ...result.popups]);
      }
      return result.profile;
    });
  }, []);

  const recordReviewCompletedHandler = useCallback((gameId: GameId) => {
    const now = new Date();
    setProfile((current) => {
      const result = recordReviewCompletion(current, gameId, now);
      if (result.popups.length > 0) {
        setQueue((prev) => [...prev, ...result.popups]);
      }
      return result.profile;
    });
  }, []);

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
      missions: getMissionProgress(profile, new Date()),
      activePopup: queue[0]?.achievement ?? null,
      recordGameCompleted: recordGameCompletedHandler,
      recordReviewCompleted: recordReviewCompletedHandler,
      dismissPopup,
    }),
    [dismissPopup, level, profile, queue, recordGameCompletedHandler, recordReviewCompletedHandler],
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
