import { useEffect, useRef, useState } from 'react';
import type { GameId } from '../ai-core/types';
import type { StrategyPracticeView, StrategyProgress, StrategyOption } from '../types/strategy-practice';
import { useTranslation } from '../i18n/LanguageProvider';
import { PuzzleDiagramView } from './PuzzleDiagramView';
import { useGamification } from './gamification/GamificationProvider';
import { GAME_LABELS } from './gamification/GameProgressBars';

export function StrategyProgressView({ progress }: { progress: StrategyProgress }) {
  const { t, locale } = useTranslation();
  const labels = {
    start: 'Experimentar uma situação',
    practice: 'Praticar e comparar',
    independent: 'Já consegues sem ajuda',
    retained: 'Conseguiste novamente noutro dia',
  };
  return (
    <div data-strategy-progress={progress.stage} className="rounded-lg border p-3 text-sm [background:var(--fundo)] [border-color:var(--linha)]">
      <p className="font-bold">{t(labels[progress.stage])}</p>
      <p className="mt-1">{t('Situações diferentes sem ajuda:')} {Math.min(3, progress.independent)}/3</p>
      {progress.reviewAt && progress.stage !== 'retained' && <p className="mt-1">{t('Volta a verificar a partir de:')} {new Date(progress.reviewAt).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' })}</p>}
      {progress.needsPractice && <p className="mt-1">{t('Vamos praticar mais esta ideia. Podes usar pistas.')}</p>}
      <p className="mt-1 text-xs [color:var(--tinta-suave)]">{t('Este registo verifica um fundamento do jogo. Usa-o também nas tuas partidas.')}</p>
    </div>
  );
}

function Choices({ legend, options, value, onChange, disabled, name }: {
  legend: string; options: StrategyOption[]; value: string; onChange: (id: string) => void; disabled: boolean; name: string;
}) {
  const { t } = useTranslation();
  return (
    <fieldset disabled={disabled} className="mt-4 min-w-0">
      <legend className="max-w-full whitespace-normal text-sm font-bold">{t(legend)}</legend>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {options.map(option => (
          <label key={option.id} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm ${value === option.id ? '[border-color:var(--ouro)] [background:var(--fundo)]' : '[border-color:var(--linha)]'}`}>
            <input type="radio" name={name} value={option.id} checked={value === option.id} onChange={() => onChange(option.id)} />
            <span>{t(option.label)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function StrategyPractice({ gameId }: { gameId: GameId }) {
  const { t } = useTranslation();
  const { isReady } = useGamification();
  const [view, setView] = useState<StrategyPracticeView | null>(null);
  const [answer, setAnswer] = useState('');
  const [prediction, setPrediction] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const locked = useRef(false);
  const mounted = useRef(true);
  const lastAction = useRef<'start' | 'hint' | 'answer'>('start');

  async function command(action: 'start' | 'hint' | 'answer') {
    if (locked.current) return;
    locked.current = true;
    lastAction.current = action;
    setBusy(true);
    setError(false);
    try {
      const response = await fetch(`/api/learner/strategy-practice/${action}`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId, attemptId: view?.attemptId, answer, prediction }),
      });
      if (!response.ok) throw new Error('practice unavailable');
      const result: { practice: StrategyPracticeView } = await response.json();
      if (!mounted.current) return;
      setView(result.practice);
      if (action === 'start') { setAnswer(''); setPrediction(''); }
    } catch {
      if (mounted.current) setError(true);
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  useEffect(() => {
    mounted.current = true;
    if (isReady) void command('start');
    return () => { mounted.current = false; };
  }, [isReady]);

  return (
    <section data-strategy-practice className="mt-6 rounded-xl border p-5 [background:var(--painel)] [border-color:var(--linha)] [color:var(--tinta)]">
      <p className="text-xs font-bold uppercase tracking-wide [color:var(--ouro)]">{t('Aprender uma estratégia')}</p>
      <h3 className="mt-1 text-xl font-bold">{t('Escolhe e prevê')}</h3>
      <p className="mt-2 text-sm [color:var(--tinta-suave)]">{t('Uma escolha e uma previsão antes da explicação. As pistas ajudam a praticar; o progresso confirma-se sem elas, em situações diferentes e noutro dia.')}</p>
      {error && <div role="alert" className="mt-3 text-sm">
        <p>{t('Não foi possível guardar ou carregar o desafio. Tenta novamente; o progresso só aparece depois de guardado.')}</p>
        <button type="button" disabled={busy} onClick={() => void command(lastAction.current)} className="mt-2 min-h-11 underline">{t('Tentar novamente')}</button>
      </div>}
      {!view && !error && <p role="status" className="mt-4">{t('A preparar a situação…')}</p>}
      {view && <>
        <div className="mt-5 grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-2">
          <article className="min-w-0">
            <h4 className="font-bold">{t(view.challenge.skill)}</h4>
            <p className="mt-2 text-sm">{t(view.challenge.prompt)}</p>
            <ul className="mt-3 list-inside list-disc space-y-1 text-sm">{view.challenge.facts.map(fact => <li key={fact}>{t(fact)}</li>)}</ul>
            {view.challenge.diagram && <div className="overflow-x-auto"><PuzzleDiagramView diagram={view.challenge.diagram} /></div>}
          </article>
          <div className="min-w-0">
            <Choices name={`answer-${view.attemptId}`} legend={view.challenge.question} options={view.challenge.options} value={answer} onChange={setAnswer} disabled={busy || !!view.feedback} />
            <Choices name={`prediction-${view.attemptId}`} legend={view.challenge.prediction} options={view.challenge.predictions} value={prediction} onChange={setPrediction} disabled={busy || !!view.feedback} />
            {!view.feedback && <div className="mt-4 flex flex-wrap gap-3">
              <button type="button" disabled={busy || !answer || !prediction} onClick={() => void command('answer')} className="min-h-12 rounded-lg px-4 py-2 font-bold [background:var(--tinta)] [color:var(--fundo)] disabled:opacity-50">{t('Conferir a minha previsão')}</button>
              {!view.hint && <button type="button" disabled={busy} onClick={() => void command('hint')} className="min-h-12 rounded-lg border px-4 py-2 font-bold [border-color:var(--ouro)]">{t('Pedir uma pista')}</button>}
            </div>}
            {view.hint && <p className="mt-3 rounded-lg border p-3 text-sm [border-color:var(--ouro)]">{t(view.hint)}</p>}
            {view.feedback && <div role="status" className="mt-4 rounded-lg border p-4 [border-color:var(--ouro)]">
              <p className="font-bold">{t(view.feedback.correct ? view.feedback.independent ? 'Boa escolha e boa previsão, sem ajuda.' : 'Boa leitura com prática.' : 'Vamos comparar com o que acontece.')}</p>
              <p className="mt-2 text-sm">{t(view.feedback.explanation)}</p>
              <button type="button" disabled={busy} onClick={() => void command('start')} className="mt-3 min-h-11 rounded-lg border px-4 py-2 font-bold [border-color:var(--linha)]">{t('Experimentar outra situação')}</button>
            </div>}
          </div>
        </div>
        <div className="mt-5"><StrategyProgressView progress={view.progress} /></div>
      </>}
    </section>
  );
}

export function StrategyProgressSummary() {
  const { t } = useTranslation();
  const { isReady } = useGamification();
  const [progress, setProgress] = useState<Partial<Record<GameId, StrategyProgress>>>({});
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!isReady) return;
    let cancelled = false;
    void fetch('/api/learner/strategy-practice/progress', { credentials: 'include' })
      .then(async response => {
        if (!response.ok) throw new Error('progress unavailable');
        const result = await response.json();
        if (!cancelled) setProgress(result.progress);
      }).catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [isReady]);
  return <section className="rounded-xl border p-5 [background:var(--painel)] [border-color:var(--linha)] [color:var(--tinta)]">
    <h2 className="text-lg font-bold">{t('O que já consigo fazer sem ajuda')}</h2>
    <p className="mt-2 text-sm">{t('Confirma os fundamentos no Laboratório: escolher, prever e voltar a conseguir noutro dia.')}</p>
    {error && <p className="mt-2 text-sm" role="status">{t('Não foi possível carregar este progresso. Volta a abrir o perfil para tentar novamente.')}</p>}
    <div className="mt-4 grid gap-4 md:grid-cols-2">{(Object.entries(progress) as [GameId, StrategyProgress][]).map(([gameId, value]) => <div key={gameId}>
      <h3 className="mb-2 font-bold">{t(GAME_LABELS[gameId])}</h3>
      <StrategyProgressView progress={value} />
    </div>)}</div>
  </section>;
}
