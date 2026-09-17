import { criarEstadoInicial, colocarPeca, trocarCores } from '../../games/y/logic';
import { SUPPORTED_LOCALES } from '../../i18n/locale';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { rmSync } from 'node:fs';
import type { LearnerCoreConfig } from './config';
import { createLearnerCoreDb } from './db';
import { LearnerCoreService } from './service';

const tempDbPath = `.tmp/learner-core-${process.pid}.sqlite`;

function createService(nowIso = '2026-04-07T09:00:00Z') {
  const config: LearnerCoreConfig = {
    dbPath: tempDbPath,
    sessionCookieName: 'crjm_session',
    sessionCookieMaxAgeSeconds: 3600,
    sessionCookieSecure: false,
    sessionSecret: 'test-secret',
  };
  const db = createLearnerCoreDb(config);
  let currentNow = new Date(nowIso);
  return {
    db,
    service: new LearnerCoreService(db, () => currentNow),
    setNow(value: string) {
      currentNow = new Date(value);
    },
  };
}

describe('learner core service', () => {
  beforeEach(() => {
    rmSync(tempDbPath, { force: true });
  });

  afterEach(() => {
    rmSync(tempDbPath, { force: true });
  });

  test('bootstraps learner profile with required ADR-003 fields', () => {
    const { service } = createService();
    const session = service.ensureSession(null);
    const dashboard = service.getDashboard(session.userId);

    expect(session.sessionId).toBeTruthy();
    expect(dashboard.profile.userId).toBe(session.userId);
    expect(dashboard.profile.displayName).toContain('Aluno');
    expect(dashboard.profile.locale).toBe('pt-PT');
    expect(dashboard.profile.cycleOrGrade).toBeNull();
    expect(dashboard.profile.totalXp).toBe(0);
    expect(dashboard.profile.currentStreakDays).toBe(0);
    expect(dashboard.profile.lastActiveOn).toBeNull();
  });

  test('returns the stored supported locale and safely defaults older unknown values', () => {
    const { db, service } = createService();
    const session = service.ensureSession(null);
    for (const locale of SUPPORTED_LOCALES) {
      db.query('UPDATE learner_profiles SET locale = ? WHERE user_id = ?').run(locale, session.userId);
      expect(service.getDashboard(session.userId).profile.locale).toBe(locale);
    }
    db.query('UPDATE learner_profiles SET locale = ? WHERE user_id = ?').run('unknown', session.userId);
    expect(service.getDashboard(session.userId).profile.locale).toBe('pt-PT');
  });

  test('persiste o progresso por nível de dificuldade com streaks', () => {
    const { service } = createService();
    const session = service.ensureSession(null);

    service.recordGameCompleted(session.userId, 'atari-go', true, 2);
    service.recordGameCompleted(session.userId, 'atari-go', true, 2);
    service.recordGameCompleted(session.userId, 'atari-go', false, 2);
    service.recordGameCompleted(session.userId, 'atari-go', true, 6);
    // sem nível e nível inválido: contam para gameProgress mas não para levelProgress
    service.recordGameCompleted(session.userId, 'atari-go', true);
    const dashboard = service.recordGameCompleted(session.userId, 'atari-go', true, 99).dashboard;

    const n2 = dashboard.levelProgress['atari-go']?.[2];
    expect(n2).toEqual({ played: 3, wins: 2, currentWinStreak: 0, bestWinStreak: 2 });
    const n6 = dashboard.levelProgress['atari-go']?.[6];
    expect(n6).toEqual({ played: 1, wins: 1, currentWinStreak: 1, bestWinStreak: 1 });
    expect(Object.keys(dashboard.levelProgress['atari-go'] ?? {})).toHaveLength(2);
    expect(dashboard.gameProgress['atari-go'].played).toBe(6);
  });

  test('records game and review events with derivation parity', () => {
    const { service, setNow } = createService();
    const session = service.ensureSession(null);

    setNow('2026-04-07T10:00:00Z');
    const afterGame = service.recordGameCompleted(session.userId, 'dominorio', true);
    expect(afterGame.dashboard.gameProgress.dominorio.played).toBe(1);
    expect(afterGame.dashboard.gameProgress.dominorio.wins).toBe(1);
    expect(afterGame.dashboard.achievements.first_game).toBeDefined();
    expect(afterGame.dashboard.achievements.first_win).toBeDefined();

    setNow('2026-04-07T10:10:00Z');
    const afterReview = service.recordReviewCompleted(session.userId, 'dominorio');
    expect(afterReview.dashboard.gameProgress.dominorio.reviews).toBe(1);
    expect(afterReview.dashboard.achievements.first_review).toBeDefined();
    expect(afterReview.dashboard.missions.find((mission) => mission.id === 'daily-review-1')?.completed).toBe(true);
    expect(afterReview.sessionXpDelta).toBeGreaterThan(0);

    const reloaded = service.getDashboard(session.userId);
    expect(reloaded.achievements.first_game).toBeDefined();
    expect(reloaded.achievements.first_win).toBeDefined();
    expect(reloaded.achievements.first_review).toBeDefined();
  });

  test('persists puzzles, pattern evidence, and idempotent mission claims', () => {
    const { service, setNow } = createService('2026-07-10T09:00:00Z');
    const session = service.ensureSession(null);

    const puzzle = service.recordPuzzleSolved(session.userId, 'atari-go', {
      puzzleId: 'ag-atari-1',
      usedHint: true,
    });
    expect(puzzle.dashboard.achievements.first_puzzle).toBeDefined();
    expect(puzzle.dashboard.recentEvents.at(-1)).toMatchObject({
      type: 'puzzle_solved',
      puzzleId: 'ag-atari-1',
      usedHint: true,
    });
    const duplicatePuzzle = service.recordPuzzleSolved(session.userId, 'atari-go', {
      puzzleId: 'ag-atari-1',
      usedHint: false,
    });
    expect(duplicatePuzzle.sessionXpDelta).toBe(0);
    expect(duplicatePuzzle.dashboard.solvedPuzzleIds).toEqual(['ag-atari-1']);

    setNow('2026-07-10T09:10:00Z');
    service.recordPatternProgress(session.userId, {
      gameId: 'produto',
      patternId: 'produto:equilibrio',
      evidence: 'seen',
      contextId: 'review-a',
    });
    const independent = service.recordPatternProgress(session.userId, {
      gameId: 'produto',
      patternId: 'produto:equilibrio',
      evidence: 'used_alone',
      contextId: 'game-a',
    });
    expect(independent.dashboard.patterns['produto:equilibrio']?.state).toBe('used_alone');
    expect(independent.dashboard.achievements.balanced_builder).toBeDefined();

    service.recordReviewCompleted(session.userId, 'dominorio');
    const firstClaim = service.claimMissionReward(session.userId, 'daily-review-1');
    const duplicateClaim = service.claimMissionReward(session.userId, 'daily-review-1');
    expect(firstClaim.sessionXpDelta).toBe(8);
    expect(duplicateClaim.sessionXpDelta).toBe(0);

    const reloaded = service.getDashboard(session.userId);
    expect(reloaded.patterns['produto:equilibrio']?.state).toBe('used_alone');
    expect(reloaded.recentEvents.some((event) => event.type === 'puzzle_solved')).toBe(true);
    expect(Object.keys(reloaded.missionClaims)).toHaveLength(1);
  });

  test('rolls back learner events when snapshot sync fails', () => {
    const { db, service, setNow } = createService();
    const session = service.ensureSession(null);

    db.exec(`
      CREATE TRIGGER fail_profile_update
      BEFORE UPDATE ON learner_profiles
      BEGIN
        SELECT RAISE(ABORT, 'fail_profile_update');
      END;
    `);

    setNow('2026-04-07T10:00:00Z');
    expect(() => service.recordGameCompleted(session.userId, 'dominorio', true)).toThrow('fail_profile_update');

    const eventCount = db
      .query<{ count: number }, [string]>('SELECT COUNT(*) AS count FROM learner_activity_events WHERE user_id = ?')
      .get(session.userId);

    expect(eventCount?.count).toBe(0);

    const dashboard = service.getDashboard(session.userId);
    expect(dashboard.profile.totalXp).toBe(0);
    expect(dashboard.gameProgress.dominorio.played).toBe(0);
  });

  test('conserva o perfil persistido dos seis jogos e continua o Arquivo após reabrir a sessão', () => {
    const { db, service } = createService();
    const session = service.ensureSession(null);
    for (const gameId of ['gatos-caes', 'dominorio', 'quelhas', 'produto', 'atari-go', 'nex'] as const) {
      service.recordGameCompleted(session.userId, gameId, true, 2);
      service.recordReviewCompleted(session.userId, gameId);
    }
    service.recordPuzzleSolved(session.userId, 'gatos-caes', { puzzleId: 'gc-centro-1', usedHint: true });
    service.recordPuzzleSolved(session.userId, 'nex', { puzzleId: 'nx-ponte-1', usedHint: true });
    const before = service.getDashboard(session.userId);
    db.close();

    const reopened = createService();
    try {
      const resumed = reopened.service.ensureSession(session.sessionId);
      expect(resumed.userId).toBe(session.userId);
      expect(reopened.service.getDashboard(resumed.userId)).toEqual(before);
      expect(before.achievements.first_game).toBeDefined();
      expect(before.achievements.first_puzzle).toBeDefined();
      expect(before.solvedPuzzleIds).toContain('gc-centro-1');
      expect(before.solvedPuzzleIds).toContain('nx-ponte-1');
      const next = reopened.service.recordGameCompleted(resumed.userId, 'nex', false, 2).dashboard;
      expect(next.gameProgress.nex.played).toBe(2);
      expect(next.gameProgress['gatos-caes']).toEqual(before.gameProgress['gatos-caes']);
      expect(next.profile.totalXp).toBe(before.profile.totalXp + 10);
      expect(next.levelProgress.nex?.[2]?.played).toBe(2);
      const other = reopened.service.ensureSession(null);
      const otherProfile = reopened.service.getDashboard(other.userId);
      expect(otherProfile.gameProgress.nex.played).toBe(0);
      expect(otherProfile.profile.totalXp).toBe(0);
    } finally {
      reopened.db.close();
    }
  });

  test('guarda uma partida local de Faísca sem alterar os seis jogos e recupera-a noutra sessão', () => {
    const { db, service } = createService();
    const session = service.ensureSession(null);
    const previousGames = ['gatos-caes', 'dominorio', 'quelhas', 'produto', 'atari-go', 'nex'] as const;
    for (const gameId of previousGames) service.recordGameCompleted(session.userId, gameId, true);
    const before = service.getDashboard(session.userId);
    expect(before.gameProgress.faisca.played).toBe(0);
    const completed = service.recordGameCompleted(session.userId, 'faisca', false).dashboard;
    expect(completed.gameProgress.faisca.played).toBe(1);
    expect(completed.gameProgress.faisca.wins).toBe(0);
    expect(completed.profile.totalXp).toBe(before.profile.totalXp + 10);
    expect(completed.levelProgress.faisca).toBeUndefined();
    for (const gameId of previousGames) expect(completed.gameProgress[gameId]).toEqual(before.gameProgress[gameId]);
    expect(completed.recentEvents).toContainEqual(expect.objectContaining({ gameId: 'faisca', type: 'game_completed', won: false }));
    db.close();

    const reopened = createService();
    try {
      const resumed = reopened.service.ensureSession(session.sessionId);
      const restored = reopened.service.getDashboard(resumed.userId);
      expect(restored.gameProgress).toEqual(completed.gameProgress);
      expect(restored.profile).toEqual(completed.profile);
      expect(restored.achievements).toEqual(completed.achievements);
      expect(restored.recentEvents).toHaveLength(completed.recentEvents.length);
      expect(restored.recentEvents).toEqual(expect.arrayContaining(completed.recentEvents));
      const other = reopened.service.ensureSession(null);
      expect(reopened.service.getDashboard(other.userId).gameProgress.faisca.played).toBe(0);
    } finally { reopened.db.close(); }
  });

  test('Faísca conserva resultados por dificuldade e por aluno após reabrir a sessão', () => {
    const { db, service } = createService();
    const session = service.ensureSession(null);
    service.recordGameCompleted(session.userId, 'dominorio', true, 2);
    const before = service.getDashboard(session.userId);
    service.recordGameCompleted(session.userId, 'faisca', true, 1);
    service.recordGameCompleted(session.userId, 'faisca', false, 2);
    service.recordGameCompleted(session.userId, 'faisca', true, 2);
    const completed = service.getDashboard(session.userId);
    expect(completed.levelProgress.faisca?.[1]).toMatchObject({ played: 1, wins: 1, bestWinStreak: 1 });
    expect(completed.levelProgress.faisca?.[2]).toMatchObject({ played: 2, wins: 1, bestWinStreak: 1 });
    expect(completed.gameProgress.faisca).toMatchObject({ played: 3, wins: 2 });
    expect(completed.gameProgress.dominorio).toEqual(before.gameProgress.dominorio);
    expect(completed.levelProgress.dominorio).toEqual(before.levelProgress.dominorio);
    db.close();
    const reopened = createService();
    try {
      const resumed = reopened.service.ensureSession(session.sessionId);
      expect(reopened.service.getDashboard(resumed.userId).levelProgress).toEqual(completed.levelProgress);
      const other = reopened.service.ensureSession(null);
      expect(reopened.service.getDashboard(other.userId).levelProgress.faisca).toBeUndefined();
    } finally { reopened.db.close(); }
  });

  test.each([false, true])('Y guarda a vitória do participante após troca=%s e recupera o perfil sem alterar outros jogos', swap => {
    const { db, service } = createService();
    const session = service.ensureSession(null);
    const previousGames = ['gatos-caes', 'dominorio', 'quelhas', 'produto', 'atari-go', 'nex', 'faisca'] as const;
    for (const game of previousGames) service.recordGameCompleted(session.userId, game, true);
    const before = service.getDashboard(session.userId);
    let state = colocarPeca(criarEstadoInicial(), 'A1');
    if (swap) state = trocarCores(state);
    const path = ['B1', 'C1', 'D3', 'E3', 'E4', 'E5', 'E6', 'E7', 'D8', 'C7', 'B8', 'A9'];
    const replies = ['M1', 'L1', 'K1', 'J1', 'I1', 'G1', 'E1', 'D1', 'I9', 'J7', 'K5', 'L3'];
    for (let i = 0; i < path.length; i++) {
      state = colocarPeca(state, replies[i]!);
      state = colocarPeca(state, path[i]!);
    }
    // This device's learner chose participant 2, regardless of colour.
    const won = state.estado === 'vitoria-jogador2';
    expect(won).toBe(swap);
    const completed = service.recordGameCompleted(session.userId, 'y', won).dashboard;
    expect(completed.gameProgress.y.played).toBe(1);
    expect(completed.gameProgress.y.wins).toBe(swap ? 1 : 0);
    expect(completed.levelProgress.y).toBeUndefined();
    for (const game of previousGames) expect(completed.gameProgress[game]).toEqual(before.gameProgress[game]);
    expect(completed.recentEvents).toContainEqual(expect.objectContaining({ gameId: 'y', type: 'game_completed', won }));
    db.close();
    const reopened = createService();
    try {
      const resumed = reopened.service.ensureSession(session.sessionId);
      const restored = reopened.service.getDashboard(resumed.userId);
      expect(restored.gameProgress).toEqual(completed.gameProgress);
      expect(restored.profile).toEqual(completed.profile);
      expect(restored.achievements).toEqual(completed.achievements);
      const other = reopened.service.ensureSession(null);
      expect(reopened.service.getDashboard(other.userId).gameProgress.y.played).toBe(0);
    } finally { reopened.db.close(); }
  });

  test('imports a legacy profile idempotently while keeping the V1 core strict', () => {
    const { db, service } = createService();
    const session = service.ensureSession(null);
    const legacy = {
      totalXp: 42,
      sessionXp: 12,
      streakDays: 3,
      lastActiveDate: '2026-04-06',
      achievements: {},
      gameProgress: {
        'gatos-caes': { played: 4, wins: 2, reviews: 1, rules: 2, strategy: 1, mastery: 1 },
        dominorio: { played: 2, wins: 1, reviews: 1, rules: 1, strategy: 1, mastery: 1 },
        quelhas: { played: 0, wins: 0, reviews: 0, rules: 0, strategy: 0, mastery: 0 },
        produto: { played: 0, wins: 0, reviews: 0, rules: 0, strategy: 0, mastery: 0 },
        'atari-go': { played: 0, wins: 0, reviews: 0, rules: 0, strategy: 0, mastery: 0 },
        nex: { played: 3, wins: 1, reviews: 1, rules: 2, strategy: 1, mastery: 1 },
      },
      recentEvents: [
        { type: 'game_completed', gameId: 'dominorio', at: '2026-04-06T10:00:00.000Z', won: true },
        { type: 'review_completed', gameId: 'dominorio', at: '2026-04-06T10:10:00.000Z' },
        { type: 'game_completed', gameId: 'gatos-caes', at: '2026-04-06T10:20:00.000Z', won: true },
        { type: 'review_completed', gameId: 'nex', at: '2026-04-06T10:30:00.000Z' },
      ],
    };

    const firstImport = service.importLocalProfile(session.userId, legacy);
    const secondImport = service.importLocalProfile(session.userId, legacy);

    expect(firstImport.profile.totalXp).toBe(42);
    expect(secondImport.importFingerprint).toBe(firstImport.importFingerprint);
    expect(secondImport).toEqual(firstImport);
    expect(firstImport.gameProgress['gatos-caes']).toEqual(legacy.gameProgress['gatos-caes']);
    expect(firstImport.gameProgress.nex).toEqual(legacy.gameProgress.nex);
    expect(firstImport.recentEvents).toHaveLength(4);
    expect(firstImport.achievements.first_win).toBeDefined();
    service.recordGameCompleted(session.userId, 'nex', true, 1);
    const continued = service.getDashboard(session.userId);
    expect(continued.gameProgress.nex.played).toBe(4);
    const restarted = createService();
    try {
      const resumed = restarted.service.ensureSession(session.sessionId);
      const repeated = restarted.service.importLocalProfile(resumed.userId, legacy);
      expect(repeated).toEqual(continued);
      expect(repeated.profile.totalXp).toBe(60);
      expect(repeated.recentEvents).toHaveLength(5);
    } finally {
      restarted.db.close();
    }

    const tables = db
      .query<{ name: string }, []>("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all()
      .map((row) => row.name);

    expect(tables).toContain('users');
    expect(tables).toContain('learner_profiles');
    expect(tables).toContain('learner_game_progress');
    expect(tables).toContain('learner_activity_events');
    expect(tables).toContain('auth_sessions');
    expect(tables).toContain('learner_import_markers');
    expect(tables).toContain('learner_puzzle_completions');
    expect(tables).toContain('learner_streak_shields');
    expect(tables).not.toContain('matches');
    expect(tables).not.toContain('classrooms');
    expect(tables).not.toContain('teacher_dashboards');
  });
});
