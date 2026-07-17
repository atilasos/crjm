import type { AIMoveCandidate } from '../../../ai-core';
import type { NexAiAction } from '../ai/types';

interface TopMovesRailProps {
  moves: AIMoveCandidate<NexAiAction>[];
  isLoading?: boolean;
}

function formatPos(pos: { x: number; y: number }): string {
  return `(${pos.x + 1},${pos.y + 1})`;
}

function formatMove(move: NexAiAction): string {
  if (move.type === 'swap') return 'Fazer swap';
  if (move.type === 'recusar_swap') return 'Recusar swap';
  if (move.type === 'substituir') {
    return `Substituir ${formatPos(move.n1)} + ${formatPos(move.n2)} / ${formatPos(move.sacrifice)}`;
  }
  return `Própria ${formatPos(move.own)} + neutra ${formatPos(move.neutral)}`;
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
            className="rounded-lg border [border-color:var(--linha)] [background:var(--fundo)] px-3 py-2 text-xs [color:var(--tinta-suave)]"
          >
            <p className="font-semibold [color:var(--tinta)]">#{candidate.rank} {formatMove(candidate.move)}</p>
            {candidate.reasonShort && <p className="mt-1">{candidate.reasonShort}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}
