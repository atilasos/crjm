import type { AIMoveCandidate } from '../../../ai-core';
import type { Domino } from '../types';

interface TopMovesRailProps {
  moves: AIMoveCandidate<Domino>[];
  isLoading?: boolean;
}

function formatMove(move: Domino): string {
  const l1 = move.pos1.linha + 1;
  const c1 = move.pos1.coluna + 1;
  const l2 = move.pos2.linha + 1;
  const c2 = move.pos2.coluna + 1;
  return `(${l1},${c1})-(${l2},${c2})`;
}

export function TopMovesRail({ moves, isLoading = false }: TopMovesRailProps) {
  if (isLoading) {
    return (
      <section className="rounded-xl border px-4 py-3 [background:var(--painel)] [border-color:var(--linha)]">
        <p className="text-sm [color:var(--tinta-suave)]">A calcular melhores jogadas...</p>
      </section>
    );
  }

  if (moves.length === 0) {
    return null;
  }

  return (
    <section className="rounded-xl border px-4 py-3 [background:var(--painel)] [border-color:var(--linha)]">
      <p className="text-xs font-semibold uppercase tracking-wide [color:var(--tinta-suave)]">
        Top jogadas
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {moves.slice(0, 3).map((candidate) => (
          <div
            key={`${candidate.rank}-${formatMove(candidate.move)}`}
            className="rounded-lg border px-3 py-2 text-xs [border-color:var(--linha)] [background:var(--fundo)] [color:var(--tinta-suave)]"
          >
            <p className="font-semibold [color:var(--tinta)]">Opção #{candidate.rank}</p>
            <p className="mt-1 text-[11px] [color:var(--tinta-suave)]">
              Segmento: {formatMove(candidate.move)}
            </p>
            {candidate.reasonShort && <p className="mt-1">{candidate.reasonShort}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}
