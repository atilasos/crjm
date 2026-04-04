import type { GameId } from '../ai-core/types';
import { getTrainingPath } from '../ai-core/training-paths';

interface TrainingPathCardProps {
  gameId: GameId;
}

export function TrainingPathCard({ gameId }: TrainingPathCardProps) {
  const path = getTrainingPath(gameId);

  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold">Caminho de evolução</p>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
          treino de campeonato
        </span>
      </div>
      <p className="mt-2">
        <strong>Foco agora:</strong> {path.focusNow}
      </p>
      <p className="mt-1">
        <strong>Erro a evitar:</strong> {path.commonMistake}
      </p>
      <div className="mt-3 grid gap-2 md:grid-cols-3">
        {path.steps.map((step) => (
          <div key={step.title} className="rounded-lg border border-amber-200 bg-white px-3 py-2">
            <p className="font-semibold text-amber-900">{step.title}</p>
            <ul className="mt-1 space-y-1 text-xs text-amber-900/90">
              {step.checkpoints.map((checkpoint) => (
                <li key={checkpoint}>• {checkpoint}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
