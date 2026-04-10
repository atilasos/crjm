import { describe, expect, test } from 'bun:test';
import { bootstrapGamification, postGameCompleted, postReviewCompleted } from './backend-client';

function makeResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('backend gamification client', () => {
  test('bootstraps from API and attempts import when local profile exists', async () => {
    const calls: string[] = [];
    const fetchMock: typeof fetch = (async (input, init) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      calls.push(`${method} ${url}`);

      if (url === '/api/auth/session') return makeResponse({ userId: 'learner-1' });
      if (url === '/api/learner/import-local-profile') return makeResponse({ ok: true });
      return makeResponse({
        profile: {
          userId: 'learner-1',
          displayName: 'Aluno',
          locale: 'pt-PT',
          cycleOrGrade: null,
          totalXp: 32,
          currentStreakDays: 2,
          lastActiveOn: '2026-04-07',
          createdAt: '2026-04-07T09:00:00Z',
          updatedAt: '2026-04-07T09:00:00Z',
        },
        gameProgress: {
          'gatos-caes': { played: 0, wins: 0, reviews: 0, rules: 0, strategy: 0, mastery: 0 },
          dominorio: { played: 1, wins: 1, reviews: 0, rules: 1, strategy: 1, mastery: 0 },
          quelhas: { played: 0, wins: 0, reviews: 0, rules: 0, strategy: 0, mastery: 0 },
          produto: { played: 0, wins: 0, reviews: 0, rules: 0, strategy: 0, mastery: 0 },
          'atari-go': { played: 0, wins: 0, reviews: 0, rules: 0, strategy: 0, mastery: 0 },
          nex: { played: 0, wins: 0, reviews: 0, rules: 0, strategy: 0, mastery: 0 },
        },
        achievements: { first_game: { unlockedAt: '2026-04-07T09:00:00Z' } },
        missions: [],
        recentEvents: [{ type: 'game_completed', gameId: 'dominorio', at: '2026-04-07T09:00:00Z', won: true }],
        importFingerprint: 'abc',
      });
    }) as typeof fetch;

    const result = await bootstrapGamification(fetchMock, { totalXp: 8 });
    expect(result.profile.totalXp).toBe(32);
    expect(result.importFingerprint).toBe('abc');
    expect(result.legacyImportConsumed).toBe(true);
    expect(calls).toEqual([
      'GET /api/auth/session',
      'POST /api/learner/import-local-profile',
      'GET /api/learner/dashboard',
    ]);
  });

  test('does not mark legacy profile as consumed when import fails but dashboard still loads', async () => {
    const fetchMock: typeof fetch = (async (input) => {
      const url = String(input);
      if (url === '/api/auth/session') return makeResponse({ userId: 'learner-1' });
      if (url === '/api/learner/import-local-profile') return makeResponse({ error: 'conflict' }, 409);
      return makeResponse({
        profile: {
          userId: 'learner-1',
          displayName: 'Aluno',
          locale: 'pt-PT',
          cycleOrGrade: null,
          totalXp: 0,
          currentStreakDays: 0,
          lastActiveOn: null,
          createdAt: '2026-04-07T09:00:00Z',
          updatedAt: '2026-04-07T09:00:00Z',
        },
        gameProgress: {
          'gatos-caes': { played: 0, wins: 0, reviews: 0, rules: 0, strategy: 0, mastery: 0 },
          dominorio: { played: 0, wins: 0, reviews: 0, rules: 0, strategy: 0, mastery: 0 },
          quelhas: { played: 0, wins: 0, reviews: 0, rules: 0, strategy: 0, mastery: 0 },
          produto: { played: 0, wins: 0, reviews: 0, rules: 0, strategy: 0, mastery: 0 },
          'atari-go': { played: 0, wins: 0, reviews: 0, rules: 0, strategy: 0, mastery: 0 },
          nex: { played: 0, wins: 0, reviews: 0, rules: 0, strategy: 0, mastery: 0 },
        },
        achievements: {},
        missions: [],
        recentEvents: [],
        importFingerprint: null,
      });
    }) as typeof fetch;

    const result = await bootstrapGamification(fetchMock, { totalXp: 8 });
    expect(result.legacyImportConsumed).toBe(false);
  });

  test('maps command payloads into popups and client profile', async () => {
    const payload = {
      dashboard: {
        profile: {
          userId: 'learner-1',
          displayName: 'Aluno',
          locale: 'pt-PT',
          cycleOrGrade: null,
          totalXp: 28,
          currentStreakDays: 1,
          lastActiveOn: '2026-04-07',
          createdAt: '2026-04-07T09:00:00Z',
          updatedAt: '2026-04-07T09:00:00Z',
        },
        gameProgress: {
          'gatos-caes': { played: 0, wins: 0, reviews: 0, rules: 0, strategy: 0, mastery: 0 },
          dominorio: { played: 1, wins: 1, reviews: 0, rules: 1, strategy: 1, mastery: 0 },
          quelhas: { played: 0, wins: 0, reviews: 0, rules: 0, strategy: 0, mastery: 0 },
          produto: { played: 0, wins: 0, reviews: 0, rules: 0, strategy: 0, mastery: 0 },
          'atari-go': { played: 0, wins: 0, reviews: 0, rules: 0, strategy: 0, mastery: 0 },
          nex: { played: 0, wins: 0, reviews: 0, rules: 0, strategy: 0, mastery: 0 },
        },
        achievements: {
          first_game: { unlockedAt: '2026-04-07T09:00:00Z' },
          first_win: { unlockedAt: '2026-04-07T09:00:00Z' },
        },
        missions: [],
        recentEvents: [{ type: 'game_completed', gameId: 'dominorio', at: '2026-04-07T09:00:00Z', won: true }],
        importFingerprint: null,
      },
      sessionXpDelta: 28,
      unlockedAchievementIds: ['first_game', 'first_win'],
    };

    const fetchMock: typeof fetch = (async () => makeResponse(payload)) as unknown as typeof fetch;
    const gameResult = await postGameCompleted(fetchMock, 'dominorio', true);
    const reviewResult = await postReviewCompleted(fetchMock, 'dominorio');

    expect(gameResult.popups).toHaveLength(2);
    expect(gameResult.sessionXpDelta).toBe(28);
    expect(reviewResult.profile.totalXp).toBe(28);
  });
});
