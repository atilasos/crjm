import { describe, expect, test } from 'bun:test';
import { STARTER_ACHIEVEMENTS, STARTER_MISSIONS } from './gamification';

describe('gamification foundations', () => {
  test('includes starter achievements and missions for progression planning', () => {
    expect(STARTER_ACHIEVEMENTS.length).toBeGreaterThan(3);
    expect(STARTER_MISSIONS.length).toBeGreaterThan(2);
    expect(STARTER_ACHIEVEMENTS.some((item) => item.id === 'first_review')).toBe(true);
    expect(STARTER_MISSIONS.some((item) => item.frequency === 'weekly')).toBe(true);
  });
});
