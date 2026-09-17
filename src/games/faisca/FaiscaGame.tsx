import { useCallback, useEffect, useRef, useState } from 'react';
import { GameLayout } from '../../components/GameLayout';
import { DifficultySelector } from '../../components/DifficultySelector';
import { useGamification } from '../../components/gamification/GamificationProvider';
import { useTranslation } from '../../i18n/LanguageProvider';
import { criarEstadoInicial, colocarPeca, getDestino, isJogadaValida } from './logic';
import type { Player } from '../../types';
import type { Casa, Direcao, Distancia, FaiscaState } from './types';
import { requestFaiscaMove } from './ai/ai-client';
import { FAISCA_DIFFICULTIES, type FaiscaLevel } from './ai/engine';
import './faisca.css';

const REGRAS = [
  'Faísca joga-se num tabuleiro de cinco linhas e seis colunas. Azul começa.',
  'Cada jogador tem quinze peças: cinco de distância 1, cinco de distância 2 e cinco de distância 3.',
  'Só na abertura podes escolher qualquer casa vazia. Depois, coloca a peça na casa obrigatória, marcada com uma estrela.',
  'Escolhe uma peça disponível e aponta para cima, direita, baixo ou esquerda. A distância da peça indica a próxima casa a preencher.',
  'O destino tem de estar vazio e dentro do tabuleiro, também na abertura. Podes saltar por cima de peças.',
  'Perde quem não tiver uma jogada válida ou já não tiver peças. Não há troca de cores.',
];

const DIRECOES: Record<Direcao, { nome: string; simbolo: string }> = {
  cima: { nome: 'Cima', simbolo: '▲' }, direita: { nome: 'Direita', simbolo: '▶' },
  baixo: { nome: 'Baixo', simbolo: '▼' }, esquerda: { nome: 'Esquerda', simbolo: '◀' },
};
const coordinate = (casa: Casa) => `${String.fromCharCode(97 + casa.coluna)}${5 - casa.linha}`;
const same = (a: Casa | null, b: Casa) => a?.linha === b.linha && a.coluna === b.coluna;

export function FaiscaGame({ onVoltar }: { onVoltar: () => void }) {
  const { t, msg } = useTranslation();
  const { recordGameCompleted } = useGamification();
  const [state, setState] = useState(criarEstadoInicial);
  const [abertura, setAbertura] = useState<Casa | null>(null);
  const [distancia, setDistancia] = useState<Distancia>(1);
  const [direcao, setDirecao] = useState<Direcao>('direita');
  const [erro, setErro] = useState(false);
  const [mode, setMode] = useState<'local' | 'ai'>('local');
  const [human, setHuman] = useState<Player>('jogador1');
  const [level, setLevel] = useState<FaiscaLevel>(1);
  const [aiError, setAiError] = useState(false);
  const [retry, setRetry] = useState(0);
  const computation = useRef<AbortController | null>(null);
  const casa = state.casaObrigatoria ?? abertura;
  const jogada = casa ? { casa, distancia, direcao } : null;
  const destino = jogada ? getDestino(jogada) : null;
  const destinoDentro = destino && destino.linha >= 0 && destino.linha < 5 && destino.coluna >= 0 && destino.coluna < 6;
  const valida = jogada ? isJogadaValida(state, jogada) : false;
  const terminou = state.estado !== 'a-jogar';
  const aiTurn = !terminou && mode === 'ai' && state.jogadorAtual !== human;
  const jogador = (id: string) => t(id === 'jogador1' ? 'Azul' : 'Vermelho');

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

  function confirmar() {
    if (!jogada || aiTurn) return;
    const next = colocarPeca(state, jogada);
    if (next === state) { setErro(true); return; }
    setErro(false);
    applyMove(next);
  }

  function novaPartida() {
    computation.current?.abort();
    setState(criarEstadoInicial());
    setAbertura(null);
    setDistancia(1);
    setDirecao('direita');
    setErro(false);
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
      <p role="status" className="text-xl font-bold mb-2">
        {terminou
          ? msg('Venceu {0}!', [jogador(state.estado === 'vitoria-jogador1' ? 'jogador1' : 'jogador2')])
          : aiTurn ? `${msg('Vez de {0}', [jogador(state.jogadorAtual)])} · ${t('Computador')}${aiError ? '' : ` · ${t('A pensar…')}`}`
            : msg('Vez de {0}', [jogador(state.jogadorAtual)])}
      </p>
      <p className="mb-4">{terminou ? t('O adversário ficou sem jogada válida ou sem peças.')
        : state.casaObrigatoria ? msg('Casa obrigatória: {0}', [coordinate(state.casaObrigatoria)])
          : t('Abertura: escolhe uma casa vazia.')}</p>

      <div className="faisca-board" role="group" aria-label={t('Tabuleiro de Faísca')}>
        {state.tabuleiro.flatMap((row, linha) => row.map((peca, coluna) => {
          const pos = { linha, coluna };
          const obrigatoria = same(state.casaObrigatoria, pos);
          const selecionada = same(casa, pos);
          const alvo = same(destino, pos);
          const label = peca
            ? msg('{0}: {1}, distância {2}, {3}', [coordinate(pos), jogador(peca.jogador), peca.distancia, t(DIRECOES[peca.direcao].nome)])
            : msg('{0}: {1}', [coordinate(pos), obrigatoria ? t('Casa obrigatória') : alvo ? t('Destino') : t('Vazia')]);
          return <button key={coordinate(pos)} type="button" aria-label={label} aria-pressed={selecionada}
            disabled={terminou || aiTurn || peca !== null || (!!state.casaObrigatoria && !obrigatoria)}
            className="faisca-cell" data-player={peca?.jogador} data-selected={selecionada} data-target={alvo}
            onClick={() => { setAbertura(pos); setErro(false); }}>
            <span className="faisca-coordinate">{coordinate(pos)}</span>
            {peca ? <span className="faisca-piece" aria-hidden="true">{DIRECOES[peca.direcao].simbolo}<small>{peca.distancia}</small></span>
              : <span aria-hidden="true">{obrigatoria ? '★' : alvo ? '◎' : selecionada ? '✓' : ''}</span>}
          </button>;
        }))}
      </div>

      <div className="grid grid-cols-2 gap-3 my-4" aria-label={t('Reservas')}>
        {(['jogador1', 'jogador2'] as const).map(id => <div key={id} className="faisca-reserve">
          <p className="font-bold">{jogador(id)}</p>
          <ul>{([1, 2, 3] as const).map(d => <li key={d}>{msg('Distância {0}: {1} peças', [d, state.reservas[id][d]])}</li>)}</ul>
        </div>)}
      </div>

      <fieldset disabled={terminou || aiTurn} className="mb-3">
        <legend className="font-bold mb-2">{t('Distância da peça')}</legend>
        <div className="flex gap-2">{([1, 2, 3] as const).map(d => <button key={d} type="button"
          className="faisca-control" aria-pressed={distancia === d} aria-label={msg('Distância {0}', [d])}
          disabled={state.reservas[state.jogadorAtual][d] === 0}
          onClick={() => { setDistancia(d); setErro(false); }}>{d}</button>)}</div>
      </fieldset>
      <fieldset disabled={terminou || aiTurn} className="mb-3">
        <legend className="font-bold mb-2">{t('Direção da peça')}</legend>
        <div className="flex flex-wrap gap-2">{(Object.entries(DIRECOES) as [Direcao, typeof DIRECOES[Direcao]][]).map(([id, info]) =>
          <button key={id} type="button" className="faisca-control" aria-pressed={direcao === id}
            onClick={() => { setDirecao(id); setErro(false); }}><span aria-hidden="true">{info.simbolo}</span> {t(info.nome)}</button>)}</div>
      </fieldset>

      {!terminou && !aiTurn && <p aria-live="polite" className="my-3">{destino
        ? msg('Destino: {0} — {1}', [destinoDentro ? coordinate(destino) : t('Fora do tabuleiro'), t(valida ? 'jogada válida' : 'jogada inválida')])
        : t('Seleciona a casa de abertura para ver o destino.')}</p>}
      {erro && <p role="alert" className="font-bold my-3">{t('Jogada inválida. Escolhe uma peça disponível e um destino vazio dentro do tabuleiro.')}</p>}
      {aiError && <div role="alert" className="my-3">
        <p>{t('Não foi possível calcular a jogada. Tenta novamente ou inicia outra partida.')}</p>
        <button type="button" className="btn btn-secondary" onClick={() => setRetry(value => value + 1)}>{t('Tentar novamente')}</button>
      </div>}
      <div className="flex flex-wrap gap-3">
        <button type="button" className="btn btn-primary" disabled={!casa || terminou || aiTurn} onClick={confirmar}>{t('Confirmar jogada')}</button>
        <button type="button" className="btn btn-secondary" onClick={novaPartida}>{t('Nova partida')}</button>
      </div>
    </div>
  </GameLayout>;
}
