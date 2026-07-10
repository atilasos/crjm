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
    <fieldset className="rounded-2xl border border-sky-200 bg-sky-50/80 p-3 shadow-sm">
      <legend className="px-1 text-sm font-semibold text-slate-800">{label}</legend>
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
              className={`min-h-12 rounded-xl border px-1 py-1.5 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2 ${
                active
                  ? 'border-sky-700 bg-sky-700 text-white shadow-md'
                  : 'border-sky-200 bg-white text-slate-700 hover:border-sky-400 hover:bg-sky-100'
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              <span className="block text-sm font-black leading-none">N{candidate}</span>
              <span className={`mt-1 block truncate text-[10px] font-medium leading-none ${active ? 'text-sky-50' : 'text-slate-500'}`}>
                {profile.label}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs leading-relaxed text-slate-600" aria-live="polite">
        <strong className="text-slate-800">N{level} · {selected.label}</strong>
        {' — '}a IA pensa até {formatBudget(selected.timeBudgetMs)} por jogada.
      </p>
      {recommendation && (
        <div className="mt-2 rounded-xl border border-dashed border-teal-300 bg-white/80 p-2 text-xs text-slate-600">
          <p>
            <strong className="text-teal-800">Adaptativo:</strong>{' '}
            {recommendation.reason}
          </p>
          {recommendation.recommendedLevel !== level && onAcceptRecommendation && (
            <button
              type="button"
              disabled={!canAcceptRecommendation}
              onClick={() => onAcceptRecommendation(recommendation.recommendedLevel)}
              className="mt-2 min-h-12 w-full rounded-lg bg-teal-700 px-3 py-2 font-semibold text-white transition-colors hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
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
