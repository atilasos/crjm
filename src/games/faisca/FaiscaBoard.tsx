import { useState } from 'react';
import { useTranslation } from '../../i18n/LanguageProvider';
import { getDestino, isJogadaValida } from './logic';
import type { Casa, Direcao, Distancia, FaiscaState, Jogada } from './types';
import type { Player } from '../../types';
import './faisca.css';

const DIRECOES: Record<Direcao, { nome: string; simbolo: string }> = {
  cima: { nome: 'Cima', simbolo: '▲' }, direita: { nome: 'Direita', simbolo: '▶' },
  baixo: { nome: 'Baixo', simbolo: '▼' }, esquerda: { nome: 'Esquerda', simbolo: '◀' },
};
const coordinate = (casa: Casa) => `${String.fromCharCode(97 + casa.coluna)}${5 - casa.linha}`;
const same = (a: Casa | null, b: Casa) => a?.linha === b.linha && a.coluna === b.coluna;

/** Only selections are local. The owner applies every confirmed move. */
export function FaiscaBoard({ state, interactive, busy = false, myRole, onMove }: {
  state: FaiscaState;
  interactive: boolean;
  busy?: boolean;
  myRole?: Player;
  onMove: (move: Jogada) => void;
}) {
  const { t, msg } = useTranslation();
  const [abertura, setAbertura] = useState<Casa | null>(null);
  const [distancia, setDistancia] = useState<Distancia>(1);
  const [direcao, setDirecao] = useState<Direcao>('direita');
  const [erro, setErro] = useState(false);
  const casa = state.casaObrigatoria ?? abertura;
  const jogada = casa ? { casa, distancia, direcao } : null;
  const destino = interactive && jogada ? getDestino(jogada) : null;
  const destinoDentro = destino && destino.linha >= 0 && destino.linha < 5 && destino.coluna >= 0 && destino.coluna < 6;
  const valida = jogada ? isJogadaValida(state, jogada) : false;
  const terminou = state.estado !== 'a-jogar';
  const jogador = (id: string) => t(id === 'jogador1' ? 'Azul' : 'Vermelho');
  return <div className="faisca">
    {myRole && <p className="mb-2">{t('Jogar como:')} {jogador(myRole)}</p>}
      <p role="status" className="text-xl font-bold mb-2">
        {terminou
          ? msg('Venceu {0}!', [jogador(state.estado === 'vitoria-jogador1' ? 'jogador1' : 'jogador2')])
          : busy ? `${msg('Vez de {0}', [jogador(state.jogadorAtual)])} · ${t('Computador')} · ${t('A pensar…')}`
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
            disabled={!interactive || terminou || peca !== null || (!!state.casaObrigatoria && !obrigatoria)}
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

      <fieldset disabled={!interactive || terminou} className="mb-3">
        <legend className="font-bold mb-2">{t('Distância da peça')}</legend>
        <div className="flex gap-2">{([1, 2, 3] as const).map(d => <button key={d} type="button"
          className="faisca-control" aria-pressed={distancia === d} aria-label={msg('Distância {0}', [d])}
          disabled={state.reservas[state.jogadorAtual][d] === 0}
          onClick={() => { setDistancia(d); setErro(false); }}>{d}</button>)}</div>
      </fieldset>
      <fieldset disabled={!interactive || terminou} className="mb-3">
        <legend className="font-bold mb-2">{t('Direção da peça')}</legend>
        <div className="flex flex-wrap gap-2">{(Object.entries(DIRECOES) as [Direcao, typeof DIRECOES[Direcao]][]).map(([id, info]) =>
          <button key={id} type="button" className="faisca-control" aria-pressed={direcao === id}
            onClick={() => { setDirecao(id); setErro(false); }}><span aria-hidden="true">{info.simbolo}</span> {t(info.nome)}</button>)}</div>
      </fieldset>

      {!terminou && interactive && <p aria-live="polite" className="my-3">{destino
        ? msg('Destino: {0} — {1}', [destinoDentro ? coordinate(destino) : t('Fora do tabuleiro'), t(valida ? 'jogada válida' : 'jogada inválida')])
        : t('Seleciona a casa de abertura para ver o destino.')}</p>}
      {erro && <p role="alert" className="font-bold my-3">{t('Jogada inválida. Escolhe uma peça disponível e um destino vazio dentro do tabuleiro.')}</p>}
    <button type="button" className="btn btn-primary" disabled={!interactive || !casa || terminou} onClick={() => {
      if (!jogada || !valida) { setErro(true); return; }
      setErro(false);
      onMove(jogada);
    }}>{t('Confirmar jogada')}</button>
  </div>;
}
