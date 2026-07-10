import { PATTERN_CARDS, type PatternCardDefinition } from './gamification';
import type { GameId } from './types';

export interface ReviewPatternSignals {
  explainText?: string;
  criticalThreats?: ReadonlyArray<unknown>;
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

function card(id: string): PatternCardDefinition {
  const match = PATTERN_CARDS.find((item) => item.id === id);
  if (!match) throw new Error(`unknown review pattern: ${id}`);
  return match;
}

export function selectReviewPattern(
  gameId: GameId,
  signals: ReviewPatternSignals | null | undefined = undefined,
): PatternCardDefinition {
  const text = signals?.explainText?.toLocaleLowerCase('pt-PT') ?? '';
  let patternId = DEFAULT_PATTERN[gameId];

  if (gameId === 'gatos-caes') {
    if (text.includes('garantid')) patternId = 'gatos-caes:jogada-garantida';
    else if (text.includes('disputa') || text.includes('bloque')) patternId = 'gatos-caes:casa-em-disputa';
  } else if (gameId === 'dominorio') {
    if (text.includes('corredor')) patternId = 'dominorio:corredor';
    else if (text.includes('corte') || text.includes('zona')) patternId = 'dominorio:corte';
    else if (text.includes('espelh')) patternId = 'dominorio:espelhamento';
  } else if (gameId === 'quelhas') {
    if (text.includes('isol')) patternId = 'quelhas:isolamento-forcado';
    else if (text.includes('fratur') || text.includes('componente')) patternId = 'quelhas:fratura';
    else if (text.includes('simetr')) patternId = 'quelhas:simetria';
  } else if (gameId === 'produto') {
    if (text.includes('fusão') || text.includes('fusao') || text.includes('sabot')) patternId = 'produto:fusao-adversaria';
    else if (text.includes('isol')) patternId = 'produto:grupo-isolado';
  } else if (gameId === 'atari-go') {
    const turningPointIds = signals?.turningPoints?.map((item) => item.patternId ?? '') ?? [];
    if (text.includes('snapback')) patternId = 'atari-go:snapback';
    else if (text.includes('escada') || text.includes('ladder')) patternId = 'atari-go:ladder';
    else if (text.includes('duplo') || text.includes('double')) patternId = 'atari-go:double-atari';
    else if (text.includes('rede') || text.includes('net')) patternId = 'atari-go:net';
    else if (turningPointIds.some((id) => id.includes('ATARI'))) patternId = 'atari-go:atari';
  } else if (gameId === 'nex') {
    const threats = signals?.criticalThreats?.length ?? 0;
    if (threats >= 3 || text.includes('tripla')) patternId = 'nex:tripla-ameaca';
    else if (threats >= 2 || text.includes('dupla')) patternId = 'nex:ameaca-dupla';
    else if (text.includes('centro') || text.includes('central')) patternId = 'nex:bloqueio-central';
  }

  return card(patternId);
}
