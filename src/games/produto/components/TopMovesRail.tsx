import type { AIMoveCandidate } from '../../../ai-core';
import type { JogadaDupla } from '../types';

interface TopMovesRailProps {
  moves: AIMoveCandidate<JogadaDupla>[];
  isLoading?: boolean;
}

function formatMove(move: JogadaDupla): string {
  const first = `${move.cor1} ${formatPos(move.pos1)}`;
  if (!move.pos2 || !move.cor2) return first;
  return `${first} + ${move.cor2} ${formatPos(move.pos2)}`;
}

function formatPos(pos: JogadaDupla['pos1']): string {
  return `(${pos.q},${pos.r})`;
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
