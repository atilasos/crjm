import { useEffect, useRef, useState } from 'react';
import { ThinkingTutor, useThinkingTutor } from '../../components/tutor/ThinkingTutor';
import { useGamification } from '../../components/gamification/GamificationProvider';
import { useTranslation } from '../../i18n/LanguageProvider';
import { requestFaiscaMove } from './ai/ai-client';
import { colocarPeca, getDestino, getJogadasValidas, isJogadaValida } from './logic';
import type { Casa, FaiscaState, Jogada } from './types';

const PATTERN = 'faisca:proxima-casa';
const arrows = { cima: '▲', direita: '▶', baixo: '▼', esquerda: '◀' };
const directions = { cima: 'Cima', direita: 'Direita', baixo: 'Baixo', esquerda: 'Esquerda' };
const coordinate = (casa: Casa) => `${String.fromCharCode(97 + casa.coluna)}${5 - casa.linha}`;

export interface FaiscaDecision { state: FaiscaState; move: Jogada; turn: number }

function Consequence({ state, move }: { state: FaiscaState; move: Jogada }) {
  const { t, msg } = useTranslation();
  if (!isJogadaValida(state, move)) return null;
  const next = colocarPeca(state, move);
  const replies = getJogadasValidas(next).length;
  return <div className="rounded-lg border p-3 [border-color:var(--linha)]">
    <p>{msg('Colocar em {0}: distância {1}, {2} → {3}.', [coordinate(move.casa), move.distancia, t(directions[move.direcao]), coordinate(getDestino(move))])}</p>
    <p>{msg('Consequência verificada pelas regras: {0} respostas legais para o adversário.', [replies])}</p>
    <p>{msg('Restam {0} peças de distância {1} na reserva de quem jogou.', [next.reservas[state.jogadorAtual][move.distancia], move.distancia])}</p>
    {next.estado !== 'a-jogar' && <p>{t('Sem resposta legal: esta jogada termina a partida e vence quem a fez.')}</p>}
  </div>;
}

/** Mounted per turn: async hints and examples cannot cross a turn or restart. */
export function FaiscaTutor({ state, turn }: { state: FaiscaState; turn: string }) {
  const { t } = useTranslation();
  const { recordPatternProgress } = useGamification();
  const thinking = useThinkingTutor(turn);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const [example, setExample] = useState<Jogada | null>(null);
  const [retry, setRetry] = useState(0);
  const active = useRef(true);
  const saving = useRef(false);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);

  async function requestHint() {
    if (saving.current) return;
    saving.current = true;
    setPending(true);
    setError(false);
    // Persist exposure before revealing even the principle. Never submit solo evidence.
    const saved = await recordPatternProgress({ gameId: 'faisca', patternId: PATTERN, evidence: 'used_with_help', contextId: turn });
    if (!active.current) return;
    saving.current = false;
    setPending(false);
    if (saved) thinking.requestHint();
    else setError(true);
  }

  useEffect(() => {
    if (!thinking.showSolution) return;
    const controller = new AbortController();
    setError(false);
    void requestFaiscaMove({ version: '1.0', requestId: crypto.randomUUID(), gameId: 'faisca', mode: 'tutor', state, level: 2, seed: 32 }, controller.signal)
      .then(response => {
        if (controller.signal.aborted) return;
        if (!response.bestMove || !isJogadaValida(state, response.bestMove)) { setError(true); return; }
        setExample(response.bestMove);
      }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [thinking.showSolution, state, retry]);

  return <div className="my-4" data-faisca-learning>
    <ThinkingTutor gameId="faisca" tutor={{ ...thinking, requestHint }} solutionReady={!!example}>
      {example && <>
        <p>{t('Pista do computador: este exemplo não garante vitória.')}</p>
        <Consequence state={state} move={example} />
      </>}
    </ThinkingTutor>
    {pending && <p role="status">{t('A guardar a ajuda…')}</p>}
    {error && <div role="alert">
      <p>{t('Não foi possível guardar a atividade ou preparar o exemplo. Tenta novamente.')}</p>
      {thinking.showSolution && <button className="faisca-control" onClick={() => setRetry(value => value + 1)}>{t('Tentar novamente')}</button>}
    </div>}
  </div>;
}

export function FaiscaReview({ decision, matchId }: { decision: FaiscaDecision; matchId: string }) {
  const { t, msg } = useTranslation();
  const { recordReviewCompleted, recordPatternProgress } = useGamification();
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const saving = useRef(false);
  const { state, move } = decision;
  const alternatives = getJogadasValidas(state).filter(candidate => JSON.stringify(candidate) !== JSON.stringify(move));
  // This is explicitly a one-ply mobility heuristic, not a proof of best play.
  const alternative = alternatives.sort((a, b) => getJogadasValidas(colocarPeca(state, a)).length - getJogadasValidas(colocarPeca(state, b)).length)[0];

  async function saveReview() {
    if (saving.current || saved) return;
    saving.current = true;
    setPending(true);
    setError(false);
    const patternSaved = await recordPatternProgress({ gameId: 'faisca', patternId: PATTERN, evidence: 'seen', contextId: matchId });
    const reviewSaved = patternSaved && await recordReviewCompleted('faisca', matchId);
    setSaved(reviewSaved);
    setError(!reviewSaved);
    setPending(false);
    saving.current = false;
  }

  return <section data-faisca-learning aria-label={t('Revisão rápida pós-jogo')} className="my-4 rounded-xl border p-4 [border-color:var(--linha)]">
    <h3 className="font-bold">{t('Revisão rápida pós-jogo')}</h3>
    <p>{msg('Decisão da partida: turno {0}, {1}.', [decision.turn, t(state.jogadorAtual === 'jogador1' ? 'Azul' : 'Vermelho')])}</p>
    <details className="my-3">
      <summary className="min-h-11 cursor-pointer">{t('Ver a posição antes da decisão')}</summary>
      <div className="faisca-board" role="group" aria-label={t('Posição antes da decisão')}>
        {state.tabuleiro.flatMap((row, linha) => row.map((piece, coluna) => <span role="img" key={`${linha}-${coluna}`} className="faisca-cell" data-player={piece?.jogador}
          aria-label={piece ? msg('{0}: {1}, distância {2}, {3}', [coordinate({ linha, coluna }), t(piece.jogador === 'jogador1' ? 'Azul' : 'Vermelho'), piece.distancia, t(directions[piece.direcao])]) : msg('{0}: {1}', [coordinate({ linha, coluna }), t(state.casaObrigatoria?.linha === linha && state.casaObrigatoria.coluna === coluna ? 'Casa obrigatória' : 'Vazia')])}>
          <span className="faisca-coordinate">{coordinate({ linha, coluna })}</span>
          {piece ? <span className="faisca-piece" aria-hidden="true">{arrows[piece.direcao]}<small>{piece.distancia}</small></span>
            : state.casaObrigatoria?.linha === linha && state.casaObrigatoria.coluna === coluna ? <span aria-hidden="true">★</span> : null}
        </span>))}
      </div>
      {(['jogador1', 'jogador2'] as const).map(player => <p key={player}>
        {t(player === 'jogador1' ? 'Azul' : 'Vermelho')}: {([1, 2, 3] as const).map(d => msg('Distância {0}: {1} peças', [d, state.reservas[player][d]])).join(' · ')}
      </p>)}
    </details>
    <h4 className="font-bold mt-3">{t('Jogada realizada')}</h4>
    <Consequence state={state} move={move} />
    {alternative && <>
      <h4 className="font-bold mt-3">{t('Alternativa legal')}</h4>
      <p>{t('Esta alternativa deixa o mínimo de respostas imediatas entre as outras escolhas. É uma pista, não uma garantia de vitória.')}</p>
      <Consequence state={state} move={alternative} />
    </>}
    <p className="my-3">{t('Explica como a próxima casa e as reservas mudam as escolhas. Esta revisão é prática orientada.')}</p>
    <button className="faisca-control" disabled={pending || saved} onClick={saveReview}>
      {t(saved ? 'Revisão registada' : pending ? 'A guardar a revisão…' : 'Marcar revisão concluída (+10 XP)')}
    </button>
    {error && <p role="alert">{t('Não foi possível guardar a atividade ou preparar o exemplo. Tenta novamente.')}</p>}
  </section>;
}
