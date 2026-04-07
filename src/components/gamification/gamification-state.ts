export const GAMIFICATION_STORAGE_KEY = 'crjm.gamification.v1';

export {
  createInitialProfile,
  getLevelFromXp,
  getLevelTitle,
  getMissionProgress,
  getXpWindow,
  recordGameCompletion,
  recordReviewCompletion,
  rebuildProfileFromEvents,
  sanitizeProfile,
  type AchievementPopupState,
  type AchievementUnlock,
  type GamificationEvent,
  type GamificationProfile,
  type GameProgressSnapshot,
  type MissionProgress,
} from '../../ai-core/learner-gamification';
