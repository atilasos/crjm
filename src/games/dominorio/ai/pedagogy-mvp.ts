import type { AIResponseV1 } from '../../../ai-core';
import type { DominorioState, Domino } from '../types';

export type TutorHintLevel = 'H1' | 'H2' | 'H3';

export interface HintAdjustmentSignals {
  struggleStreak: number;
  stableStreak: number;
  h3Streak: number;
}

export interface QuickReviewItem {
  title: string;
  insight: string;
}

function increaseHintLevel(level: TutorHintLevel): TutorHintLevel {
  if (level === 'H1') return 'H2';
  if (level === 'H2') return 'H3';
  return 'H3';
}

function decreaseHintLevel(level: TutorHintLevel): TutorHintLevel {
  if (level === 'H3') return 'H2';
  if (level === 'H2') return 'H1';
  return 'H1';
}

export function computeAdaptiveHintLevel(
  response: AIResponseV1<Domino, DominorioState>,
  currentLevel: TutorHintLevel,
  signals: HintAdjustmentSignals,
): TutorHintLevel {
  const suggested = response.pedagogy?.hintLevelSuggested;
  let next: TutorHintLevel =
    suggested === 'H1' || suggested === 'H2' || suggested === 'H3' ? suggested : currentLevel;
  const severeThreat = response.criticalThreats?.some((threat) => threat.severity === 'high');
  const confidence = response.confidence ?? 0.5;

  // Subida: repetição de dificuldades, ameaça alta ou confiança baixa.
  if (signals.struggleStreak >= 2 || severeThreat || confidence < 0.45) {
    next = increaseHintLevel(next);
  }

  // Descida: estabilidade com confiança alta.
  if (!severeThreat && signals.stableStreak >= 3 && confidence >= 0.75) {
    next = decreaseHintLevel(next);
  }

  // Evitar dependência de H3 prolongada.
  if (currentLevel === 'H3' && next === 'H3' && signals.h3Streak >= 4 && signals.stableStreak >= 1) {
    next = 'H2';
  }

  return next;
}

export function buildQuickReviewItems(
  history: Array<AIResponseV1<Domino, DominorioState>>,
): QuickReviewItem[] {
  if (history.length === 0) return [];

  const ranked = [...history].sort((a, b) => (a.confidence ?? 0.5) - (b.confidence ?? 0.5));
  const weakest = ranked[0];
  const latest = history[history.length - 1];
  const dedup = new Map<string, AIResponseV1<Domino, DominorioState>>();

  dedup.set(weakest.requestId, weakest);
  dedup.set(latest.requestId, latest);

  return [...dedup.values()].slice(0, 2).map((entry, idx) => ({
    title: `Momento ${idx + 1}`,
    insight: entry.explainText,
  }));
}

