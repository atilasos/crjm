import { useCallback, useEffect, useRef, useState } from 'react';
import { GameLayout } from '../../components/GameLayout';
import { DifficultySelector } from '../../components/DifficultySelector';
import { useGamification } from '../../components/gamification/GamificationProvider';
import { useTranslation } from '../../i18n/LanguageProvider';
import { criarEstadoInicial, colocarPeca, getJogadasValidas, isJogadaValida } from './logic';
import type { Player } from '../../types';
import type { FaiscaState, Jogada } from './types';
import { FaiscaBoard } from './FaiscaBoard';
import { requestFaiscaMove } from './ai/ai-client';
import { FAISCA_DIFFICULTIES, type FaiscaLevel } from './ai/engine';
import { FaiscaTutor, FaiscaReview, type FaiscaDecision } from './FaiscaLearning';
import './faisca.css';

const REGRAS = [
  'Faísca joga-se num tabuleiro de cinco linhas e seis colunas. Azul começa.',
  'Cada jogador tem quinze peças: cinco de distância 1, cinco de distância 2 e cinco de distância 3.',
  'Só na abertura podes escolher qualquer casa vazia. Depois, coloca a peça na casa obrigatória, marcada com uma estrela.',
  'Escolhe uma peça disponível e aponta para cima, direita, baixo ou esquerda. A distância da peça indica a próxima casa a preencher.',
  'O destino tem de estar vazio e dentro do tabuleiro, também na abertura. Podes saltar por cima de peças.',
  'Perde quem não tiver uma jogada válida ou já não tiver peças. Não há troca de cores.',
];

export function FaiscaGame({ onVoltar }: { onVoltar: () => void }) {
  const { t } = useTranslation();
  const { recordGameCompleted, profile } = useGamification();
  const [matchId, setMatchId] = useState(() => crypto.randomUUID());
  const [decision, setDecision] = useState<FaiscaDecision | null>(null);
  const [state, setState] = useState(criarEstadoInicial);
  const [mode, setMode] = useState<'local' | 'ai'>('local');
  const [human, setHuman] = useState<Player>('jogador1');
  const [level, setLevel] = useState<FaiscaLevel>(1);
  const [aiError, setAiError] = useState(false);
  const [retry, setRetry] = useState(0);
  const computation = useRef<AbortController | null>(null);
  const terminou = state.estado !== 'a-jogar';
  const aiTurn = !terminou && mode === 'ai' && state.jogadorAtual !== human;

  const applyMove = useCallback((next: FaiscaState) => {
    setState(next);
    if (next.estado !== 'a-jogar') {
      const won = mode === 'ai' && next.estado === `vitoria-${human}`;
      recordGameCompleted('faisca', won, mode === 'ai' ? level : undefined);
    }
  }, [mode, human, level, recordGameCompleted]);

  useEffect(() => {
    if (!aiTurn) return;
    const controller = new AbortController();
    computation.current = controller;
    setAiError(false);
    void requestFaiscaMove({ version: '1.0', requestId: crypto.randomUUID(), gameId: 'faisca',
      mode: 'competitive', state, level, seed: crypto.getRandomValues(new Uint32Array(1))[0] }, controller.signal)
      .then(response => {
        if (controller.signal.aborted) return;
        if (!response.bestMove || !isJogadaValida(state, response.bestMove)) { setAiError(true); return; }
        applyMove(colocarPeca(state, response.bestMove));
      }).catch(() => { if (!controller.signal.aborted) setAiError(true); });
    return () => controller.abort();
  }, [aiTurn, state, level, retry, applyMove]);

  function confirmar(jogada: Jogada) {
    if (aiTurn) return;
    const next = colocarPeca(state, jogada);
    if (next === state) return;
    if (getJogadasValidas(state).length > 1 || !decision) {
      setDecision({ state, move: jogada, turn: state.tabuleiro.flat().filter(Boolean).length + 1 });
    }
    applyMove(next);
  }

  function novaPartida() {
    computation.current?.abort();
    setState(criarEstadoInicial());
    setMatchId(crypto.randomUUID());
    setDecision(null);
    setAiError(false);
  }

  return <GameLayout titulo="Faísca" gameId="faisca" regras={REGRAS} onVoltar={() => { computation.current?.abort(); onVoltar(); }}>
    <div className="game-container faisca">
      <fieldset className="mb-4">
        <legend className="font-bold mb-2">{t('Modo de jogo:')}</legend>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="faisca-control" aria-pressed={mode === 'local'} onClick={() => { novaPartida(); setMode('local'); }}>{t('Dois jogadores no mesmo dispositivo')}</button>
          <button type="button" className="faisca-control" aria-pressed={mode === 'ai'} onClick={() => { novaPartida(); setMode('ai'); }}>{t('🤖 vs Computador')}</button>
        </div>
      </fieldset>
      {mode === 'ai' && <div className="mb-4">
        <label className="block mb-3">{t('Jogar como:')}{' '}
          <select className="faisca-control" aria-label={t('Jogar como:')} value={human} onChange={event => { novaPartida(); setHuman(event.target.value as Player); }}>
            <option value="jogador1">{t('Azul')}</option><option value="jogador2">{t('Vermelho')}</option>
          </select>
        </label>
        <DifficultySelector level={level} maxLevel={2} profiles={FAISCA_DIFFICULTIES}
          onChange={value => { novaPartida(); setLevel(value); }} />
        <p className="text-sm mt-2">{t('Alterar o modo, lado ou nível inicia uma nova partida.')}</p>
        <p className="text-sm mt-2">{t('Níveis avaliados em Faísca; não equivalem aos de outros jogos.')}</p>
      </div>}
      <FaiscaBoard key={`board:${matchId}`} state={state} interactive={!aiTurn} busy={aiTurn && !aiError} onMove={confirmar} />
      {aiError && <div role="alert" className="my-3">
        <p>{t('Não foi possível calcular a jogada. Tenta novamente ou inicia outra partida.')}</p>
        <button type="button" className="btn btn-secondary" onClick={() => setRetry(value => value + 1)}>{t('Tentar novamente')}</button>
      </div>}
      {profile.patterns['faisca:proxima-casa']?.state === 'used_with_help' && <p className="my-3">{t('Já praticaste a próxima casa com ajuda. Esse registo mantém-se entre sessões e não conta como resolução autónoma.')}</p>}
      {!terminou && !aiTurn && <FaiscaTutor key={`${matchId}:${state.tabuleiro.flat().filter(Boolean).length}`} state={state} turn={`${matchId}:${state.tabuleiro.flat().filter(Boolean).length}`} />}
      {terminou && decision && <FaiscaReview key={matchId} decision={decision} matchId={matchId} />}
      <div className="flex flex-wrap gap-3">
        <button type="button" className="btn btn-secondary" onClick={novaPartida}>{t('Nova partida')}</button>
      </div>
    </div>
  </GameLayout>;
}
