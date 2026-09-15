import { useState, type ReactNode } from 'react';
import { advanceThinking, thinkingLevel, THINKING_PROMPTS, type ThinkingState } from '../../ai-core/thinking-tutor';
import type { GameId } from '../../ai-core/types';
import { useTranslation } from '../../i18n/LanguageProvider';

export function useThinkingTutor(turn: string) {
  const [state, setState] = useState<ThinkingState>({ turn, level: 0 });
  const level = thinkingLevel(state, turn);
  return {
    level,
    usedHint: level > 0,
    showSolution: level === 3,
    requestHint: () => setState(current => advanceThinking(current, turn)),
    reset: () => setState({ turn, level: 0 }),
  };
}

export function ThinkingTutor({ gameId, tutor, children, solutionReady }: {
  gameId: GameId;
  tutor: ReturnType<typeof useThinkingTutor>;
  children: ReactNode;
  solutionReady: boolean;
}) {
  const { t } = useTranslation();
  const prompt = THINKING_PROMPTS[gameId];
  return (
    <section data-thinking-tutor data-hint-level={tutor.level} className="rounded-xl border p-4 [background:var(--painel)] [border-color:var(--linha)] [color:var(--tinta)]">
      <h3 className="font-bold">{t('Pensa, joga, confere')}</h3>
      <p className="mt-2 text-sm">{t(prompt.question)}</p>
      <p className="mt-1 text-xs [color:var(--tinta-suave)]">{t('Podes apontar no tabuleiro ou explicar em voz alta. Pede ajuda quando precisares.')}</p>
      <div aria-live="polite" className="mt-3 space-y-2 text-sm">
        {tutor.level >= 1 && <p>{t(prompt.principle)}</p>}
        {tutor.level >= 2 && <p>{t(prompt.compare)}</p>}
      </div>
      {!tutor.showSolution && (
        <button type="button" onClick={tutor.requestHint} className="mt-3 min-h-11 rounded-lg border px-4 py-2 text-sm font-bold [border-color:var(--ouro)]">
          {t(tutor.level === 0 ? 'Pedir uma pista' : tutor.level === 1 ? 'Ajudar a comparar' : 'Ver um exemplo de jogada')}
        </button>
      )}
      {tutor.showSolution && (
        <div data-tutor-solution className="mt-3 space-y-3">
          <p className="text-sm font-medium">{t('Observa o exemplo e prevê a resposta do adversário. Na próxima jogada, começa com uma ideia tua.')}</p>
          {!solutionReady && <p role="status" className="text-sm">{t('A preparar o exemplo. Podes continuar a jogar.')}</p>}
          {children}
        </div>
      )}
    </section>
  );
}
