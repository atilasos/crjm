import { DIFFICULTY_PROFILES } from '../ai-core/difficulty';
import type { DifficultyLevel } from '../ai-core/types';
import type { DifficultyRecommendation } from '../ai-core/adaptive-difficulty';

interface DifficultySelectorProps {
  level: DifficultyLevel;
  onChange: (level: DifficultyLevel) => void;
  disabled?: boolean;
  label?: string;
  recommendation?: DifficultyRecommendation;
  canAcceptRecommendation?: boolean;
  onAcceptRecommendation?: (level: DifficultyLevel) => void;
}

const LEVELS: DifficultyLevel[] = [1, 2, 3, 4, 5];

function formatBudget(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  return `${ms / 1000} s`;
}

export function DifficultySelector({
  level,
  onChange,
  disabled = false,
  label = 'Desafio da IA',
  recommendation,
  canAcceptRecommendation = false,
  onAcceptRecommendation,
}: DifficultySelectorProps) {
  const selected = DIFFICULTY_PROFILES[level];

  return (
    <fieldset className="rounded-xl border p-3 [background:var(--painel)] [border-color:var(--linha)] [box-shadow:var(--sombra)]">
      <legend className="px-1 text-sm font-bold [color:var(--tinta)]">{label}</legend>
      <div className="grid grid-cols-5 gap-1.5" aria-label="Escolher nível de dificuldade">
        {LEVELS.map((candidate) => {
          const profile = DIFFICULTY_PROFILES[candidate];
          const active = candidate === level;
          return (
            <button
              key={candidate}
              type="button"
              disabled={disabled}
              aria-pressed={active}
              aria-label={`N${candidate}, ${profile.label}, até ${formatBudget(profile.timeBudgetMs)}`}
              onClick={() => onChange(candidate)}
              className={`min-h-12 rounded-lg border px-1 py-1.5 text-center transition-colors ${
                active
                  ? '[background:var(--tinta)] [border-color:var(--tinta)] [color:var(--fundo)]'
                  : '[background:transparent] [border-color:var(--linha)] [color:var(--tinta)] hover:[border-color:var(--tinta-suave)]'
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              <span className="block text-sm font-black leading-none">N{candidate}</span>
              <span
                className={`mt-1 block truncate text-[10px] font-medium leading-none ${
                  active ? 'opacity-80' : '[color:var(--tinta-suave)]'
                }`}
              >
                {profile.label}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs leading-relaxed [color:var(--tinta-suave)]" aria-live="polite">
        <strong className="[color:var(--tinta)]">N{level} · {selected.label}</strong>
        {' — '}a IA pensa até {formatBudget(selected.timeBudgetMs)} por jogada.
      </p>
      {recommendation && (
        <div className="mt-2 rounded-lg border border-dashed p-2 text-xs [border-color:var(--linha)] [color:var(--tinta-suave)]">
          <p>
            <strong className="[color:var(--sucesso)]">Adaptativo:</strong>{' '}
            {recommendation.reason}
          </p>
          {recommendation.recommendedLevel !== level && onAcceptRecommendation && (
            <button
              type="button"
              disabled={!canAcceptRecommendation}
              onClick={() => onAcceptRecommendation(recommendation.recommendedLevel)}
              className="mt-2 min-h-12 w-full rounded-lg px-3 py-2 font-bold text-white transition-colors [background:var(--sucesso)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-100 disabled:[background:var(--linha)] disabled:[color:var(--tinta-suave)]"
            >
              {canAcceptRecommendation
                ? `Usar N${recommendation.recommendedLevel} na próxima partida`
                : `N${recommendation.recommendedLevel} disponível no fim da partida`}
            </button>
          )}
        </div>
      )}
    </fieldset>
  );
}
