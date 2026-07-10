import { describe, expect, test } from 'bun:test';
import { STARTER_ACHIEVEMENTS, STARTER_MISSIONS } from './gamification';

describe('gamification foundations', () => {
  test('includes starter achievements and missions for progression planning', () => {
    expect(STARTER_ACHIEVEMENTS).toHaveLength(29);
    expect(STARTER_MISSIONS).toHaveLength(8);
    expect(STARTER_ACHIEVEMENTS.some((item) => item.id === 'first_review')).toBe(true);
    expect(STARTER_MISSIONS.some((item) => item.frequency === 'weekly')).toBe(true);
    for (const gameId of ['gatos-caes', 'dominorio', 'quelhas', 'produto', 'atari-go', 'nex']) {
      expect(STARTER_ACHIEVEMENTS.filter((item) => item.gameId === gameId).length).toBeGreaterThanOrEqual(2);
    }
  });
});
