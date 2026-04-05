import type { AIResponseV1 } from './types';

export interface TutorContextItem {
  label: string;
  tone: 'info' | 'success' | 'warning' | 'danger';
}

export function buildTutorContextItems<Move, State>(
  response: AIResponseV1<Move, State> | null,
): TutorContextItem[] {
  if (!response) return [];

  const items: TutorContextItem[] = [];

  if (response.stats.engine === 'rust-wasm') {
    items.push({ label: 'Análise WASM', tone: 'success' });
  } else {
    items.push({ label: 'Fallback TS', tone: 'warning' });
  }

  if ((response.criticalThreats?.length ?? 0) > 0) {
    const severe = response.criticalThreats?.some((threat) => threat.severity === 'high');
    items.push({ label: severe ? 'Ameaça crítica' : 'Atenção tática', tone: severe ? 'danger' : 'warning' });
  }

  const confidence = response.confidence ?? 0;
  if (confidence >= 0.75) {
    items.push({ label: 'Plano forte', tone: 'success' });
  } else if (confidence >= 0.45) {
    items.push({ label: 'Plano estável', tone: 'info' });
  } else {
    items.push({ label: 'Plano frágil', tone: 'warning' });
  }

  if ((response.topMoves?.length ?? 0) <= 1) {
    items.push({ label: 'Linha forçada', tone: 'danger' });
  } else if ((response.topMoves?.length ?? 0) >= 3) {
    items.push({ label: '3 opções úteis', tone: 'info' });
  }

  return items;
}
