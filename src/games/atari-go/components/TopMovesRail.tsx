import type { AIMoveCandidate } from '../../../ai-core';
import type { Posicao } from '../types';

interface TopMovesRailProps {
  moves: AIMoveCandidate<Posicao>[];
  isLoading?: boolean;
}

function formatMove(move: Posicao): string {
  return `(${move.linha + 1},${move.coluna + 1})`;
}

export function TopMovesRail({ moves, isLoading = false }: TopMovesRailProps) {
  if (isLoading) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white px-4 py-3">
        <p className="text-sm text-slate-600">A calcular melhores jogadas...</p>
      </section>
    );
  }

  if (moves.length === 0) {
    return null;
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Top jogadas
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {moves.slice(0, 3).map((candidate) => (
          <div
            key={`${candidate.rank}-${formatMove(candidate.move)}`}
            className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-700"
          >
            <p className="font-semibold text-slate-900">#{candidate.rank} {formatMove(candidate.move)}</p>
            {candidate.reasonShort && <p className="mt-1">{candidate.reasonShort}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}
