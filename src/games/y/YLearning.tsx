import { useEffect, useRef, useState } from 'react';
import { ThinkingTutor, useThinkingTutor } from '../../components/tutor/ThinkingTutor';
import { useGamification } from '../../components/gamification/GamificationProvider';
import { useTranslation } from '../../i18n/LanguageProvider';
import { requestYMove } from './ai/ai-client';
import { aplicarJogada, getGrupo } from './logic';
import { YBoard } from './YBoard';
import type { YMove, YState } from './types';

const PATTERN = 'y:tres-lados';
export interface YDecision { state: YState; move: YMove; turn: number }

function useYExample(state: YState, enabled: boolean) {
  const [move, setMove] = useState<YMove | null>(null);
  const [error, setError] = useState(false);
  const [attempt, retry] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    setMove(null);
    setError(false);
    void requestYMove({ version: '1.0', requestId: crypto.randomUUID(), gameId: 'y', mode: 'tutor', state, level: 2, seed: 33 }, controller.signal)
      .then(response => {
        if (controller.signal.aborted) return;
        if (!response.bestMove || aplicarJogada(state, response.bestMove) === state) { setError(true); return; }
        setMove(response.bestMove);
      }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [state, enabled, attempt]);
  return { move, error, retry: () => retry(value => value + 1) };
}

/** Facts come from the rules and their graph, never the engine's evaluation. */
function Consequence({ state, move }: { state: YState; move: YMove }) {
  const { t, msg } = useTranslation();
  const next = aplicarJogada(state, move);
  if (next === state) return null;
  const player = state.jogadorAtual;
  const name = t(player === 'jogador1' ? 'Jogador 1' : 'Jogador 2');
  const color = t(next.cores[player] === 'azul' ? 'Azul' : 'Vermelho');
  const group = move.type === 'place' ? getGrupo(next.tabuleiro, move.node) : null;
  const sides = group ? [...group.lados].map(side => t(side === 'superior' ? 'Lado superior' : side === 'esquerdo' ? 'Lado esquerdo' : 'Lado direito')).join(', ') : '';
  return <div className="rounded-lg border p-3 [border-color:var(--linha)]">
    <h4 className="font-bold">{t('Consequência verificada pelas regras')}</h4>
    {move.type === 'place' && group ? <>
      <p>{msg('{0} coloca {1} em {2}.', [name, color, move.node])}</p>
      <p>{msg('Grupo ligado à peça colocada: {0}.', [[...group.nos].sort().join(', ')])}</p>
      <p>{msg('Este único grupo toca {0} lados: {1}.', [group.lados.size, sides || t('Nenhum lado')])}</p>
    </> : <>
      <p>{t('Trocar de cores')}</p>
      <p>{t('A peça inicial mantém a posição. Jogador 2 passa a Azul; Jogador 1 passa a Vermelho e joga a seguir.')}</p>
    </>}
    <p>{next.estado !== 'a-jogar'
      ? msg('Vitória demonstrada: {0}, com {1}, ligou os três lados num único grupo.', [name, color])
      : t('Esta ação não termina a partida. A recomendação não prova uma vitória futura.')}</p>
  </div>;
}

/** Keyed by match and action count, which includes a swap without placement. */
export function YTutor({ state, turn }: { state: YState; turn: string }) {
  const { t, msg } = useTranslation();
  const { recordPatternProgress } = useGamification();
  const thinking = useThinkingTutor(turn);
  const example = useYExample(state, thinking.showSolution);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const active = useRef(true);
  const saving = useRef(false);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);

  async function requestHint() {
    if (saving.current) return;
    saving.current = true;
    setPending(true);
    setError(false);
    const saved = await recordPatternProgress({ gameId: 'y', patternId: PATTERN, evidence: 'used_with_help', contextId: turn });
    if (!active.current) return;
    saving.current = false;
    setPending(false);
    if (saved) thinking.requestHint();
    else setError(true);
  }

  return <div className="my-4" data-y-learning>
    <p className="mb-2">{msg('A pensar como {0}, com {1}.', [t(state.jogadorAtual === 'jogador1' ? 'Jogador 1' : 'Jogador 2'), t(state.cores[state.jogadorAtual] === 'azul' ? 'Azul' : 'Vermelho')])}</p>
    <ThinkingTutor gameId="y" tutor={{ ...thinking, requestHint }} solutionReady={!!example.move}>
      {example.move && <>
        <p>{t('Pista do computador: este exemplo não garante vitória.')}</p>
        <Consequence state={state} move={example.move} />
      </>}
    </ThinkingTutor>
    {pending && <p role="status">{t('A guardar a ajuda…')}</p>}
    {(error || example.error) && <div role="alert">
      <p>{t('Não foi possível guardar a atividade ou preparar o exemplo. Tenta novamente.')}</p>
      {example.error && <button className="btn btn-secondary" onClick={example.retry}>{t('Tentar novamente')}</button>}
    </div>}
  </div>;
}

export function YReview({ decision, matchId }: { decision: YDecision; matchId: string }) {
  const { t, msg } = useTranslation();
  const { recordReviewCompleted, recordPatternProgress } = useGamification();
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const saving = useRef(false);
  const { state, move } = decision;
  const example = useYExample(state, true);
  const same = example.move && (move.type === 'swap' ? example.move.type === 'swap' : example.move.type === 'place' && example.move.node === move.node);

  async function saveReview() {
    if (saving.current || saved) return;
    saving.current = true;
    setPending(true);
    setError(false);
    const patternSaved = await recordPatternProgress({ gameId: 'y', patternId: PATTERN, evidence: 'seen', contextId: matchId });
    const reviewSaved = patternSaved && await recordReviewCompleted('y', matchId);
    setSaved(reviewSaved);
    setError(!reviewSaved);
    setPending(false);
    saving.current = false;
  }

  return <section data-y-learning aria-label={t('Revisão rápida pós-jogo')} className="my-4 rounded-xl border p-4 [border-color:var(--linha)]">
    <h3 className="font-bold">{t('Revisão rápida pós-jogo')}</h3>
    <p>{msg('A tua decisão: turno {0}, {1}, com {2}.', [decision.turn, t(state.jogadorAtual === 'jogador1' ? 'Jogador 1' : 'Jogador 2'), t(state.cores[state.jogadorAtual] === 'azul' ? 'Azul' : 'Vermelho')])}</p>
    <details className="my-3">
      <summary className="min-h-11 cursor-pointer">{t('Ver a posição antes da decisão')}</summary>
      <YBoard state={state} />
      {(['jogador1', 'jogador2'] as const).map(player => <p key={player}>{msg('{0}: {1}', [t(player === 'jogador1' ? 'Jogador 1' : 'Jogador 2'), t(state.cores[player] === 'azul' ? 'Azul' : 'Vermelho')])}</p>)}
    </details>
    <section aria-label={t('Jogada realizada')}>
      <h4 className="font-bold mt-3">{t('Jogada realizada')}</h4>
      <Consequence state={state} move={move} />
    </section>
    <h4 className="font-bold mt-3">{t('Recomendação do computador')}</h4>
    <p>{t('O computador estima ligações futuras. Só as ligações já formadas demonstram os lados alcançados.')}</p>
    {same ? <p>{t('A recomendação coincide com a jogada realizada.')}</p>
      : example.move ? <Consequence state={state} move={example.move} />
        : !example.error && <p role="status">{t('A preparar o exemplo. Podes continuar a jogar.')}</p>}
    {example.error && <div role="alert">
      <p>{t('Não foi possível guardar a atividade ou preparar o exemplo. Tenta novamente.')}</p>
      <button className="btn btn-secondary" onClick={example.retry}>{t('Tentar novamente')}</button>
    </div>}
    <p className="my-3">{t('Explica que grupos e lados esta decisão ligou e o que ficou por ligar. Esta revisão é prática orientada.')}</p>
    <button className="btn btn-secondary" disabled={pending || saved || !example.move} onClick={saveReview}>
      {t(saved ? 'Revisão registada' : pending ? 'A guardar a revisão…' : 'Marcar revisão concluída (+10 XP)')}
    </button>
    {error && <p role="alert">{t('Não foi possível guardar a atividade ou preparar o exemplo. Tenta novamente.')}</p>}
  </section>;
}
