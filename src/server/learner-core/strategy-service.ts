import type { Database } from 'bun:sqlite';
import type { GameId } from '../../ai-core/types';
import { getStrategyProgress, RETENTION_DELAY_MS } from '../../ai-core/strategy-progress';
import type { StrategyEvidence, StrategyPracticeView, StrategyProgress } from '../../types/strategy-practice';
import { CHALLENGES_PER_GAME, STRATEGY_GAMES, getStrategyChallenge } from './strategy-challenges';

interface AttemptRow {
  id: string;
  game_id: GameId;
  variant: number;
  hint_used: number;
  answer: string | null;
  prediction: string | null;
  correct: number | null;
  created_at: string;
  completed_at: string | null;
}

export class StrategyPracticeService {
  constructor(private readonly db: Database, private readonly now: () => Date = () => new Date()) {}

  private history(userId: string, gameId: GameId): AttemptRow[] {
    return this.db.query<AttemptRow, [string, string]>(
      'SELECT * FROM learner_strategy_attempts WHERE user_id = ? AND game_id = ? ORDER BY rowid',
    ).all(userId, gameId);
  }

  private evidence(rows: AttemptRow[]): StrategyEvidence[] {
    return rows.filter(row => row.completed_at !== null).map(row => ({
      contextId: getStrategyChallenge(row.game_id, row.variant).challenge.id,
      familyId: getStrategyChallenge(row.game_id, row.variant).challenge.familyId,
      completedAt: row.completed_at!, correct: row.correct === 1, assisted: row.hint_used === 1,
    }));
  }

  progress(userId: string): Record<GameId, StrategyProgress> {
    return Object.fromEntries(STRATEGY_GAMES.map(gameId => [gameId, getStrategyProgress(this.evidence(this.history(userId, gameId)))])) as Record<GameId, StrategyProgress>;
  }

  private ownedAttempt(userId: string, id: string): AttemptRow {
    if (typeof id !== 'string' || id.length > 100) throw new Error('invalid attempt');
    const row = this.db.query<AttemptRow, [string, string]>(
      'SELECT * FROM learner_strategy_attempts WHERE id = ? AND user_id = ?',
    ).get(id, userId);
    if (!row) throw new Error('attempt not found');
    return row;
  }

  private view(userId: string, row: AttemptRow): StrategyPracticeView {
    const solution = getStrategyChallenge(row.game_id, row.variant);
    const rows = this.history(userId, row.game_id);
    const index = rows.findIndex(previous => previous.id === row.id);
    const previous = rows.slice(0, index).filter(previous => previous.variant === row.variant).at(-1);
    const retrieved = !previous || Date.parse(row.completed_at ?? row.created_at) - Date.parse(previous.completed_at ?? previous.created_at) >= RETENTION_DELAY_MS;
    return {
      attemptId: row.id,
      challenge: solution.challenge,
      hint: row.hint_used ? solution.hint : null,
      feedback: row.completed_at ? {
        correct: row.correct === 1,
        independent: row.correct === 1 && !row.hint_used && retrieved,
        explanation: solution.explanation,
      } : null,
      progress: getStrategyProgress(this.evidence(rows)),
    };
  }

  start(userId: string, gameId: GameId): StrategyPracticeView {
    if (!STRATEGY_GAMES.includes(gameId)) throw new Error('invalid game');
    return this.db.transaction(() => {
      const rows = this.history(userId, gameId);
      const active = rows.find(row => row.completed_at === null);
      if (active) return this.view(userId, active);
      const id = crypto.randomUUID();
      this.db.query(
        'INSERT INTO learner_strategy_attempts (id, user_id, game_id, variant, created_at) VALUES (?, ?, ?, ?, ?)',
      ).run(id, userId, gameId, rows.length % CHALLENGES_PER_GAME, this.now().toISOString());
      return this.view(userId, this.ownedAttempt(userId, id));
    })();
  }

  hint(userId: string, id: string): StrategyPracticeView {
    const row = this.ownedAttempt(userId, id);
    // Exposure is durable before the hint is sent, even if the browser reloads.
    if (!row.completed_at) this.db.query('UPDATE learner_strategy_attempts SET hint_used = 1 WHERE id = ?').run(id);
    return this.view(userId, this.ownedAttempt(userId, id));
  }

  answer(userId: string, id: string, answer: string, prediction: string): StrategyPracticeView {
    return this.db.transaction(() => {
      const row = this.ownedAttempt(userId, id);
      if (row.completed_at) return this.view(userId, row);
      const solution = getStrategyChallenge(row.game_id, row.variant);
      if (!solution.challenge.options.some(option => option.id === answer)
        || !solution.challenge.predictions.some(option => option.id === prediction)) throw new Error('invalid answer');
      const correct = answer === solution.answer && prediction === solution.prediction;
      this.db.query(
        'UPDATE learner_strategy_attempts SET answer = ?, prediction = ?, correct = ?, completed_at = ? WHERE id = ? AND completed_at IS NULL',
      ).run(answer, prediction, correct ? 1 : 0, this.now().toISOString(), id);
      return this.view(userId, this.ownedAttempt(userId, id));
    })();
  }
}
