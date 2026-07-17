import type { GameId } from '../ai-core/types';
import { getTrainingPath } from '../ai-core/training-paths';

interface TrainingPathCardProps {
  gameId: GameId;
}

export function TrainingPathCard({ gameId }: TrainingPathCardProps) {
  const path = getTrainingPath(gameId);

  return (
    <section className="rounded-xl border px-4 py-3 text-sm [background:var(--painel)] [border-color:var(--linha)] [box-shadow:var(--sombra)] [color:var(--tinta)]">
      <div className="flex items-center justify-between gap-3">
        <p className="font-bold">Caminho de evolução</p>
        <span className="rounded-full border px-2 py-0.5 text-xs font-bold [border-color:var(--ouro)] [color:var(--tinta-suave)]">
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
          <div key={step.title} className="rounded-lg border px-3 py-2 [background:var(--fundo)] [border-color:var(--linha)]">
            <p className="font-bold [color:var(--tinta)]">{step.title}</p>
            <ul className="mt-1 space-y-1 text-xs [color:var(--tinta-suave)]">
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
