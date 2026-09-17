import { afterEach, describe, expect, test } from 'bun:test';
import type { Database } from 'bun:sqlite';
import { createLearnerCoreDb } from './db';
import { LearnerCoreService } from './service';
import { StrategyPracticeService } from './strategy-service';
import { getStrategyChallenge, STRATEGY_GAMES } from './strategy-challenges';
import { getStrategyProgress, RETENTION_DELAY_MS } from '../../ai-core/strategy-progress';
import type { StrategyEvidence } from '../../types/strategy-practice';

const databases: Database[] = [];
afterEach(() => { for (const db of databases.splice(0)) db.close(); });

function setup() {
  const db = createLearnerCoreDb({ dbPath: ':memory:', sessionCookieName: 'test', sessionCookieMaxAgeSeconds: 3600, sessionCookieSecure: false, sessionSecret: 'test-only' });
  databases.push(db);
  let time = new Date('2026-09-15T10:00:00Z');
  const learners = new LearnerCoreService(db, () => time);
  const user = learners.ensureSession(null).userId;
  return { db, learners, user, service: new StrategyPracticeService(db, () => time), advance: (milliseconds: number) => { time = new Date(time.getTime() + milliseconds); } };
}

describe('strategy practice: evidence survives real learner operations', () => {
  test('Faísca offers a choice with a verifiable opening consequence', () => {
    const { service, user } = setup();
    const view = service.start(user, 'faisca');
    expect(view.hint).toBeNull();
    expect(view.feedback).toBeNull();
    const result = service.answer(user, view.attemptId, '1', '0');
    expect(result.feedback).toMatchObject({ correct: true, independent: true });
    expect(result.progress.independent).toBe(1);
  });

  test('does not send hints, answers or explanations before an attempt', () => {
    const { service, user } = setup();
    const view = service.start(user, 'gatos-caes');
    expect(view.hint).toBeNull();
    expect(view.feedback).toBeNull();
    expect(JSON.stringify(view)).not.toContain('explanation');
    expect(JSON.stringify(view)).not.toContain('correctOptionId');
    expect(service.start(user, 'gatos-caes').attemptId).toBe(view.attemptId);
  });

  test.each(['atari-go', 'faisca'] as const)('%s: a saved hint survives a reload and cannot count as solo evidence', gameId => {
    const { service, user, db } = setup();
    const view = service.start(user, gameId);
    service.hint(user, view.attemptId);
    const reloaded = new StrategyPracticeService(db);
    expect(reloaded.start(user, gameId).hint).toBeTruthy();
    const solution = getStrategyChallenge(gameId, 0);
    const result = reloaded.answer(user, view.attemptId, solution.answer, solution.prediction);
    expect(result.feedback).toMatchObject({ correct: true, independent: false });
    expect(result.progress.independent).toBe(0);
  });

  test('first wrong answer remains practice after resubmission, no duplicated attempt', () => {
    const { service, user } = setup();
    const view = service.start(user, 'produto');
    const solution = getStrategyChallenge('produto', 0);
    const wrong = solution.challenge.options.find(option => option.id !== solution.answer)!;
    const first = service.answer(user, view.attemptId, wrong.id, solution.prediction);
    const retry = service.answer(user, view.attemptId, solution.answer, solution.prediction);
    expect(first.feedback?.correct).toBe(false);
    expect(retry).toEqual(first);
    expect(retry.progress.practiced).toBe(1);
  });

  test('a copied decision with an incorrect consequence does not advance', () => {
    const { service, user } = setup();
    const view = service.start(user, 'nex');
    const solution = getStrategyChallenge('nex', 0);
    const wrongPrediction = solution.challenge.predictions.find(option => option.id !== solution.prediction)!;
    const result = service.answer(user, view.attemptId, solution.answer, wrongPrediction.id);
    expect(result.feedback?.correct).toBe(false);
    expect(result.progress.independent).toBe(0);
  });

  test('does not accept another learner’s attempts or forged answer fields', () => {
    const { service, learners, user } = setup();
    const second = learners.ensureSession(null).userId;
    const view = service.start(user, 'nex');
    expect(() => service.hint(second, view.attemptId)).toThrow('attempt not found');
    expect(() => service.answer(second, view.attemptId, '0', '0')).toThrow('attempt not found');
    expect(() => service.answer(user, view.attemptId, 'forged', '0')).toThrow('invalid answer');
    expect(service.start(user, 'nex').feedback).toBeNull();
  });

  test('all available games can progress, and retention requires a later day', () => {
    for (const gameId of STRATEGY_GAMES) {
      const { service, user, advance } = setup();
      for (let variant = 0; variant < 24; variant++) {
        const view = service.start(user, gameId);
        const solution = getStrategyChallenge(gameId, variant);
        service.answer(user, view.attemptId, solution.answer, solution.prediction);
      }
      expect(service.progress(user)[gameId].stage).toBe('independent');
      advance(RETENTION_DELAY_MS + 1);
      const revisit = service.start(user, gameId);
      const solution = getStrategyChallenge(gameId, 0);
      expect(service.answer(user, revisit.attemptId, solution.answer, solution.prediction).progress.stage).toBe('retained');
    }
  });

  test.each(['nex', 'faisca'] as const)('%s: an assisted catalogue can be learned later, without an immediate retry shortcut', gameId => {
    const { service, user, advance } = setup();
    for (let v = 0; v < 24; v++) {
      const view = service.start(user, gameId);
      service.hint(user, view.attemptId);
      const solution = getStrategyChallenge(gameId, v);
      service.answer(user, view.attemptId, solution.answer, solution.prediction);
    }
    const retry = service.start(user, gameId);
    const first = getStrategyChallenge(gameId, 0);
    expect(service.answer(user, retry.attemptId, first.answer, first.prediction).progress.independent).toBe(0);
    advance(RETENTION_DELAY_MS + 1);
    for (let v = 1; v <= 3; v++) {
      const view = service.start(user, gameId);
      const solution = getStrategyChallenge(gameId, v);
      service.answer(user, view.attemptId, solution.answer, solution.prediction);
    }
    expect(service.progress(user)[gameId].stage).toBe('independent');
  });

  test('Faísca preserves errors across reloads and mirrors do not add families', () => {
    const { service, user, db } = setup();
    const first = service.start(user, 'faisca');
    const wrong = service.answer(user, first.attemptId, '0', '0');
    const reloaded = new StrategyPracticeService(db);
    expect(reloaded.answer(user, first.attemptId, '1', '0')).toEqual(wrong);
    // Worked example: required c3 → c1, jump a2 → a5, free b2,
    // remaining distance 2 to d3, then a3 → a1 wins for Red.
    for (const answer of ['2', '0', '2', '1', '1']) {
      const view = reloaded.start(user, 'faisca');
      expect(reloaded.answer(user, view.attemptId, answer, '0').feedback?.correct).toBe(true);
    }
    expect(reloaded.progress(user).faisca.independent).toBe(5);
    for (let variant = 6; variant < 24; variant++) {
      const view = reloaded.start(user, 'faisca');
      const solution = getStrategyChallenge('faisca', variant);
      reloaded.answer(user, view.attemptId, solution.answer, solution.prediction);
    }
    expect(reloaded.progress(user).faisca.independent).toBe(6);
  });

  test('cosmetic variants and repeated copies cannot fill the three-family goal', () => {
    const evidence: StrategyEvidence[] = Array.from({ length: 10 }, (_, i) => ({
      contextId: `shifted-${i}`, familyId: 'same-shape', correct: true, assisted: false, completedAt: '2026-09-15T10:00:00Z',
    }));
    expect(getStrategyProgress(evidence).independent).toBe(1);
    expect(getStrategyProgress(evidence).stage).toBe('practice');
    expect(getStrategyProgress(evidence.concat(evidence)).independent).toBe(1);
  });
});
