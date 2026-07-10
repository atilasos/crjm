import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { DifficultyLevel, GameId } from '../../ai-core/types';
import {
  createAdaptiveEvidence,
  recordAdaptiveDecision as accumulateAdaptiveDecision,
  recommendDifficulty,
  type AdaptiveDecisionEvidence,
  type AdaptiveDifficultyEvidence,
  type DifficultyRecommendation,
} from '../../ai-core/adaptive-difficulty';
import type { PatternEvidence } from '../../ai-core/learner-gamification';
import type { AchievementDefinition } from '../../ai-core/gamification';
import {
  createInitialProfile,
  getMissionProgress,
  getLevelFromXp,
  getLevelTitle,
  getXpWindow,
  GAMIFICATION_STORAGE_KEY,
  recordGameCompletion,
  recordPatternProgress,
  recordPuzzleSolved,
  recordReviewCompletion,
  claimMissionReward,
  sanitizeProfile,
  type AchievementPopupState,
  type GamificationProfile,
  type MissionProgress,
} from './gamification-state';
import {
  bootstrapGamification,
  postGameCompleted,
  postMissionClaim,
  postPatternProgress,
  postPuzzleSolved,
  postReviewCompleted,
} from './backend-client';
import { createCommandGate } from './command-gate';

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
  recordPuzzleSolved: (gameId: GameId, puzzleId?: string, usedHint?: boolean) => void;
  recordPatternProgress: (input: { gameId: GameId; patternId: string; evidence: PatternEvidence; contextId: string }) => void;
  claimMissionReward: (missionId: string) => void;
  recordAdaptiveDecision: (gameId: GameId, decision: AdaptiveDecisionEvidence) => void;
  getDifficultyRecommendation: (gameId: GameId, level: DifficultyLevel) => DifficultyRecommendation;
  acceptDifficultyRecommendation: (gameId: GameId) => void;
  resetAdaptiveSession: (gameId: GameId) => void;
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

function writeLegacyProfile(profile: GamificationProfile): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(GAMIFICATION_STORAGE_KEY, JSON.stringify(profile));
}

function shouldUseLearnerApi(): boolean {
  // Bun bundles classic scripts referenced by imported HTML into its client
  // entrypoint, so a server-side override of runtime-config.js is not reliable.
  // Probe the same-origin API instead; bootstrap already falls back to the
  // local profile when the static deployment has no learner-core routes.
  return true;
}

function buildOfflineBootstrap(localProfile: unknown): {
  profile: GamificationProfile;
  missions: MissionProgress[];
} {
  const profile = sanitizeProfile(localProfile);
  return {
    profile: { ...profile, sessionXp: 0 },
    missions: getMissionProgress(profile, new Date()),
  };
}

export function GamificationProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<GamificationProfile>(() => createInitialProfile());
  const [missions, setMissions] = useState<MissionProgress[]>([]);
  const [queue, setQueue] = useState<AchievementPopupState[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [adaptiveEvidence, setAdaptiveEvidence] = useState<Partial<Record<GameId, AdaptiveDifficultyEvidence>>>({});
  const commandGateRef = useRef(createCommandGate());
  const profileRef = useRef(profile);
  const learnerApiEnabled = shouldUseLearnerApi();

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  const applyOfflineProfile = useCallback((nextProfile: GamificationProfile, popups: AchievementPopupState[] = []) => {
    profileRef.current = nextProfile;
    setProfile(nextProfile);
    setMissions(getMissionProgress(nextProfile, new Date()));
    if (popups.length > 0) {
      setQueue((prev) => [...prev, ...popups]);
    }
    writeLegacyProfile(nextProfile);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const bootstrapTask = (async () => {
      const legacyProfile = readLegacyProfile();
      try {
        const result = learnerApiEnabled
          ? await bootstrapGamification(fetch, legacyProfile)
          : buildOfflineBootstrap(legacyProfile);
        if (cancelled) return;
        setProfile({ ...result.profile, sessionXp: 0 });
        setMissions(result.missions);
        if (learnerApiEnabled && legacyProfile && 'legacyImportConsumed' in result && result.legacyImportConsumed) {
          clearLegacyProfile();
        }
      } catch {
        if (cancelled) return;
        const offline = buildOfflineBootstrap(legacyProfile);
        setProfile(offline.profile);
        setMissions(offline.missions);
      } finally {
        if (!cancelled) setIsReady(true);
      }
    })();

    commandGateRef.current.setBootstrap(bootstrapTask);

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
    if (learnerApiEnabled) {
      void commandGateRef.current.run(() => postGameCompleted(fetch, gameId, won)).then(applyCommandResult).catch(() => undefined);
      return;
    }

    const result = recordGameCompletion(profileRef.current, gameId, { won, now: new Date() });
    applyOfflineProfile(result.profile, result.popups);
  }, [applyCommandResult, applyOfflineProfile, learnerApiEnabled]);

  const recordReviewCompletedHandler = useCallback((gameId: GameId) => {
    if (learnerApiEnabled) {
      void commandGateRef.current.run(() => postReviewCompleted(fetch, gameId)).then(applyCommandResult).catch(() => undefined);
      return;
    }

    const result = recordReviewCompletion(profileRef.current, gameId, new Date());
    applyOfflineProfile(result.profile, result.popups);
  }, [applyCommandResult, applyOfflineProfile, learnerApiEnabled]);

  const recordPuzzleSolvedHandler = useCallback((gameId: GameId, puzzleId?: string, usedHint = false) => {
    if (learnerApiEnabled) {
      void commandGateRef.current.run(() => postPuzzleSolved(fetch, gameId, puzzleId, usedHint)).then(applyCommandResult).catch(() => undefined);
      return;
    }
    const result = recordPuzzleSolved(profileRef.current, gameId, new Date(), { puzzleId, usedHint });
    if (result.awarded) applyOfflineProfile(result.profile, result.popups);
  }, [applyCommandResult, applyOfflineProfile, learnerApiEnabled]);

  const recordPatternProgressHandler = useCallback((input: {
    gameId: GameId;
    patternId: string;
    evidence: PatternEvidence;
    contextId: string;
  }) => {
    if (learnerApiEnabled) {
      void commandGateRef.current.run(() => postPatternProgress(fetch, input)).then(applyCommandResult).catch(() => undefined);
      return;
    }
    const result = recordPatternProgress(profileRef.current, { ...input, now: new Date() });
    applyOfflineProfile(result.profile, result.popups);
  }, [applyCommandResult, applyOfflineProfile, learnerApiEnabled]);

  const claimMissionRewardHandler = useCallback((missionId: string) => {
    if (learnerApiEnabled) {
      void commandGateRef.current.run(() => postMissionClaim(fetch, missionId)).then(applyCommandResult).catch(() => undefined);
      return;
    }
    const result = claimMissionReward(profileRef.current, missionId, new Date());
    if (result.claimed) applyOfflineProfile(result.profile, result.popups);
  }, [applyCommandResult, applyOfflineProfile, learnerApiEnabled]);

  const recordAdaptiveDecisionHandler = useCallback((gameId: GameId, decision: AdaptiveDecisionEvidence) => {
    setAdaptiveEvidence((current) => ({
      ...current,
      [gameId]: accumulateAdaptiveDecision(current[gameId] ?? createAdaptiveEvidence(), decision),
    }));
  }, []);

  const getDifficultyRecommendation = useCallback((gameId: GameId, difficulty: DifficultyLevel) => (
    recommendDifficulty(difficulty, adaptiveEvidence[gameId] ?? createAdaptiveEvidence())
  ), [adaptiveEvidence]);

  const acceptDifficultyRecommendation = useCallback((gameId: GameId) => {
    setAdaptiveEvidence((current) => ({
      ...current,
      [gameId]: {
        ...(current[gameId] ?? createAdaptiveEvidence()),
        changedThisSession: true,
      },
    }));
  }, []);

  const resetAdaptiveSession = useCallback((gameId: GameId) => {
    setAdaptiveEvidence((current) => ({ ...current, [gameId]: createAdaptiveEvidence() }));
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
      missions,
      activePopup: queue[0]?.achievement ?? null,
      isReady,
      recordGameCompleted: recordGameCompletedHandler,
      recordReviewCompleted: recordReviewCompletedHandler,
      recordPuzzleSolved: recordPuzzleSolvedHandler,
      recordPatternProgress: recordPatternProgressHandler,
      claimMissionReward: claimMissionRewardHandler,
      recordAdaptiveDecision: recordAdaptiveDecisionHandler,
      getDifficultyRecommendation,
      acceptDifficultyRecommendation,
      resetAdaptiveSession,
      dismissPopup,
    }),
    [
      claimMissionRewardHandler,
      dismissPopup,
      isReady,
      level,
      missions,
      profile,
      queue,
      acceptDifficultyRecommendation,
      getDifficultyRecommendation,
      recordGameCompletedHandler,
      recordAdaptiveDecisionHandler,
      recordPatternProgressHandler,
      recordPuzzleSolvedHandler,
      recordReviewCompletedHandler,
      resetAdaptiveSession,
    ],
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
