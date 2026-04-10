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
        'gatos-caes': { played: 0, wins: 0, reviews: 0, rules: 0, strategy: 0, mastery: 0 },
        dominorio: { played: 2, wins: 1, reviews: 1, rules: 1, strategy: 1, mastery: 1 },
        quelhas: { played: 0, wins: 0, reviews: 0, rules: 0, strategy: 0, mastery: 0 },
        produto: { played: 0, wins: 0, reviews: 0, rules: 0, strategy: 0, mastery: 0 },
        'atari-go': { played: 0, wins: 0, reviews: 0, rules: 0, strategy: 0, mastery: 0 },
        nex: { played: 0, wins: 0, reviews: 0, rules: 0, strategy: 0, mastery: 0 },
      },
      recentEvents: [
        { type: 'game_completed', gameId: 'dominorio', at: '2026-04-06T10:00:00.000Z', won: true },
        { type: 'review_completed', gameId: 'dominorio', at: '2026-04-06T10:10:00.000Z' },
      ],
    };

    const firstImport = service.importLocalProfile(session.userId, legacy);
    const secondImport = service.importLocalProfile(session.userId, legacy);

    expect(firstImport.profile.totalXp).toBe(42);
    expect(secondImport.importFingerprint).toBe(firstImport.importFingerprint);

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
    expect(tables).not.toContain('matches');
    expect(tables).not.toContain('classrooms');
    expect(tables).not.toContain('teacher_dashboards');
  });
});
