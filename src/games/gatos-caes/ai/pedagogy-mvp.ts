import type { AIResponseV1 } from '../../../ai-core';
import type { GatosCaesState, Posicao } from '../types';

export type TutorHintLevel = 'H1' | 'H2' | 'H3';

export interface QuickReviewItem {
  title: string;
  insight: string;
}

export function resolveHintLevel(
  response: AIResponseV1<Posicao, GatosCaesState> | null,
  fallback: TutorHintLevel = 'H2',
): TutorHintLevel {
  const suggested = response?.pedagogy?.hintLevelSuggested;
  return suggested === 'H1' || suggested === 'H2' || suggested === 'H3' ? suggested : fallback;
}

export function buildQuickReviewItems(
  history: Array<AIResponseV1<Posicao, GatosCaesState>>,
): QuickReviewItem[] {
  if (history.length === 0) return [];

  const ranked = [...history].sort((a, b) => (a.confidence ?? 0.5) - (b.confidence ?? 0.5));
  const weakest = ranked[0];
  const latest = history[history.length - 1];
  const unique = new Map<string, AIResponseV1<Posicao, GatosCaesState>>();

  unique.set(weakest.requestId, weakest);
  unique.set(latest.requestId, latest);

  return [...unique.values()].slice(0, 2).map((entry, index) => ({
    title: `Momento ${index + 1}`,
    insight: entry.explainText,
  }));
}
