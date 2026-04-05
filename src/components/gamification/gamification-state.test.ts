import { describe, expect, test } from 'bun:test';
import {
  createInitialProfile,
  getMissionProgress,
  recordGameCompletion,
  recordReviewCompletion,
} from './gamification-state';

describe('gamification state', () => {
  test('awards xp and unlocks starter achievements on first game/review', () => {
    const initial = createInitialProfile();
    const afterGame = recordGameCompletion(initial, 'dominorio', {
      won: true,
      now: new Date('2026-04-05T10:00:00Z'),
    }).profile;

    expect(afterGame.totalXp).toBeGreaterThanOrEqual(28);
    expect(afterGame.achievements.first_game).toBeDefined();
    expect(afterGame.achievements.first_win).toBeDefined();

    const afterReview = recordReviewCompletion(afterGame, 'dominorio', new Date('2026-04-05T10:10:00Z')).profile;
    expect(afterReview.achievements.first_review).toBeDefined();
    expect(afterReview.gameProgress.dominorio.mastery).toBeGreaterThan(0);
  });

  test('derives mission progress from recent events', () => {
    let profile = createInitialProfile();
    const now = new Date('2026-04-05T12:00:00Z');
    profile = recordGameCompletion(profile, 'dominorio', { won: false, now }).profile;
    profile = recordGameCompletion(profile, 'quelhas', { won: false, now }).profile;
    profile = recordReviewCompletion(profile, 'dominorio', now).profile;

    const missions = getMissionProgress(profile, now);
    expect(missions.find((mission) => mission.id === 'daily-play-2')?.completed).toBe(true);
    expect(missions.find((mission) => mission.id === 'daily-review-1')?.completed).toBe(true);
  });
});
