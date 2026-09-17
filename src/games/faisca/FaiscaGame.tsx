import { useState } from 'react';
import { GameLayout } from '../../components/GameLayout';
import { useGamification } from '../../components/gamification/GamificationProvider';
import { useTranslation } from '../../i18n/LanguageProvider';
import { criarEstadoInicial, colocarPeca, getDestino, isJogadaValida } from './logic';
import type { Casa, Direcao, Distancia } from './types';
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
  const casa = state.casaObrigatoria ?? abertura;
  const jogada = casa ? { casa, distancia, direcao } : null;
  const destino = jogada ? getDestino(jogada) : null;
  const destinoDentro = destino && destino.linha >= 0 && destino.linha < 5 && destino.coluna >= 0 && destino.coluna < 6;
  const valida = jogada ? isJogadaValida(state, jogada) : false;
  const terminou = state.estado !== 'a-jogar';
  const jogador = (id: string) => t(id === 'jogador1' ? 'Azul' : 'Vermelho');

  function confirmar() {
    if (!jogada) return;
    const next = colocarPeca(state, jogada);
    if (next === state) { setErro(true); return; }
    setErro(false);
    setState(next);
    // As in the other local two-player games, completion records practice;
    // neither participant is assigned a learner win against the computer.
    if (next.estado !== 'a-jogar') recordGameCompleted('faisca', false);
  }

  function novaPartida() {
    setState(criarEstadoInicial());
    setAbertura(null);
    setDistancia(1);
    setDirecao('direita');
    setErro(false);
  }

  return <GameLayout titulo="Faísca" gameId="faisca" regras={REGRAS} onVoltar={onVoltar}>
    <div className="game-container faisca">
      <p className="text-sm mb-2">{t('Dois jogadores no mesmo dispositivo')}</p>
      <p role="status" className="text-xl font-bold mb-2">
        {terminou
          ? msg('Venceu {0}!', [jogador(state.estado === 'vitoria-jogador1' ? 'jogador1' : 'jogador2')])
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
            disabled={terminou || peca !== null || (!!state.casaObrigatoria && !obrigatoria)}
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

      <fieldset disabled={terminou} className="mb-3">
        <legend className="font-bold mb-2">{t('Distância da peça')}</legend>
        <div className="flex gap-2">{([1, 2, 3] as const).map(d => <button key={d} type="button"
          className="faisca-control" aria-pressed={distancia === d} aria-label={msg('Distância {0}', [d])}
          disabled={state.reservas[state.jogadorAtual][d] === 0}
          onClick={() => { setDistancia(d); setErro(false); }}>{d}</button>)}</div>
      </fieldset>
      <fieldset disabled={terminou} className="mb-3">
        <legend className="font-bold mb-2">{t('Direção da peça')}</legend>
        <div className="flex flex-wrap gap-2">{(Object.entries(DIRECOES) as [Direcao, typeof DIRECOES[Direcao]][]).map(([id, info]) =>
          <button key={id} type="button" className="faisca-control" aria-pressed={direcao === id}
            onClick={() => { setDirecao(id); setErro(false); }}><span aria-hidden="true">{info.simbolo}</span> {t(info.nome)}</button>)}</div>
      </fieldset>

      {!terminou && <p aria-live="polite" className="my-3">{destino
        ? msg('Destino: {0} — {1}', [destinoDentro ? coordinate(destino) : t('Fora do tabuleiro'), t(valida ? 'jogada válida' : 'jogada inválida')])
        : t('Seleciona a casa de abertura para ver o destino.')}</p>}
      {erro && <p role="alert" className="font-bold my-3">{t('Jogada inválida. Escolhe uma peça disponível e um destino vazio dentro do tabuleiro.')}</p>}
      <div className="flex flex-wrap gap-3">
        <button type="button" className="btn btn-primary" disabled={!casa || terminou} onClick={confirmar}>{t('Confirmar jogada')}</button>
        <button type="button" className="btn btn-secondary" onClick={novaPartida}>{t('Nova partida')}</button>
      </div>
    </div>
  </GameLayout>;
}
