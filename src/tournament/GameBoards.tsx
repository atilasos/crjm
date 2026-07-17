/**
 * Componentes de tabuleiro "puros" para o modo campeonato.
 * 
 * Estes componentes:
 * - Recebem o estado do jogo como prop
 * - Emitem jogadas via callback (onMove)
 * - NÃO gerem estado internamente
 * - São controlados pelo servidor/mock
 */

import { useMemo, useState, useRef } from 'react';
import { getCorJogador } from '../games/nex/logic';

// ============================================================================
// Gatos & Cães
// ============================================================================

import type { GatosCaesState, Posicao as GatosCaesPosicao, CASAS_CENTRAIS } from '../games/gatos-caes/types';
export type { GatosCaesState, GatosCaesPosicao };

// Re-exportar casas centrais
export { CASAS_CENTRAIS } from '../games/gatos-caes/types';

interface GatosCaesBoardProps {
  state: GatosCaesState;
  isMyTurn: boolean;
  myRole: 'jogador1' | 'jogador2'; // jogador1 = Gatos, jogador2 = Cães
  onMove: (pos: GatosCaesPosicao) => void;
}

export function GatosCaesBoard({ state, isMyTurn, myRole, onMove }: GatosCaesBoardProps) {
  const { CASAS_CENTRAIS } = require('../games/gatos-caes/types');

  const isCasaCentral = (linha: number, coluna: number): boolean => {
    return CASAS_CENTRAIS.some((c: GatosCaesPosicao) => c.linha === linha && c.coluna === coluna);
  };

  const isJogadaValida = (linha: number, coluna: number): boolean => {
    if (!isMyTurn) return false;
    return state.jogadasValidas.some(j => j.linha === linha && j.coluna === coluna);
  };

  const getCelulaClasses = (linha: number, coluna: number): string => {
    const celula = state.tabuleiro[linha]?.[coluna];
    const central = isCasaCentral(linha, coluna);
    const jogadaValida = isJogadaValida(linha, coluna);

    let classes = 'aspect-square rounded-md flex items-center justify-center transition-all duration-200 text-3xl md:text-4xl ';

    if (central && celula === 'vazia') {
      classes += 'bg-amber-200 ';
    } else if (celula === 'vazia') {
      classes += 'bg-gray-100 ';
    } else {
      classes += 'bg-gray-50 ';
    }

    if (jogadaValida) {
      classes += 'ring-3 ring-green-400 bg-green-100 cursor-pointer hover:bg-green-200 ';
    } else if (celula === 'vazia') {
      classes += 'cursor-not-allowed opacity-70 ';
    }

    return classes;
  };

  return (
    <div className="space-y-4">
      <div className="aspect-square max-w-md mx-auto">
        <div className="grid grid-cols-8 gap-1 h-full bg-amber-900 p-2 rounded-xl">
          {state.tabuleiro.map((linha, linhaIdx) =>
            linha.map((celula, colunaIdx) => (
              <button
                key={`${linhaIdx}-${colunaIdx}`}
                onClick={() => isJogadaValida(linhaIdx, colunaIdx) && onMove({ linha: linhaIdx, coluna: colunaIdx })}
                className={getCelulaClasses(linhaIdx, colunaIdx)}
                disabled={!isJogadaValida(linhaIdx, colunaIdx)}
              >
                {celula === 'gato' && (
                  <span className="drop-shadow-lg select-none">🐱</span>
                )}
                {celula === 'cao' && (
                  <span className="drop-shadow-lg select-none">🐶</span>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Legenda e Stats */}
      <div className="flex flex-col items-center gap-3 text-sm [color:var(--tinta)]">
        <div className="flex justify-center gap-8">
          <div className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all ${myRole === 'jogador1' ? '[background:color-mix(in_srgb,var(--ouro)_12%,transparent)] ring-1 ring-[var(--ouro)]' : ''}`}>
            <div className="flex items-center gap-2">
              <span className="text-2xl drop-shadow-sm">🐱</span>
              <span className="font-semibold [color:var(--tinta)]">Gatos (J1)</span>
              {myRole === 'jogador1' && <span className="text-[10px] [color:var(--tinta-suave)]">(tu)</span>}
            </div>
            <div className="text-xs [color:var(--tinta-suave)]">Total: {state.totalGatos}</div>
          </div>

          <div className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all ${myRole === 'jogador2' ? '[background:color-mix(in_srgb,var(--ouro)_12%,transparent)] ring-1 ring-[var(--ouro)]' : ''}`}>
            <div className="flex items-center gap-2">
              <span className="text-2xl drop-shadow-sm">🐶</span>
              <span className="font-semibold [color:var(--tinta)]">Cães (J2)</span>
              {myRole === 'jogador2' && <span className="text-[10px] [color:var(--tinta-suave)]">(tu)</span>}
            </div>
            <div className="text-xs [color:var(--tinta-suave)]">Total: {state.totalCaes}</div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs [color:var(--tinta-suave)]">
          <div className="w-4 h-4 bg-amber-200 rounded border border-amber-400/50 shadow-sm" />
          <span>Casas centrais (Obrigatórias no 1.º Gato)</span>
        </div>

        <div className="text-xs font-medium">
          {isMyTurn
            ? <span className="[color:var(--sucesso)] animate-pulse">É a tua vez de jogar!</span>
            : <span className="[color:var(--tinta-suave)]">A aguardar pela jogada do adversário...</span>}
        </div>

        {isMyTurn && (
          <div className="text-[11px] [color:var(--tinta-suave)] [background:var(--fundo)] px-3 py-1 rounded-full border [border-color:var(--linha)]">
            {myRole === 'jogador1'
              ? !state.primeiroGatoColocado
                ? 'Coloca o primeiro Gato numa casa central (amarela)'
                : 'Coloca um Gato (não pode ser adjacente a Cães)'
              : !state.primeiroCaoColocado
                ? 'Coloca o primeiro Cão fora das casas centrais'
                : 'Coloca um Cão (não pode ser adjacente a Gatos)'}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Dominório
// ============================================================================

import type { DominorioState, Domino, Posicao as DominorioPosicao } from '../games/dominorio/types';
import { getDominoPreview } from '../games/dominorio/logic';
export type { DominorioState, Domino, DominorioPosicao };

interface DominorioBoardProps {
  state: DominorioState;
  isMyTurn: boolean;
  myRole: 'jogador1' | 'jogador2'; // jogador1 = Vertical, jogador2 = Horizontal
  onMove: (domino: Domino) => void;
}

export function DominorioBoard({ state, isMyTurn, myRole, onMove }: DominorioBoardProps) {
  const minhaOrientacao = myRole === 'jogador1' ? 'vertical' : 'horizontal';
  const [dominoPreviewLocal, setDominoPreviewLocal] = useState<Domino | null>(null);

  // Encontrar dominó válido que começa nesta posição
  const getDominoInicio = (linha: number, coluna: number): Domino | null => {
    if (!isMyTurn) return null;
    return state.jogadasValidas.find(d =>
      d.pos1.linha === linha && d.pos1.coluna === coluna
    ) || null;
  };

  // Última jogada do adversário (último dominó colocado)
  const ultimaJogada = state.dominosColocados.length > 0
    ? state.dominosColocados[state.dominosColocados.length - 1]
    : null;

  const isUltimaJogada = (linha: number, coluna: number): boolean => {
    if (!ultimaJogada) return false;
    return (ultimaJogada.pos1.linha === linha && ultimaJogada.pos1.coluna === coluna) ||
           (ultimaJogada.pos2.linha === linha && ultimaJogada.pos2.coluna === coluna);
  };

  const isPreview = (linha: number, coluna: number): boolean => {
    if (!dominoPreviewLocal) return false;
    return (dominoPreviewLocal.pos1.linha === linha && dominoPreviewLocal.pos1.coluna === coluna) ||
           (dominoPreviewLocal.pos2.linha === linha && dominoPreviewLocal.pos2.coluna === coluna);
  };

  const getCelulaClasses = (linha: number, coluna: number): string => {
    const celula = state.tabuleiro[linha]?.[coluna];
    const preview = isPreview(linha, coluna);
    const ultima = isUltimaJogada(linha, coluna);

    let classes = 'aspect-square rounded-md flex items-center justify-center transition-all duration-150 ';

    if (celula === 'vazia') {
      if (preview) {
        classes += minhaOrientacao === 'vertical'
          ? 'bg-pink-400 ring-2 ring-pink-300 '
          : 'bg-cyan-400 ring-2 ring-cyan-300 ';
      } else {
        classes += 'bg-gray-100 hover:bg-gray-200 cursor-pointer ';
      }
    } else if (celula === 'ocupada-vertical') {
      classes += ultima ? 'bg-pink-500 ring-2 ring-yellow-400 ring-offset-1 ring-offset-emerald-800 ' : 'bg-pink-500 ';
    } else {
      classes += ultima ? 'bg-cyan-500 ring-2 ring-yellow-400 ring-offset-1 ring-offset-emerald-800 ' : 'bg-cyan-500 ';
    }

    return classes;
  };

  const handleMouseEnter = (linha: number, coluna: number) => {
    if (!isMyTurn) return;
    const preview = getDominoPreview(state, { linha, coluna });
    setDominoPreviewLocal(preview);
  };

  const handleMouseLeave = () => {
    setDominoPreviewLocal(null);
  };

  const handleClick = (linha: number, coluna: number) => {
    const domino = getDominoInicio(linha, coluna);
    if (domino) {
      onMove(domino);
      setDominoPreviewLocal(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="aspect-square max-w-md mx-auto">
        <div
          className="grid grid-cols-8 gap-1 h-full bg-emerald-800 p-2 rounded-xl"
          onMouseLeave={handleMouseLeave}
        >
          {state.tabuleiro.map((linha, linhaIdx) =>
            linha.map((celula, colunaIdx) => (
              <button
                key={`${linhaIdx}-${colunaIdx}`}
                onClick={() => handleClick(linhaIdx, colunaIdx)}
                onMouseEnter={() => handleMouseEnter(linhaIdx, colunaIdx)}
                className={getCelulaClasses(linhaIdx, colunaIdx)}
                disabled={!getDominoInicio(linhaIdx, colunaIdx)}
              >
                {celula !== 'vazia' && (
                  <div className="w-2 h-2 rounded-full bg-white/50"></div>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Legenda e Stats */}
      <div className="flex flex-col items-center gap-3 text-sm [color:var(--tinta)]">
        <div className="flex justify-center gap-8">
          <div className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all ${myRole === 'jogador1' ? '[background:color-mix(in_srgb,var(--ouro)_12%,transparent)] ring-1 ring-[var(--ouro)]' : ''}`}>
            <div className="flex items-center gap-2">
              <div className="w-3 h-6 bg-pink-500 rounded shadow-sm"></div>
              <span className="font-semibold [color:var(--tinta)]">Vertical (J1)</span>
              {myRole === 'jogador1' && <span className="text-[10px] [color:var(--tinta-suave)]">(tu)</span>}
            </div>
          </div>

          <div className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all ${myRole === 'jogador2' ? '[background:color-mix(in_srgb,var(--ouro)_12%,transparent)] ring-1 ring-[var(--ouro)]' : ''}`}>
            <div className="flex items-center gap-2">
              <div className="w-6 h-3 bg-cyan-500 rounded shadow-sm"></div>
              <span className="font-semibold [color:var(--tinta)]">Horizontal (J2)</span>
              {myRole === 'jogador2' && <span className="text-[10px] [color:var(--tinta-suave)]">(tu)</span>}
            </div>
          </div>
        </div>

        <div className="text-xs font-medium">
          {isMyTurn
            ? <span className="[color:var(--sucesso)] animate-pulse">É a tua vez de jogar!</span>
            : <span className="[color:var(--tinta-suave)]">A aguardar pela jogada do adversário...</span>}
        </div>

        {isMyTurn && (
          <div className="text-[11px] [color:var(--tinta-suave)] [background:var(--fundo)] px-3 py-1 rounded-full border [border-color:var(--linha)]">
            {myRole === 'jogador1'
              ? 'Clica para colocar um dominó VERTICAL'
              : 'Clica para colocar um dominó HORIZONTAL'}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Quelhas
// ============================================================================

import type { QuelhasState, Segmento, Posicao as QuelhasPosicao } from '../games/quelhas/types';
import { criarSegmentoEntrePosicoes, getCelulasSegmento } from '../games/quelhas/logic';
export type { QuelhasState, Segmento, QuelhasPosicao };

interface QuelhasBoardProps {
  state: QuelhasState;
  isMyTurn: boolean;
  myRole: 'jogador1' | 'jogador2';
  onMove: (segmento: Segmento) => void;
  onSwap?: () => void; // Para a regra de troca
}

export function QuelhasBoard({ state, isMyTurn, myRole, onMove, onSwap }: QuelhasBoardProps) {
  const minhaOrientacao = myRole === 'jogador1' ? state.orientacaoJogador1 : state.orientacaoJogador2;
  const [inicioSelecao, setInicioSelecao] = useState<QuelhasPosicao | null>(null);
  const [segmentoPreviewLocal, setSegmentoPreviewLocal] = useState<Segmento | null>(null);

  const isStartSelectable = (linha: number, coluna: number): boolean => {
    if (!isMyTurn) return false;
    return state.jogadasValidas.some(s =>
      s.orientacao === minhaOrientacao && s.inicio.linha === linha && s.inicio.coluna === coluna
    );
  };

  const getSegmentoForEnd = (linha: number, coluna: number): Segmento | null => {
    if (!isMyTurn || !inicioSelecao) return null;
    const segmento = criarSegmentoEntrePosicoes(
      state,
      { linha: inicioSelecao.linha, coluna: inicioSelecao.coluna },
      { linha, coluna }
    );
    return segmento;
  };

  const isEndSelectable = (linha: number, coluna: number): boolean => {
    if (!isMyTurn || !inicioSelecao) return false;
    return getSegmentoForEnd(linha, coluna) !== null;
  };

  const getCelulaClasses = (linha: number, coluna: number): string => {
    const celula = state.tabuleiro[linha]?.[coluna];
    const isInicio = !!inicioSelecao && inicioSelecao.linha === linha && inicioSelecao.coluna === coluna;
    const isPreview = segmentoPreviewLocal && getCelulasSegmento(segmentoPreviewLocal).some(c => c.linha === linha && c.coluna === coluna);

    let classes = 'aspect-square rounded-sm flex items-center justify-center transition-all duration-150 text-xs font-bold ';

    if (celula === 'ocupada') {
      classes += 'bg-indigo-600 ';
    } else if (isInicio) {
      classes += minhaOrientacao === 'vertical'
        ? 'bg-pink-500 ring-2 ring-pink-300 cursor-pointer scale-110 z-10 '
        : 'bg-cyan-500 ring-2 ring-cyan-300 cursor-pointer scale-110 z-10 ';
    } else if (isPreview) {
      classes += minhaOrientacao === 'vertical'
        ? 'bg-pink-400 ring-2 ring-pink-300 cursor-pointer '
        : 'bg-cyan-400 ring-2 ring-cyan-300 cursor-pointer ';
    } else {
      const startSelectable = isStartSelectable(linha, coluna);
      const endSelectable = isEndSelectable(linha, coluna);

      if ((!inicioSelecao && startSelectable) || (inicioSelecao && endSelectable)) {
        classes += 'bg-gray-100 ring-1 ring-white/10 hover:bg-gray-200 cursor-pointer ';
      } else {
        classes += 'bg-gray-200 opacity-40 ';
      }
    }

    return classes;
  };

  const handleClick = (linha: number, coluna: number) => {
    if (!isMyTurn) return;

    // Se já há uma casa inicial selecionada
    if (inicioSelecao) {
      // Clicar na mesma casa cancela
      if (inicioSelecao.linha === linha && inicioSelecao.coluna === coluna) {
        setInicioSelecao(null);
        return;
      }

      // Tentar formar um segmento completo (início -> fim)
      const segmento = getSegmentoForEnd(linha, coluna);
      if (segmento) {
        onMove(segmento);
        setInicioSelecao(null);
        setSegmentoPreviewLocal(null);
        return;
      }

      // Permite re-selecionar um novo início
      if (isStartSelectable(linha, coluna)) {
        setInicioSelecao({ linha, coluna });
      }
      return;
    }

    // Primeiro clique: selecionar início
    if (isStartSelectable(linha, coluna)) {
      setInicioSelecao({ linha, coluna });
    }
  };

  const isCellEnabled = (linha: number, coluna: number): boolean => {
    if (!isMyTurn) return false;
    if (!inicioSelecao) return isStartSelectable(linha, coluna);
    const isInicio = inicioSelecao.linha === linha && inicioSelecao.coluna === coluna;
    return isInicio || isEndSelectable(linha, coluna) || isStartSelectable(linha, coluna);
  };

  return (
    <div className="space-y-4">
      {/* Aviso Misère */}
      <div className="rounded-lg p-2 text-center border [border-color:var(--ouro)] [background:color-mix(in_srgb,var(--ouro)_10%,transparent)]">
        <p className="[color:var(--tinta)] font-semibold text-[11px] flex items-center justify-center gap-2">
          <span>⚠️</span> MISÈRE: Quem fizer a última jogada PERDE!
        </p>
      </div>

      <div className="aspect-square max-w-md mx-auto relative group">
        <div
          className="grid grid-cols-10 gap-0.5 h-full bg-gray-600 p-1 rounded-xl shadow-2xl"
          onMouseLeave={() => setSegmentoPreviewLocal(null)}
        >
          {state.tabuleiro.map((linha, linhaIdx) =>
            linha.map((_, colunaIdx) => (
              <button
                key={`${linhaIdx}-${colunaIdx}`}
                onClick={() => handleClick(linhaIdx, colunaIdx)}
                onMouseEnter={() => {
                  if (inicioSelecao) {
                    const seg = getSegmentoForEnd(linhaIdx, colunaIdx);
                    setSegmentoPreviewLocal(seg);
                  }
                }}
                className={getCelulaClasses(linhaIdx, colunaIdx)}
                disabled={state.tabuleiro[linhaIdx]?.[colunaIdx] === 'ocupada'}
              />
            ))
          )}
        </div>
      </div>

      {/* Legenda e Stats */}
      <div className="flex flex-col items-center gap-3 text-sm [color:var(--tinta)]">
        <div className="flex justify-center gap-8">
          <div className={`flex items-center gap-2 p-2 rounded-lg transition-all ${myRole === 'jogador1' ? '[background:color-mix(in_srgb,var(--ouro)_12%,transparent)] ring-1 ring-[var(--ouro)]' : ''}`}>
            <div className="w-3 h-6 bg-pink-500 rounded shadow-sm"></div>
            <span className="font-semibold [color:var(--tinta)]">Vertical (J1)</span>
            {myRole === 'jogador1' && <span className="text-[10px] [color:var(--tinta-suave)] ml-1">(tu)</span>}
          </div>

          <div className={`flex items-center gap-2 p-2 rounded-lg transition-all ${myRole === 'jogador2' ? '[background:color-mix(in_srgb,var(--ouro)_12%,transparent)] ring-1 ring-[var(--ouro)]' : ''}`}>
            <div className="w-6 h-3 bg-cyan-500 rounded shadow-sm"></div>
            <span className="font-semibold [color:var(--tinta)]">Horizontal (J2)</span>
            {myRole === 'jogador2' && <span className="text-[10px] [color:var(--tinta-suave)] ml-1">(tu)</span>}
          </div>
        </div>

        <div className="text-xs font-medium">
          {isMyTurn
            ? <span className="[color:var(--sucesso)] animate-pulse">É a tua vez de jogar!</span>
            : <span className="[color:var(--tinta-suave)]">A aguardar pela jogada do adversário...</span>}
        </div>

        {isMyTurn && (
          <div className="text-[11px] [color:var(--tinta-suave)] [background:var(--fundo)] px-3 py-1 rounded-full border [border-color:var(--linha)]">
            {inicioSelecao
              ? 'Clica na casa final para completar o segmento'
              : `Clica na casa inicial para o teu segmento ${minhaOrientacao.toUpperCase()}`}
          </div>
        )}

        {/* Botão de troca se disponível */}
        {state.trocaDisponivel && isMyTurn && onSwap && (
          <button
            onClick={onSwap}
            className="mt-2 px-3 py-1.5 rounded-lg [background:var(--tinta)] [color:var(--fundo)] text-[11px] font-medium hover:[background:var(--tinta-suave)] transition-colors"
          >
            🔄 Usar regra de troca
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Produto
// ============================================================================

import type { ProdutoState, Posicao as ProdutoPosicao } from '../games/produto/types';
export type { ProdutoState, ProdutoPosicao };

interface ProdutoBoardProps {
  state: ProdutoState;
  isMyTurn: boolean;
  myRole: 'jogador1' | 'jogador2';
  onMove: (pos: ProdutoPosicao) => void;
}

export function ProdutoBoard({ state, isMyTurn, myRole, onMove }: ProdutoBoardProps) {
  const [corSelecao, setCorSelecao] = useState<'preta' | 'branca' | null>(null);

  const isJogadaValida = (q: number, r: number): boolean => {
    if (!isMyTurn) return false;
    return state.casasVazias.some(j => j.q === q && j.r === r);
  };

  const getCelulaClasses = (q: number, r: number): string => {
    const celula = state.tabuleiro[`${q},${r}`] || 'vazia';
    const isPecaEmCurso = state.jogadaEmCurso.pos1?.q === q && state.jogadaEmCurso.pos1?.r === r;
    const jogadaValida = isJogadaValida(q, r);

    let classes = 'w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-all duration-200 text-lg ';

    if (celula === 'vazia' && !isPecaEmCurso) {
      classes += 'bg-stone-300 ';
      if (jogadaValida) {
        classes += 'ring-2 ring-green-400 bg-green-200 cursor-pointer hover:bg-green-300 ';
      }
    } else if (celula === 'preta' || (isPecaEmCurso && state.jogadaEmCurso.cor1 === 'preta')) {
      classes += 'bg-red-500 shadow-md ';
    } else if (celula === 'branca' || (isPecaEmCurso && state.jogadaEmCurso.cor1 === 'branca')) {
      classes += 'bg-blue-500 shadow-md ';
    }

    return classes;
  };

  const handleCellClick = (q: number, r: number) => {
    if (!isJogadaValida(q, r)) return;

    // Na primeira jogada do jogo, a cor tem de ser a do jogador
    let cor = corSelecao || (myRole === 'jogador1' ? 'preta' : 'branca');
    if (state.primeiraJogada) {
      cor = myRole === 'jogador1' ? 'preta' : 'branca';
    }

    onMove({ pos: { q, r }, cor } as any);
  };

  // Gerar coordenadas do tabuleiro hexagonal
  const hexCoords = useMemo(() => {
    const coords: { q: number; r: number }[] = [];
    const tamanho = 4; // raio do tabuleiro
    for (let q = -tamanho; q <= tamanho; q++) {
      for (let r = -tamanho; r <= tamanho; r++) {
        if (Math.abs(q + r) <= tamanho) {
          coords.push({ q, r });
        }
      }
    }
    return coords;
  }, []);

  // Converter coordenadas hex para pixel (layout pointy-top)
  const hexToPixel = (q: number, r: number, size: number) => {
    const x = size * Math.sqrt(3) * (q + r / 2);
    const y = size * (3 / 2) * r;
    return { x, y };
  };

  // Calcular bounding box do tabuleiro para centrar perfeitamente
  const boundingBox = useMemo(() => {
    const size = 22; // Tamanho base para o cálculo da BB
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

    for (const pos of hexCoords) {
      const { x, y } = hexToPixel(pos.q, pos.r, size);
      minX = Math.min(minX, x - size);
      maxX = Math.max(maxX, x + size);
      minY = Math.min(minY, y - size);
      maxY = Math.max(maxY, y + size);
    }

    return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
  }, [hexCoords]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl p-4 border [background:var(--fundo)] [border-color:var(--linha)]">
        <label className="[color:var(--tinta-suave)] text-[10px] font-bold uppercase tracking-wider mb-3 block text-center">Cor da peça a colocar</label>
        <div className="flex justify-center gap-4">
          <button
            onClick={() => !state.primeiraJogada && setCorSelecao('preta')}
            disabled={state.primeiraJogada && myRole === 'jogador2'}
            className={`flex-1 max-w-[120px] px-3 py-2 rounded-lg border flex items-center justify-center gap-2 transition-all ${(state.primeiraJogada && myRole === 'jogador1') || (corSelecao === 'preta') || (!state.primeiraJogada && !corSelecao && myRole === 'jogador1')
              ? '[background:color-mix(in_srgb,var(--ouro)_12%,transparent)] [border-color:var(--ouro)] ring-2 ring-[var(--ouro)] [color:var(--tinta)]'
              : '[background:var(--fundo)] [border-color:var(--linha)] [color:var(--tinta-suave)] grayscale'
              } ${state.primeiraJogada && myRole === 'jogador2' ? 'opacity-20 cursor-not-allowed' : ''}`}
          >
            <div className="w-3 h-3 rounded-full bg-gray-900 border border-gray-600"></div>
            <span className="text-xs font-semibold">Preta</span>
          </button>

          <button
            onClick={() => !state.primeiraJogada && setCorSelecao('branca')}
            disabled={state.primeiraJogada && myRole === 'jogador1'}
            className={`flex-1 max-w-[120px] px-3 py-2 rounded-lg border flex items-center justify-center gap-2 transition-all ${(state.primeiraJogada && myRole === 'jogador2') || (corSelecao === 'branca') || (!state.primeiraJogada && !corSelecao && myRole === 'jogador2')
              ? '[background:color-mix(in_srgb,var(--ouro)_12%,transparent)] [border-color:var(--ouro)] ring-2 ring-[var(--ouro)] [color:var(--tinta)]'
              : '[background:var(--fundo)] [border-color:var(--linha)] [color:var(--tinta-suave)] grayscale'
              } ${state.primeiraJogada && myRole === 'jogador1' ? 'opacity-20 cursor-not-allowed' : ''}`}
          >
            <div className="w-3 h-3 rounded-full bg-indigo-50 border border-indigo-300"></div>
            <span className="text-xs font-semibold">Branca</span>
          </button>
        </div>
      </div>

      <div className="relative w-full max-w-sm mx-auto flex justify-center py-4">
        <svg
          width={boundingBox.width + 20}
          height={boundingBox.height + 20}
          viewBox={`-10 -10 ${boundingBox.width + 20} ${boundingBox.height + 20}`}
          className="max-w-full drop-shadow-2xl"
        >
          <defs>
            <linearGradient id="gradPreta" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#4b5563" />
              <stop offset="100%" stopColor="#000000" />
            </linearGradient>
            <linearGradient id="gradBranca" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#cbd5e1" />
            </linearGradient>
            <filter id="glowGreen" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {hexCoords.map(({ q, r }) => {
            const size = 22;
            const { x, y } = hexToPixel(q, r, size);
            const celula = state.tabuleiro[`${q},${r}`] || 'vazia';
            const isPecaEmCurso = state.jogadaEmCurso.pos1?.q === q && state.jogadaEmCurso.pos1?.r === r;
            const jogadaValida = isJogadaValida(q, r);

            // Cores base para as células (hexágonos do fundo)
            let hexFill = '#f5f5f5'; // bg-stone-100
            let hexStroke = '#d1d5db'; // gray-300
            let hexStrokeWidth = 1.5;

            if (isPecaEmCurso) {
              hexStroke = '#10b981'; // emerald-500
              hexStrokeWidth = 3;
            }

            // Hexagonal polygon points (pointy-top)
            const points = [];
            for (let i = 0; i < 6; i++) {
              const angle = Math.PI / 180 * (60 * i - 90);
              points.push(`${x + size * Math.cos(angle) - boundingBox.minX},${y + size * Math.sin(angle) - boundingBox.minY}`);
            }

            return (
              <g key={`${q},${r}`} onClick={() => handleCellClick(q, r)} className={jogadaValida ? 'cursor-pointer group' : ''}>
                <polygon
                  points={points.join(' ')}
                  fill={hexFill}
                  stroke={hexStroke}
                  strokeWidth={hexStrokeWidth}
                  className="transition-all duration-300 group-hover:fill-gray-200"
                />

                {/* Pedras colocadas ou em curso (círculos estilizados) */}
                {(celula !== 'vazia' || isPecaEmCurso) && (
                  <circle
                    cx={x - boundingBox.minX}
                    cy={y - boundingBox.minY}
                    r={size * 0.7}
                    fill={(celula === 'preta' || (isPecaEmCurso && state.jogadaEmCurso.cor1 === 'preta')) ? 'url(#gradPreta)' : 'url(#gradBranca)'}
                    stroke={(celula === 'preta' || (isPecaEmCurso && state.jogadaEmCurso.cor1 === 'preta')) ? '#000' : '#94a3b8'}
                    strokeWidth="1"
                    className="drop-shadow-md transition-all duration-500"
                  />
                )}

                {/* Destaque de jogada válida */}
                {celula === 'vazia' && !isPecaEmCurso && jogadaValida && (
                  <circle
                    cx={x - boundingBox.minX}
                    cy={y - boundingBox.minY}
                    r={size * 0.4}
                    fill="#10b981"
                    className="opacity-40 filter-none group-hover:opacity-60 transition-opacity animate-pulse"
                  />
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Pontuação */}
      <div className="flex flex-col items-center gap-3 text-sm [color:var(--tinta)]">
        <div className="flex justify-center gap-8">
          <div className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all ${myRole === 'jogador1' ? '[background:color-mix(in_srgb,var(--ouro)_12%,transparent)] ring-1 ring-[var(--ouro)]' : ''}`}>
            <div className="flex items-center gap-2">
              <span className="text-xl">🔴</span>
              <span className="font-semibold [color:var(--tinta)]">Pretas (J1)</span>
              {myRole === 'jogador1' && <span className="text-[10px] [color:var(--tinta-suave)]">(tu)</span>}
            </div>
            <div className="text-[10px] [color:var(--tinta-suave)]">
              Grupo: {state.pontuacaoPretas.maiorGrupo} / {state.pontuacaoPretas.segundoMaiorGrupo} | Produto: {state.pontuacaoPretas.produto}
            </div>
          </div>

          <div className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all ${myRole === 'jogador2' ? '[background:color-mix(in_srgb,var(--ouro)_12%,transparent)] ring-1 ring-[var(--ouro)]' : ''}`}>
            <div className="flex items-center gap-2">
              <span className="text-xl">🔵</span>
              <span className="font-semibold [color:var(--tinta)]">Brancas (J2)</span>
              {myRole === 'jogador2' && <span className="text-[10px] [color:var(--tinta-suave)]">(tu)</span>}
            </div>
            <div className="text-[10px] [color:var(--tinta-suave)]">
              Grupo: {state.pontuacaoBrancas.maiorGrupo} / {state.pontuacaoBrancas.segundoMaiorGrupo} | Produto: {state.pontuacaoBrancas.produto}
            </div>
          </div>
        </div>

        <div className="text-xs font-medium">
          {isMyTurn
            ? <span className="[color:var(--sucesso)] animate-pulse">É a tua vez de jogar!</span>
            : <span className="[color:var(--tinta-suave)]">A aguardar pela jogada do adversário...</span>}
        </div>

        {isMyTurn && (
          <div className="text-[11px] [color:var(--tinta-suave)] [background:var(--fundo)] px-3 py-1 rounded-full border [border-color:var(--linha)]">
            {state.jogadaEmCurso.pos1
              ? 'Coloca a segunda peça'
              : `Coloca a primeira peça (${state.primeiraJogada ? 'cor obrigatória' : 'qualquer cor'})`}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Atari Go
// ============================================================================

import type { AtariGoState, Posicao as AtariGoPosicao } from '../games/atari-go/types';
export type { AtariGoState, AtariGoPosicao };

interface AtariGoBoardProps {
  state: AtariGoState;
  isMyTurn: boolean;
  myRole: 'jogador1' | 'jogador2'; // jogador1 = Preto, jogador2 = Branco
  onMove: (pos: AtariGoPosicao) => void;
}

export function AtariGoBoard({ state, isMyTurn, myRole, onMove }: AtariGoBoardProps) {
  const tamanho = state.tabuleiro.length;

  const isJogadaValida = (linha: number, coluna: number): boolean => {
    if (!isMyTurn) return false;
    return state.jogadasValidas.some(j => j.linha === linha && j.coluna === coluna);
  };

  const isUltimaJogada = (linha: number, coluna: number): boolean => {
    return state.ultimaJogada !== null &&
      state.ultimaJogada.linha === linha &&
      state.ultimaJogada.coluna === coluna;
  };

  const renderIntersecao = (linha: number, coluna: number) => {
    const celula = state.tabuleiro[linha]?.[coluna];
    const ultimaJogada = isUltimaJogada(linha, coluna);
    const jogadaValida = isJogadaValida(linha, coluna);

    const isTop = linha === 0;
    const isBottom = linha === tamanho - 1;
    const isLeft = coluna === 0;
    const isRight = coluna === tamanho - 1;

    return (
      <button
        key={`${linha}-${coluna}`}
        onClick={() => jogadaValida && onMove({ linha, coluna })}
        className={`relative w-full aspect-square ${jogadaValida ? 'cursor-pointer' : 'cursor-default'}`}
        disabled={!jogadaValida || !isMyTurn}
      >
        {/* Linhas do grid */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className={`absolute h-[2px] bg-gray-800/60 top-1/2 -translate-y-1/2 ${isLeft ? 'left-1/2 right-0' : isRight ? 'left-0 right-1/2' : 'left-0 right-0'}`} />
          <div className={`absolute w-[2px] bg-gray-800/60 left-1/2 -translate-x-1/2 ${isTop ? 'top-1/2 bottom-0' : isBottom ? 'top-0 bottom-1/2' : 'top-0 bottom-0'}`} />
        </div>

        {/* Hoshi (star points) */}
        {((linha === 2 || linha === 4 || linha === 6) && (coluna === 2 || coluna === 4 || coluna === 6)) && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-gray-800 rounded-full z-10" />
        )}

        {/* Pedra */}
        {celula !== 'vazia' && (
          <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[85%] h-[85%] rounded-full z-20 shadow-md ${celula === 'preta'
            ? 'bg-gradient-to-br from-gray-700 via-gray-900 to-black'
            : 'bg-gradient-to-br from-white via-gray-100 to-gray-200 border border-gray-300'
            } ${ultimaJogada ? 'ring-2 ring-yellow-400' : ''}`}>
            {/* Brilho */}
            <div className={`absolute top-1 left-1 w-2 h-2 rounded-full ${celula === 'preta' ? 'bg-gray-600' : 'bg-white'} opacity-60`} />
            {/* Marcador de última jogada */}
            {ultimaJogada && (
              <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full ${celula === 'preta' ? 'bg-white' : 'bg-black'}`} />
            )}
          </div>
        )}

        {/* Indicador de jogada válida */}
        {celula === 'vazia' && jogadaValida && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40%] h-[40%] rounded-full bg-green-400 opacity-40 z-10 hover:opacity-70 transition-opacity" />
        )}
      </button>
    );
  };

  return (
    <div className="space-y-4">
      {/* Tabuleiro */}
      <div className="aspect-square max-w-sm mx-auto p-4 rounded-xl shadow-lg relative bg-amber-200"
        style={{ backgroundImage: 'linear-gradient(135deg, #f5d89a 0%, #e8c76b 100%)' }}>
        <div className="grid grid-cols-9 h-full w-full">
          {Array.from({ length: tamanho }, (_, l) =>
            Array.from({ length: tamanho }, (_, c) => renderIntersecao(l, c))
          )}
        </div>
      </div>

      {/* Legenda e Stats */}
      <div className="flex flex-col items-center gap-3 text-sm [color:var(--tinta)]">
        <div className="flex justify-center gap-8">
          <div className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all ${myRole === 'jogador1' ? '[background:color-mix(in_srgb,var(--ouro)_12%,transparent)] ring-1 ring-[var(--ouro)]' : ''}`}>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-black shadow-sm" />
              <span className="font-semibold [color:var(--tinta)]">Pretos (J1)</span>
              {myRole === 'jogador1' && <span className="text-[10px] [color:var(--tinta-suave)]">(tu)</span>}
            </div>
            <div className="text-xs [color:var(--tinta-suave)]">Capturas: {state.pedrasCapturadas.brancas}</div>
          </div>

          <div className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all ${myRole === 'jogador2' ? '[background:color-mix(in_srgb,var(--ouro)_12%,transparent)] ring-1 ring-[var(--ouro)]' : ''}`}>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-white border border-gray-300 shadow-sm" />
              <span className="font-semibold [color:var(--tinta)]">Brancos (J2)</span>
              {myRole === 'jogador2' && <span className="text-[10px] [color:var(--tinta-suave)]">(tu)</span>}
            </div>
            <div className="text-xs [color:var(--tinta-suave)]">Capturas: {state.pedrasCapturadas.pretas}</div>
          </div>
        </div>

        <div className="px-4 py-1.5 rounded-full text-[11px] flex items-center gap-2 border [border-color:var(--perigo)] [color:var(--perigo)] [background:color-mix(in_srgb,var(--perigo)_10%,transparent)]">
          <span>⚔️</span>
          <span><b>Objetivo:</b> A primeira captura vence o jogo!</span>
        </div>

        <div className="text-xs font-medium">
          {isMyTurn
            ? <span className="[color:var(--sucesso)] animate-pulse">É a tua vez de jogar!</span>
            : <span className="[color:var(--tinta-suave)]">A aguardar pela jogada do adversário...</span>}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Nex
// ============================================================================

import type { NexState, Posicao as NexPosicao } from '../games/nex/types';
export type { NexState, NexPosicao };

interface NexBoardProps {
  state: NexState;
  isMyTurn: boolean;
  myRole: 'jogador1' | 'jogador2';
  onMove: (pos: NexPosicao) => void;
}

export function NexBoard({ state, isMyTurn, myRole, onMove }: NexBoardProps) {
  const [tipoAcao, setTipoAcao] = useState<'colocacao' | 'substituicao' | null>(null);
  const [selecao, setSelecao] = useState<{
    posPropria?: NexPosicao;
    posNeutra?: NexPosicao;
    neutrasParaProprias: NexPosicao[];
    propriaParaNeutra?: NexPosicao;
  }>({ neutrasParaProprias: [] });

  const [tipoSelecao, setTipoSelecao] = useState<'propria' | 'neutra'>('propria');
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const boardDraggableRef = useRef<HTMLDivElement>(null);

  const handleCellClick = (x: number, y: number) => {
    if (!isMyTurn) return;

    const celula = state.tabuleiro[x]?.[y];
    const corJogadorLocal = getCorJogador(state, state.jogadorAtual);

    if (tipoAcao === 'colocacao') {
      if (celula !== 'vazia') return;

      if (!selecao.posPropria && tipoSelecao === 'propria') {
        setSelecao({ ...selecao, posPropria: { x, y } });
      } else if (!selecao.posNeutra && tipoSelecao === 'neutra') {
        const p1 = selecao.posPropria;
        if (p1) {
          onMove({
            tipo: 'colocacao',
            posPropria: p1,
            posNeutra: { x, y }
          } as any);
          setSelecao({ neutrasParaProprias: [] });
          setTipoAcao(null);
        }
      }
    } else if (tipoAcao === 'substituicao') {
      if (tipoSelecao === 'neutra') {
        if (celula !== 'neutra') return;
        if (selecao.neutrasParaProprias.some(p => p.x === x && p.y === y)) return;
        if (selecao.neutrasParaProprias.length < 2) {
          setSelecao({ ...selecao, neutrasParaProprias: [...selecao.neutrasParaProprias, { x, y }] });
        }
      } else if (tipoSelecao === 'propria') {
        if (celula !== corJogadorLocal) return;
        if (selecao.neutrasParaProprias.length === 2) {
          onMove({
            tipo: 'substituicao',
            neutrasParaProprias: selecao.neutrasParaProprias as [NexPosicao, NexPosicao],
            propriaParaNeutra: { x, y }
          } as any);
          setSelecao({ neutrasParaProprias: [] });
          setTipoAcao(null);
        }
      }
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as SVGElement;
    if (target.tagName === 'polygon' || target.closest('polygon')) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPanOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const resetPan = () => setPanOffset({ x: 0, y: 0 });

  const HEX_SIZE = 16;
  const HEX_WIDTH = Math.sqrt(3) * HEX_SIZE;
  const HEX_HEIGHT = 2 * HEX_SIZE;

  const getHexPosition = (row: number, col: number) => {
    const x = (row + col) * HEX_HEIGHT * 0.75;
    const y = (row - col) * HEX_WIDTH / 2;
    return { x, y };
  };

  const hexPoints = (cx: number, cy: number, size: number): string => {
    const points: string[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i;
      const px = cx + size * Math.cos(angle);
      const py = cy + size * Math.sin(angle);
      points.push(`${px},${py}`);
    }
    return points.join(' ');
  };

  const xRange = (11 * 2 - 1) * HEX_HEIGHT * 0.75;
  const yRange = 11 * HEX_WIDTH;
  const centerY = yRange / 2 + HEX_SIZE * 2;

  const handleSelectTipoAcao = (tipo: 'colocacao' | 'substituicao') => {
    setTipoAcao(tipo);
    setSelecao({ neutrasParaProprias: [] });
    setTipoSelecao(tipo === 'colocacao' ? 'propria' : 'neutra');
  };

  const handleCancelar = () => {
    setTipoAcao(null);
    setSelecao({ neutrasParaProprias: [] });
  };

  return (
    <div className="space-y-4">
      {/* Seletor de Ação */}
      <div className="rounded-xl p-3 border [background:var(--fundo)] [border-color:var(--linha)]">
        <div className="flex justify-center gap-3 mb-2">
          <button
            onClick={() => handleSelectTipoAcao('colocacao')}
            className={`px-3 py-1.5 rounded-lg font-medium text-xs transition-all ${tipoAcao === 'colocacao' ? 'border border-transparent [background:var(--tinta)] [color:var(--fundo)]' : 'border [border-color:var(--linha)] [color:var(--tinta-suave)] hover:[background:color-mix(in_srgb,var(--tinta)_6%,transparent)]'}`}
          >
            Colocação
          </button>
          <button
            onClick={() => handleSelectTipoAcao('substituicao')}
            className={`px-3 py-1.5 rounded-lg font-medium text-xs transition-all ${tipoAcao === 'substituicao' ? 'border border-transparent [background:var(--tinta)] [color:var(--fundo)]' : 'border [border-color:var(--linha)] [color:var(--tinta-suave)] hover:[background:color-mix(in_srgb,var(--tinta)_6%,transparent)]'}`}
          >
            Substituição
          </button>
          {state.swapDisponivel && (
            <button
              onClick={() => onMove({ type: 'nex_swap' } as any)}
              className="px-3 py-1.5 rounded-lg font-medium text-xs [background:var(--tinta)] [color:var(--fundo)]"
            >
              🔄 Swap
            </button>
          )}
          {tipoAcao && (
            <button onClick={handleCancelar} className="px-2 py-1 [color:var(--perigo)] text-xs underline ml-2">Cancelar</button>
          )}
        </div>

        {tipoAcao && (
          <div className="flex justify-center gap-2 mt-2">
            <button
              onClick={() => setTipoSelecao('propria')}
              className={`px-2 py-1 rounded text-[10px] ${tipoSelecao === 'propria' ? '[background:color-mix(in_srgb,var(--tinta)_12%,transparent)] [color:var(--tinta)]' : '[background:var(--fundo)] [color:var(--tinta-suave)]'}`}
            >
              {tipoAcao === 'colocacao' ? 'Própria' : 'Sua (Sacrifício)'}
            </button>
            <button
              onClick={() => setTipoSelecao('neutra')}
              className={`px-2 py-1 rounded text-[10px] ${tipoSelecao === 'neutra' ? '[background:color-mix(in_srgb,var(--tinta)_12%,transparent)] [color:var(--tinta)]' : '[background:var(--fundo)] [color:var(--tinta-suave)]'}`}
            >
              Neutras {tipoAcao === 'substituicao' && `(${selecao.neutrasParaProprias.length}/2)`}
            </button>
          </div>
        )}
      </div>

      {/* Tabuleiro */}
      <div className="relative group">
        {(panOffset.x !== 0 || panOffset.y !== 0) && (
          <button onClick={resetPan} className="absolute top-2 right-2 z-10 px-2 py-1 [background:var(--tinta)] [color:var(--fundo)] text-[10px] rounded-lg [box-shadow:var(--sombra)]">↺ Reset</button>
        )}

        <div className="overflow-hidden rounded-xl border [background:var(--fundo)] [border-color:var(--linha)] cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={() => setIsDragging(false)} onMouseLeave={() => setIsDragging(false)}>
          <div style={{ transform: `translate(${panOffset.x}px, ${panOffset.y}px)`, transition: isDragging ? 'none' : 'transform 0.1s' }} className="p-12 inline-block relative">
            {/* Indicadores de canto */}
            <div className="absolute top-0 left-0 w-4 h-4 rounded-full bg-gray-800" />
            <div className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-gray-800" />
            <div className="absolute top-0 right-0 w-4 h-4 rounded-full bg-white border border-gray-800" />
            <div className="absolute bottom-0 left-0 w-4 h-4 rounded-full bg-white border border-gray-800" />

            <svg width={xRange + 50} height={yRange + 50} viewBox={`-20 ${-centerY} ${xRange + 40} ${yRange + 40}`}>
              {Array.from({ length: 11 }, (_, row) => (
                Array.from({ length: 11 }, (_, col) => {
                  const pos = getHexPosition(row, col);
                  const celula = state.tabuleiro[col]?.[row];
                  const selecionada = (tipoAcao === 'colocacao' && ((selecao.posPropria?.x === col && selecao.posPropria?.y === row) || (selecao.posNeutra?.x === col && selecao.posNeutra?.y === row))) ||
                    (tipoAcao === 'substituicao' && (selecao.neutrasParaProprias.some(p => p.x === col && p.y === row) || (selecao.propriaParaNeutra?.x === col && selecao.propriaParaNeutra?.y === row)));

                  let fill = '#fef3c7'; // amber-100
                  if (celula === 'preta') fill = '#1f2937';
                  else if (celula === 'branca') fill = '#ffffff';
                  else if (celula === 'neutra') fill = '#9ca3af';

                  return (
                    <polygon
                      key={`${col}-${row}`}
                      points={hexPoints(pos.x, pos.y, HEX_SIZE - 1)}
                      fill={fill}
                      stroke={selecionada ? '#4ade80' : '#92400e'}
                      strokeWidth={selecionada ? 3 : 1}
                      className="cursor-pointer hover:opacity-80"
                      onClick={() => handleCellClick(col, row)}
                    />
                  );
                })
              ))}
            </svg>
          </div>
        </div>
      </div>

      <div className="text-center">
        <div className="text-[11px] [color:var(--tinta-suave)] font-medium uppercase tracking-wider mb-2">Legenda</div>
        <div className="flex justify-center gap-4 text-xs [color:var(--tinta-suave)]">
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-gray-900" /> Pretas (↖↘)</div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-white border border-gray-400" /> Brancas (↗↙)</div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-gray-400" /> Neutras</div>
        </div>
      </div>

      <div className="text-center text-xs">
        {isMyTurn
          ? <span className="[color:var(--sucesso)] font-medium animate-pulse">É a tua vez! {tipoAcao ? 'Completa a ação.' : 'Escolhe uma ação.'}</span>
          : <span className="[color:var(--tinta-suave)]">A aguardar adversário...</span>}
      </div>
    </div>
  );
}
