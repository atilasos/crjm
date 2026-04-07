import { Database } from 'bun:sqlite';
import type { GameId } from '../../ai-core/types';
import {
  createInitialProfile,
  getMissionProgress,
  recordGameCompletion,
  recordReviewCompletion,
  sanitizeProfile,
  type GamificationEvent,
  type GamificationProfile,
} from '../../components/gamification/gamification-state';
import type {
  LearnerActivityEventRecord,
  LearnerCommandResponse,
  LearnerDashboardPayload,
  LearnerGameProgressRecord,
  LearnerProfileRecord,
} from '../../types/learner-core';

const GAME_IDS: GameId[] = ['gatos-caes', 'dominorio', 'quelhas', 'produto', 'atari-go', 'nex'];

interface SessionRow {
  id: string;
  user_id: string;
}

interface ImportMarkerRow {
  fingerprint: string;
  imported_at: string;
}

interface EventRow {
  id: string;
  game_id: GameId;
  event_type: 'game_completed' | 'review_completed';
  occurred_at: string;
  won: number | null;
  xp_delta: number;
}

interface ProfileRow {
  display_name: string;
  locale: string;
  cycle_or_grade: string | null;
  total_xp: number;
  current_streak_days: number;
  last_active_on: string | null;
  created_at: string;
  updated_at: string;
}

interface ProgressRow {
  game_id: GameId;
  played_count: number;
  win_count: number;
  review_count: number;
  rules_level: number;
  strategy_level: number;
  mastery_level: number;
  last_played_at: string | null;
  updated_at: string;
}

function hydrateProfileFromSnapshot(snapshot: {
  totalXp: number;
  streakDays: number;
  lastActiveDate: string | null;
  gameProgress: GamificationProfile['gameProgress'];
  recentEvents: GamificationEvent[];
}): GamificationProfile {
  const base = createInitialProfile();
  return {
    ...base,
    totalXp: snapshot.totalXp,
    sessionXp: 0,
    streakDays: snapshot.streakDays,
    lastActiveDate: snapshot.lastActiveDate,
    gameProgress: snapshot.gameProgress,
    recentEvents: snapshot.recentEvents,
  };
}

export class LearnerCoreService {
  constructor(
    private readonly db: Database,
    private readonly now: () => Date = () => new Date(),
  ) {}

  ensureSession(sessionId: string | null): { sessionId: string; userId: string; created: boolean } {
    const nowIso = this.now().toISOString();
    if (sessionId) {
      const existing = this.db.query<SessionRow, [string]>('SELECT id, user_id FROM auth_sessions WHERE id = ?').get(sessionId);
      if (existing) {
        this.db.query('UPDATE auth_sessions SET last_seen_at = ? WHERE id = ?').run(nowIso, sessionId);
        this.db.query('UPDATE users SET last_login_at = ? WHERE id = ?').run(nowIso, existing.user_id);
        return { sessionId, userId: existing.user_id, created: false };
      }
    }

    const userId = crypto.randomUUID();
    const nextSessionId = crypto.randomUUID();
    const displayName = `Aluno ${userId.slice(0, 8)}`;

    this.db.exec('BEGIN');
    try {
      this.db.query(
        'INSERT INTO users (id, auth_provider, auth_subject, role, created_at, last_login_at) VALUES (?, ?, ?, ?, ?, ?)',
      ).run(userId, 'dev-session', userId, 'learner', nowIso, nowIso);
      this.db.query(
        'INSERT INTO learner_profiles (user_id, display_name, locale, cycle_or_grade, total_xp, current_streak_days, last_active_on, created_at, updated_at) VALUES (?, ?, ?, ?, 0, 0, NULL, ?, ?)',
      ).run(userId, displayName, 'pt-PT', null, nowIso, nowIso);
      this.db.query('INSERT INTO auth_sessions (id, user_id, created_at, last_seen_at) VALUES (?, ?, ?, ?)').run(
        nextSessionId,
        userId,
        nowIso,
        nowIso,
      );
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }

    return { sessionId: nextSessionId, userId, created: true };
  }

  getDashboard(userId: string): LearnerDashboardPayload {
    const profile = this.reconstructProfile(userId);
    return this.toDashboardPayload(userId, profile);
  }

  recordGameCompleted(userId: string, gameId: GameId, won: boolean): LearnerCommandResponse {
    const before = this.reconstructProfile(userId);
    const now = this.now();
    const { profile: after } = recordGameCompletion(before, gameId, { won, now });
    this.insertEvent(userId, {
      id: crypto.randomUUID(),
      game_id: gameId,
      event_type: 'game_completed',
      occurred_at: now.toISOString(),
      won: won ? 1 : 0,
      xp_delta: 10 + (won ? 8 : 0),
    });
    this.syncSnapshotTables(userId, after);
    return this.buildCommandResponse(userId, before, after);
  }

  recordReviewCompleted(userId: string, gameId: GameId): LearnerCommandResponse {
    const before = this.reconstructProfile(userId);
    const now = this.now();
    const { profile: after } = recordReviewCompletion(before, gameId, now);
    this.insertEvent(userId, {
      id: crypto.randomUUID(),
      game_id: gameId,
      event_type: 'review_completed',
      occurred_at: now.toISOString(),
      won: null,
      xp_delta: 10,
    });
    this.syncSnapshotTables(userId, after);
    return this.buildCommandResponse(userId, before, after);
  }

  importLocalProfile(userId: string, rawProfile: unknown): LearnerDashboardPayload {
    const sanitized = sanitizeProfile(rawProfile);
    sanitized.sessionXp = 0;
    const fingerprint = this.hashProfile(sanitized);
    const existing = this.db
      .query<ImportMarkerRow, [string]>('SELECT fingerprint, imported_at FROM learner_import_markers WHERE user_id = ?')
      .get(userId);

    if (existing && existing.fingerprint !== fingerprint) {
      throw new Error('different import payload already recorded for this learner');
    }

    if (!existing) {
      const nowIso = this.now().toISOString();
      this.db.exec('BEGIN');
      try {
        this.db.query(
          'INSERT INTO learner_import_markers (user_id, fingerprint, imported_at) VALUES (?, ?, ?)',
        ).run(userId, fingerprint, nowIso);
        this.db.query('DELETE FROM learner_activity_events WHERE user_id = ?').run(userId);
        for (const event of sanitized.recentEvents) {
          this.insertEvent(userId, {
            id: crypto.randomUUID(),
            game_id: event.gameId,
            event_type: event.type,
            occurred_at: event.at,
            won: event.type === 'game_completed' ? (event.won ? 1 : 0) : null,
            xp_delta: event.type === 'review_completed' ? 10 : 10 + (event.won ? 8 : 0),
          });
        }
        this.syncSnapshotTables(userId, sanitized);
        this.db.exec('COMMIT');
      } catch (error) {
        this.db.exec('ROLLBACK');
        throw error;
      }
    }

    return this.getDashboard(userId);
  }

  private buildCommandResponse(userId: string, before: GamificationProfile, after: GamificationProfile): LearnerCommandResponse {
    const beforeIds = new Set(Object.keys(before.achievements));
    const unlockedAchievementIds = Object.keys(after.achievements).filter((id) => !beforeIds.has(id));
    return {
      dashboard: this.toDashboardPayload(userId, after),
      sessionXpDelta: after.totalXp - before.totalXp,
      unlockedAchievementIds,
    };
  }

  private toDashboardPayload(userId: string, profile: GamificationProfile): LearnerDashboardPayload {
    const record = this.db
      .query<ProfileRow, [string]>(
        'SELECT display_name, locale, cycle_or_grade, total_xp, current_streak_days, last_active_on, created_at, updated_at FROM learner_profiles WHERE user_id = ?',
      )
      .get(userId);

    if (!record) {
      throw new Error(`learner profile missing for ${userId}`);
    }

    const importRow = this.db
      .query<Pick<ImportMarkerRow, 'fingerprint'>, [string]>('SELECT fingerprint FROM learner_import_markers WHERE user_id = ?')
      .get(userId);

    const payloadProfile: LearnerProfileRecord = {
      userId,
      displayName: record.display_name,
      locale: 'pt-PT',
      cycleOrGrade: record.cycle_or_grade,
      totalXp: profile.totalXp,
      currentStreakDays: profile.streakDays,
      lastActiveOn: profile.lastActiveDate,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    };

    return {
      profile: payloadProfile,
      gameProgress: profile.gameProgress,
      achievements: profile.achievements,
      missions: getMissionProgress(profile, this.now()),
      recentEvents: profile.recentEvents,
      importFingerprint: importRow?.fingerprint ?? null,
    };
  }

  private reconstructProfile(userId: string): GamificationProfile {
    const profileRow = this.db
      .query<ProfileRow, [string]>(
        'SELECT display_name, locale, cycle_or_grade, total_xp, current_streak_days, last_active_on, created_at, updated_at FROM learner_profiles WHERE user_id = ?',
      )
      .get(userId);

    if (!profileRow) {
      return createInitialProfile();
    }

    const progressRows = this.db
      .query<ProgressRow, [string]>(
        'SELECT game_id, played_count, win_count, review_count, rules_level, strategy_level, mastery_level, last_played_at, updated_at FROM learner_game_progress WHERE user_id = ?',
      )
      .all(userId);

    const gameProgress = GAME_IDS.reduce((acc, gameId) => {
      const row = progressRows.find((entry) => entry.game_id === gameId);
      acc[gameId] = {
        played: row?.played_count ?? 0,
        wins: row?.win_count ?? 0,
        reviews: row?.review_count ?? 0,
        rules: row?.rules_level ?? 0,
        strategy: row?.strategy_level ?? 0,
        mastery: row?.mastery_level ?? 0,
      };
      return acc;
    }, {} as GamificationProfile['gameProgress']);

    const recentEvents: GamificationEvent[] = this.db
      .query<EventRow, [string]>(
        'SELECT id, game_id, event_type, occurred_at, won, xp_delta FROM learner_activity_events WHERE user_id = ? ORDER BY occurred_at ASC, id ASC',
      )
      .all(userId)
      .map((row) => ({
        type: row.event_type,
        gameId: row.game_id,
        at: row.occurred_at,
        won: row.event_type === 'game_completed' ? Boolean(row.won) : undefined,
      }));

    return hydrateProfileFromSnapshot({
      totalXp: profileRow.total_xp,
      streakDays: profileRow.current_streak_days,
      lastActiveDate: profileRow.last_active_on,
      gameProgress,
      recentEvents,
    });
  }

  private syncSnapshotTables(userId: string, profile: GamificationProfile): void {
    const nowIso = this.now().toISOString();
    this.db.query(
      'UPDATE learner_profiles SET total_xp = ?, current_streak_days = ?, last_active_on = ?, updated_at = ? WHERE user_id = ?',
    ).run(profile.totalXp, profile.streakDays, profile.lastActiveDate, nowIso, userId);

    for (const gameId of GAME_IDS) {
      const progress = profile.gameProgress[gameId];
      const lastPlayedAt = [...profile.recentEvents]
        .reverse()
        .find((event) => event.gameId === gameId && event.type === 'game_completed')?.at ?? null;
      this.db.query(
        `INSERT INTO learner_game_progress (
          user_id, game_id, played_count, win_count, review_count, rules_level, strategy_level, mastery_level, last_played_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, game_id) DO UPDATE SET
          played_count = excluded.played_count,
          win_count = excluded.win_count,
          review_count = excluded.review_count,
          rules_level = excluded.rules_level,
          strategy_level = excluded.strategy_level,
          mastery_level = excluded.mastery_level,
          last_played_at = excluded.last_played_at,
          updated_at = excluded.updated_at`,
      ).run(
        userId,
        gameId,
        progress.played,
        progress.wins,
        progress.reviews,
        progress.rules,
        progress.strategy,
        progress.mastery,
        lastPlayedAt,
        nowIso,
      );
    }
  }

  private insertEvent(userId: string, event: EventRow): void {
    this.db.query(
      'INSERT INTO learner_activity_events (id, user_id, game_id, event_type, occurred_at, won, xp_delta) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).run(event.id, userId, event.game_id, event.event_type, event.occurred_at, event.won, event.xp_delta);
  }

  private hashProfile(profile: GamificationProfile): string {
    return new Bun.CryptoHasher('sha256').update(JSON.stringify(profile)).digest('hex');
  }
}
