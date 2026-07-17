import type { AIMoveCandidate } from '../../../ai-core';
import type { Posicao } from '../types';

interface TopMovesRailProps {
  moves: AIMoveCandidate<Posicao>[];
  isLoading?: boolean;
}

function formatMove(move: Posicao): string {
  return `L${move.linha + 1} C${move.coluna + 1}`;
}

export function TopMovesRail({ moves, isLoading = false }: TopMovesRailProps) {
  if (isLoading) {
    return (
      <section className="rounded-xl border [border-color:var(--linha)] [background:var(--painel)] px-4 py-3">
        <p className="text-sm [color:var(--tinta-suave)]">A calcular melhores jogadas...</p>
      </section>
    );
  }

  if (moves.length === 0) {
    return null;
  }

  return (
    <section className="rounded-xl border [border-color:var(--linha)] [background:var(--painel)] px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide [color:var(--tinta-suave)]">
        Top jogadas
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {moves.slice(0, 3).map((candidate) => (
          <div
            key={`${candidate.rank}-${formatMove(candidate.move)}`}
            className="rounded-lg border [border-color:var(--linha)] [background:color-mix(in_srgb,var(--tinta)_5%,var(--painel))] px-3 py-2 text-xs [color:var(--tinta-suave)]"
          >
            <p className="font-semibold [color:var(--tinta)]">#{candidate.rank} {formatMove(candidate.move)}</p>
            {candidate.reasonShort && <p className="mt-1">{candidate.reasonShort}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}
