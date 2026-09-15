import { PATTERN_CARDS, type PatternCardDefinition } from './gamification';
import type { GameId } from './types';

export interface ReviewPatternSignals {
  reviewPatternId?: string;
  /** Display text is deliberately ignored when classifying evidence. */
  explainText?: string;
  criticalThreats?: ReadonlyArray<{ id?: string }>;
  turningPoints?: ReadonlyArray<{ patternId?: string }>;
}

const DEFAULT_PATTERN: Record<GameId, string> = {
  'gatos-caes': 'gatos-caes:centro',
  dominorio: 'dominorio:paridade',
  quelhas: 'quelhas:misere-final',
  produto: 'produto:equilibrio',
  'atari-go': 'atari-go:atari',
  nex: 'nex:ponte',
};

export function selectReviewPattern(
  gameId: GameId,
  signals: ReviewPatternSignals | null | undefined = undefined,
): PatternCardDefinition {
  const threats = signals?.criticalThreats ?? [];
  const candidates = [
    signals?.reviewPatternId,
    ...(signals?.turningPoints?.map(item => item.patternId) ?? []),
    ...(gameId === 'nex' && threats.length >= 2
      ? [threats.length >= 3 ? 'nex:tripla-ameaca' : 'nex:ameaca-dupla'] : []),
    DEFAULT_PATTERN[gameId],
  ];
  for (const id of candidates) {
    const match = PATTERN_CARDS.find(item => item.id === id && item.gameId === gameId);
    if (match) return match;
  }
  throw new Error(`missing default review pattern: ${gameId}`);
}
