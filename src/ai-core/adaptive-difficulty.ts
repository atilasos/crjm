import { clampDifficultyLevel } from './difficulty';
import type { DifficultyLevel } from './types';

export interface AdaptiveDifficultyEvidence {
  criticalDecisions: number;
  successfulCriticalDecisions: number;
  hintsUsed: number;
  repeatedErrors: number;
  frustrationSignals?: number;
  changedThisSession?: boolean;
}

export interface AdaptiveDecisionEvidence {
  successful: boolean;
  usedHint?: boolean;
  repeatedError?: boolean;
  frustrationSignal?: boolean;
}

export interface DifficultyRecommendation {
  currentLevel: DifficultyLevel;
  recommendedLevel: DifficultyLevel;
  direction: 'up' | 'down' | 'keep';
  successRate: number | null;
  reason: string;
}

const MIN_CRITICAL_DECISIONS = 4;
const TARGET_MIN = 0.4;
const TARGET_MAX = 0.6;

export function createAdaptiveEvidence(): AdaptiveDifficultyEvidence {
  return {
    criticalDecisions: 0,
    successfulCriticalDecisions: 0,
    hintsUsed: 0,
    repeatedErrors: 0,
    frustrationSignals: 0,
    changedThisSession: false,
  };
}

export function recordAdaptiveDecision(
  current: AdaptiveDifficultyEvidence,
  decision: AdaptiveDecisionEvidence,
): AdaptiveDifficultyEvidence {
  return {
    criticalDecisions: safeCount(current.criticalDecisions) + 1,
    successfulCriticalDecisions:
      safeCount(current.successfulCriticalDecisions) + (decision.successful ? 1 : 0),
    hintsUsed: safeCount(current.hintsUsed) + (decision.usedHint ? 1 : 0),
    repeatedErrors: safeCount(current.repeatedErrors) + (decision.repeatedError ? 1 : 0),
    frustrationSignals:
      safeCount(current.frustrationSignals ?? 0) + (decision.frustrationSignal ? 1 : 0),
    changedThisSession: current.changedThisSession ?? false,
  };
}

function safeCount(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

export function recommendDifficulty(
  currentLevel: number | DifficultyLevel,
  evidence: AdaptiveDifficultyEvidence,
): DifficultyRecommendation {
  const current = clampDifficultyLevel(currentLevel);
  const decisions = safeCount(evidence.criticalDecisions);
  const successes = Math.min(decisions, safeCount(evidence.successfulCriticalDecisions));
  const hints = safeCount(evidence.hintsUsed);
  const repeatedErrors = safeCount(evidence.repeatedErrors);
  const frustrationSignals = safeCount(evidence.frustrationSignals ?? 0);
  const successRate = decisions > 0 ? successes / decisions : null;

  const keep = (reason: string): DifficultyRecommendation => ({
    currentLevel: current,
    recommendedLevel: current,
    direction: 'keep',
    successRate,
    reason,
  });

  if (evidence.changedThisSession) {
    return keep('O nível já foi ajustado nesta sessão.');
  }
  if (decisions < MIN_CRITICAL_DECISIONS || successRate === null) {
    return keep('Ainda são necessárias mais decisões para recomendar uma mudança.');
  }

  const shouldLower =
    frustrationSignals > 0 ||
    successRate < TARGET_MIN ||
    repeatedErrors >= 2;
  if (shouldLower) {
    const next = clampDifficultyLevel(current - 1);
    if (next === current) return keep('N1 já oferece o apoio máximo.');
    return {
      currentLevel: current,
      recommendedLevel: next,
      direction: 'down',
      successRate,
      reason: 'Mais apoio pode ajudar a consolidar este padrão sem frustração.',
    };
  }

  const shouldRaise = successRate > TARGET_MAX && hints === 0 && repeatedErrors === 0;
  if (shouldRaise) {
    const next = clampDifficultyLevel(current + 1);
    if (next === current) return keep('N5 já é o desafio máximo.');
    return {
      currentLevel: current,
      recommendedLevel: next,
      direction: 'up',
      successRate,
      reason: 'As decisões autónomas estão consistentes; o nível seguinte é um bom desafio.',
    };
  }

  return keep('O desafio está adequado ao desempenho observado.');
}
