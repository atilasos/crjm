import type { StrategyEvidence, StrategyProgress } from '../types/strategy-practice';

export const RETENTION_DELAY_MS = 24 * 60 * 60 * 1000;
export const INDEPENDENT_TARGET = 3;

/** Only the first encounter with a situation is evidence of transfer. */
export function getStrategyProgress(evidence: readonly StrategyEvidence[]): StrategyProgress {
  const seen = new Map<string, number>();
  const credited = new Set<string>();
  const families = new Set<string>();
  let independent = 0;
  let reviewAt: string | null = null;
  let retained = false;
  let needsPractice = false;
  const ordered = [...evidence].sort((a, b) => a.completedAt.localeCompare(b.completedAt));
  for (const item of ordered) {
    if (!Number.isFinite(Date.parse(item.completedAt))) continue;
    const time = Date.parse(item.completedAt);
    const lastSeen = seen.get(item.contextId);
    // A previously taught situation can be retrieved after a delay. An immediate
    // correction cannot be laundered into evidence by restarting or reloading.
    const eligible = lastSeen === undefined || time - lastSeen >= RETENTION_DELAY_MS;
    seen.set(item.contextId, time);
    needsPractice = !item.correct || item.assisted;
    if (!eligible || !item.correct || item.assisted) continue;
    if (reviewAt && time >= Date.parse(reviewAt)) retained = true;
    credited.add(item.contextId);
    families.add(item.familyId);
    independent = Math.min(credited.size, families.size);
    if (independent >= INDEPENDENT_TARGET && !reviewAt) {
      reviewAt = new Date(Date.parse(item.completedAt) + RETENTION_DELAY_MS).toISOString();
    }
  }
  return {
    stage: retained ? 'retained' : independent >= INDEPENDENT_TARGET ? 'independent' : evidence.length ? 'practice' : 'start',
    independent,
    practiced: evidence.length,
    reviewAt,
    needsPractice,
  };
}
