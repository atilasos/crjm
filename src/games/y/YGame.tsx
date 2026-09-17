import { useCallback, useEffect, useRef, useState } from 'react';
import { GameLayout } from '../../components/GameLayout';
import { useGamification } from '../../components/gamification/GamificationProvider';
import { useTranslation } from '../../i18n/LanguageProvider';
import type { Player } from '../../types';
import { YBoard } from './YBoard';
import { YTutor, YReview, type YDecision } from './YLearning';
import { criarEstadoInicial, aplicarJogada, getJogadasValidas } from './logic';
import { requestYMove } from './ai/ai-client';
import { Y_DIFFICULTIES, type YLevel } from './ai/engine';
import { DifficultySelector } from '../../components/DifficultySelector';
import type { YState, YMove } from './types';
import './y.css';

const REGRAS = [
  'Y joga-se nas intersecções do tabuleiro ilustrado. Começa vazio e o primeiro jogador usa as peças azuis.',
  'Em cada turno, coloca uma peça da tua cor numa intersecção vazia. As peças não se movem nem são capturadas.',
  'Na sua primeira oportunidade, o segundo jogador pode trocar de cores em vez de colocar uma peça.',
  'Após a troca, a peça inicial fica no lugar e pertence ao segundo jogador. O primeiro jogador continua com a outra cor.',
  'Ganha quem ligar os três lados com um único grupo de peças da mesma cor, seguindo as linhas desenhadas.',
  'Cada canto pertence aos dois lados adjacentes. Ligar um canto ao lado oposto pode vencer; grupos separados não se somam.',
];

export function YGame({ onVoltar }: { onVoltar: () => void }) {
  const { t, msg } = useTranslation();
  const { recordGameCompleted, isReady, profile } = useGamification();
  const [matchId, setMatchId] = useState(() => crypto.randomUUID());
  const [decision, setDecision] = useState<YDecision | null>(null);
  const [state, setState] = useState(criarEstadoInicial);
  const [participante, setParticipante] = useState<Player>('jogador1');
  const [mode, setMode] = useState<'local' | 'ai'>('local');
  const [level, setLevel] = useState<YLevel>(1);
  const [aiError, setAiError] = useState(false);
  const [retry, setRetry] = useState(0);
  const computation = useRef<AbortController | null>(null);
  const turnNumber = state.colocacoes + (state.cores.jogador1 === 'vermelho' ? 1 : 0) + 1;
  const turn = `${matchId}:${turnNumber}`;
  const terminou = state.estado !== 'a-jogar';
  const aiTurn = !terminou && mode === 'ai' && state.jogadorAtual !== participante;
  const nome = (id: Player) => t(id === 'jogador1' ? 'Jogador 1' : 'Jogador 2');
  const cor = (id: Player) => t(state.cores[id] === 'azul' ? 'Azul' : 'Vermelho');
  const vencedor = state.estado === 'vitoria-jogador1' ? 'jogador1' : 'jogador2';

  const applyMove = useCallback((next: YState) => {
    setState(next);
    if (next.estado !== 'a-jogar') {
      recordGameCompleted('y', next.estado === `vitoria-${participante}`, mode === 'ai' ? level : undefined);
    }
  }, [participante, mode, level, recordGameCompleted]);

  useEffect(() => {
    if (!isReady || !aiTurn) return;
    const controller = new AbortController();
    computation.current = controller;
    setAiError(false);
    void requestYMove({ version: '1.0', requestId: crypto.randomUUID(), gameId: 'y',
      mode: 'competitive', state, level, seed: crypto.getRandomValues(new Uint32Array(1))[0] }, controller.signal)
      .then(response => {
        if (controller.signal.aborted) return;
        const next = response.bestMove ? aplicarJogada(state, response.bestMove) : state;
        if (next === state) { setAiError(true); return; }
        applyMove(next);
      }).catch(() => { if (!controller.signal.aborted) setAiError(true); });
    return () => controller.abort();
  }, [isReady, aiTurn, state, level, retry, applyMove]);

  function jogar(move: YMove) {
    const next = aplicarJogada(state, move);
    if (!isReady || aiTurn || next === state) return;
    if (state.jogadorAtual === participante && (getJogadasValidas(state).length > 1 || !decision)) {
      setDecision({ state, move, turn: turnNumber });
    }
    applyMove(next);
  }

  function novaPartida() {
    computation.current?.abort();
    setAiError(false);
    setState(criarEstadoInicial());
    setMatchId(crypto.randomUUID());
    setDecision(null);
  }

  return <GameLayout titulo="Y" gameId="y" regras={REGRAS} onVoltar={() => { computation.current?.abort(); onVoltar(); }}>
    <div className="game-container y-game">
      <fieldset className="mb-4">
        <legend className="font-bold mb-2">{t('Modo de jogo:')}</legend>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-secondary" type="button" aria-pressed={mode === 'local'}
            onClick={() => { novaPartida(); setMode('local'); }}>{t('Dois jogadores no mesmo dispositivo')}</button>
          <button className="btn btn-secondary" type="button" aria-pressed={mode === 'ai'}
            onClick={() => { novaPartida(); setMode('ai'); }}>{t('🤖 vs Computador')}</button>
        </div>
      </fieldset>
      <label className="y-profile">
        {t(mode === 'ai' ? 'Jogar como:' : 'O meu perfil corresponde a:')}
        <select aria-label={t(mode === 'ai' ? 'Jogar como:' : 'O meu perfil corresponde a:')} value={participante} disabled={mode === 'local' && state.colocacoes > 0}
          onChange={event => { novaPartida(); setParticipante(event.target.value as Player); }}>
          <option value="jogador1">{t('Jogador 1')}</option>
          <option value="jogador2">{t('Jogador 2')}</option>
        </select>
      </label>
      <p className="text-sm mb-3">{t('A partida e a vitória são guardadas apenas no perfil deste dispositivo, para o participante escolhido.')}</p>
      {mode === 'ai' && <div className="mb-4">
        <DifficultySelector level={level} maxLevel={2} profiles={Y_DIFFICULTIES}
          onChange={value => { novaPartida(); setLevel(value); }} />
        <p className="text-sm mt-2">{t('Alterar o modo, lado ou nível inicia uma nova partida.')}</p>
        <p className="text-sm mt-2">{t('Níveis avaliados em Y; não equivalem aos de outros jogos.')}</p>
      </div>}
      <div className="y-identities">
        {(['jogador1', 'jogador2'] as const).map(id => <p key={id}>
          <span aria-hidden="true">{state.cores[id] === 'azul' ? '●' : '◆'}</span>{' '}
          {msg('{0}: {1}', [nome(id), cor(id)])}{participante === id ? ` (${t('O teu perfil')})` : mode === 'ai' ? ` (${t('Computador')})` : ''}
        </p>)}
      </div>
      <p role="status" className="text-xl font-bold my-3">
        {!isReady ? t('A sincronizar...') : terminou
          ? msg('Venceu {0} com {1}!', [nome(vencedor), cor(vencedor)])
          : `${msg('Vez de {0} — {1}', [nome(state.jogadorAtual), cor(state.jogadorAtual)])}${aiTurn ? ` · ${t('Computador')}${aiError ? '' : ` · ${t('A pensar…')}`}` : ''}`}
      </p>
      {state.podeTrocar && !aiTurn && <p className="mb-3">{t('Podes colocar uma peça ou trocar de cores. A troca ocupa este turno.')}</p>}
      <div className="flex flex-wrap gap-3 mb-3">
        {state.podeTrocar && <button className="btn btn-primary" type="button" disabled={!isReady || aiTurn}
          onClick={() => jogar({ type: 'swap' })}>{t('Trocar de cores')}</button>}
        <button className="btn btn-secondary" type="button" onClick={novaPartida}>{t('Nova partida')}</button>
      </div>
      {aiError && <div role="alert" className="my-3">
        <p>{t('Não foi possível calcular a jogada. Tenta novamente ou inicia outra partida.')}</p>
        <button type="button" className="btn btn-secondary" onClick={() => setRetry(value => value + 1)}>{t('Tentar novamente')}</button>
      </div>}
      <p className="text-sm mb-2">{t('Se necessário, desliza o tabuleiro na horizontal para alcançar todas as intersecções.')}</p>
      <YBoard state={state} disabled={!isReady || terminou || aiTurn} onPlace={node => jogar({ type: 'place', node })} />
      {profile.patterns['y:tres-lados']?.state === 'used_with_help' && <p className="my-3">{t('Já praticaste os três lados com ajuda. Esse registo mantém-se entre sessões e não conta como resolução autónoma.')}</p>}
      {!terminou && isReady && state.jogadorAtual === participante && <YTutor key={turn} state={state} turn={turn} />}
      {terminou && decision && <YReview key={matchId} decision={decision} matchId={matchId} />}
    </div>
  </GameLayout>;
}
