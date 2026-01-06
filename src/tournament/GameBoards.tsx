/**
 * Componentes de tabuleiro "puros" para o modo campeonato.
 * 
 * Estes componentes:
 * - Recebem o estado do jogo como prop
 * - Emitem jogadas via callback (onMove)
 * - NÃO gerem estado internamente
 * - São controlados pelo servidor/mock
 */

import { useMemo, useState } from 'react';

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

      {/* Legenda */}
      <div className="flex flex-col items-center gap-2 text-sm text-white/70">
        <div className="flex justify-center gap-6">
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${myRole === 'jogador1' ? 'bg-orange-500/30 ring-2 ring-orange-400' : ''}`}>
            <span className="text-xl">🐱</span>
            <span>Gatos: {state.totalGatos}</span>
            {myRole === 'jogador1' && <span className="text-xs">(tu)</span>}
          </div>
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${myRole === 'jogador2' ? 'bg-blue-500/30 ring-2 ring-blue-400' : ''}`}>
            <span className="text-xl">🐶</span>
            <span>Cães: {state.totalCaes}</span>
            {myRole === 'jogador2' && <span className="text-xs">(tu)</span>}
          </div>
        </div>
        <div className="text-xs text-white/50">
          {isMyTurn ? `É a tua vez! (${state.jogadasValidas.length} jogadas disponíveis)` : 'A aguardar adversário...'}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Dominório
// ============================================================================

import type { DominorioState, Domino, Posicao as DominorioPosicao } from '../games/dominorio/types';
export type { DominorioState, Domino, DominorioPosicao };

interface DominorioBoardProps {
  state: DominorioState;
  isMyTurn: boolean;
  myRole: 'jogador1' | 'jogador2'; // jogador1 = Vertical, jogador2 = Horizontal
  onMove: (domino: Domino) => void;
}

export function DominorioBoard({ state, isMyTurn, myRole, onMove }: DominorioBoardProps) {
  const minhaOrientacao = myRole === 'jogador1' ? 'vertical' : 'horizontal';

  // Encontrar dominó válido que começa nesta posição
  const getDominoInicio = (linha: number, coluna: number): Domino | null => {
    if (!isMyTurn) return null;
    return state.jogadasValidas.find(d =>
      d.pos1.linha === linha && d.pos1.coluna === coluna
    ) || null;
  };

  const getCelulaClasses = (linha: number, coluna: number): string => {
    const celula = state.tabuleiro[linha]?.[coluna];
    const dominoValido = getDominoInicio(linha, coluna);

    let classes = 'aspect-square rounded-sm flex items-center justify-center transition-all duration-200 ';

    if (celula === 'vazia') {
      classes += 'bg-amber-100 ';
      if (dominoValido) {
        classes += 'ring-2 ring-green-400 bg-green-100 cursor-pointer hover:bg-green-200 ';
      }
    } else if (celula === 'ocupada-vertical') {
      classes += 'bg-blue-400 ';
    } else {
      classes += 'bg-orange-400 ';
    }

    return classes;
  };

  const handleClick = (linha: number, coluna: number) => {
    const domino = getDominoInicio(linha, coluna);
    if (domino) {
      onMove(domino);
    }
  };

  return (
    <div className="space-y-4">
      <div className="aspect-square max-w-md mx-auto">
        <div className="grid grid-cols-8 gap-0.5 h-full bg-amber-900 p-2 rounded-xl">
          {state.tabuleiro.map((linha, linhaIdx) =>
            linha.map((celula, colunaIdx) => (
              <button
                key={`${linhaIdx}-${colunaIdx}`}
                onClick={() => handleClick(linhaIdx, colunaIdx)}
                className={getCelulaClasses(linhaIdx, colunaIdx)}
                disabled={!getDominoInicio(linhaIdx, colunaIdx)}
              />
            ))
          )}
        </div>
      </div>

      {/* Legenda */}
      <div className="flex flex-col items-center gap-2 text-sm text-white/70">
        <div className="flex justify-center gap-6">
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${myRole === 'jogador1' ? 'bg-blue-500/30 ring-2 ring-blue-400' : ''}`}>
            <div className="w-3 h-6 bg-blue-400 rounded"></div>
            <span>Vertical</span>
            {myRole === 'jogador1' && <span className="text-xs">(tu)</span>}
          </div>
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${myRole === 'jogador2' ? 'bg-orange-500/30 ring-2 ring-orange-400' : ''}`}>
            <div className="w-6 h-3 bg-orange-400 rounded"></div>
            <span>Horizontal</span>
            {myRole === 'jogador2' && <span className="text-xs">(tu)</span>}
          </div>
        </div>
        <div className="text-xs text-white/50">
          {isMyTurn ? `É a tua vez! (${state.jogadasValidas.length} jogadas disponíveis)` : 'A aguardar adversário...'}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Quelhas
// ============================================================================

import type { QuelhasState, Segmento, Posicao as QuelhasPosicao } from '../games/quelhas/types';
import { criarSegmentoEntrePosicoes } from '../games/quelhas/logic';
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
    const startSelectable = isStartSelectable(linha, coluna);
    const endSelectable = isEndSelectable(linha, coluna);

    let classes = 'aspect-square rounded-sm flex items-center justify-center transition-all duration-200 text-xs ';

    if (celula === 'vazia') {
      classes += 'bg-stone-200 ';
      if (isInicio) classes += 'ring-2 ring-sky-400 bg-sky-100 ';
      if (!inicioSelecao && startSelectable) classes += 'ring-2 ring-green-400 bg-green-100 cursor-pointer hover:bg-green-200 ';
      if (inicioSelecao && endSelectable) classes += 'ring-2 ring-green-400 bg-green-100 cursor-pointer hover:bg-green-200 ';
      if (inicioSelecao && startSelectable && !isInicio && !endSelectable) classes += 'ring-2 ring-emerald-400/60 bg-emerald-50/70 cursor-pointer hover:bg-emerald-100 ';
    } else {
      classes += 'bg-stone-600 ';
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
      {/* Botão de troca se disponível */}
      {state.trocaDisponivel && isMyTurn && onSwap && (
        <div className="text-center">
          <button
            onClick={onSwap}
            className="px-4 py-2 rounded-lg bg-purple-500/30 border border-purple-400/50 text-purple-200 text-sm hover:bg-purple-500/50 transition-colors"
          >
            🔄 Usar regra de troca (trocar de orientação)
          </button>
        </div>
      )}

      <div className="aspect-square max-w-md mx-auto">
        <div className="grid grid-cols-10 gap-0.5 h-full bg-stone-800 p-2 rounded-xl">
          {state.tabuleiro.map((linha, linhaIdx) =>
            linha.map((celula, colunaIdx) => (
              <button
                key={`${linhaIdx}-${colunaIdx}`}
                onClick={() => handleClick(linhaIdx, colunaIdx)}
                className={getCelulaClasses(linhaIdx, colunaIdx)}
                disabled={!isCellEnabled(linhaIdx, colunaIdx)}
              />
            ))
          )}
        </div>
      </div>

      {/* Legenda */}
      <div className="flex flex-col items-center gap-2 text-sm text-white/70">
        <div className="flex justify-center gap-6">
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${myRole === 'jogador1' ? 'bg-blue-500/30 ring-2 ring-blue-400' : ''}`}>
            <span>{state.orientacaoJogador1 === 'vertical' ? '↕️' : '↔️'}</span>
            <span>{state.orientacaoJogador1 === 'vertical' ? 'Vertical' : 'Horizontal'}</span>
            {myRole === 'jogador1' && <span className="text-xs">(tu)</span>}
          </div>
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${myRole === 'jogador2' ? 'bg-orange-500/30 ring-2 ring-orange-400' : ''}`}>
            <span>{state.orientacaoJogador2 === 'vertical' ? '↕️' : '↔️'}</span>
            <span>{state.orientacaoJogador2 === 'vertical' ? 'Vertical' : 'Horizontal'}</span>
            {myRole === 'jogador2' && <span className="text-xs">(tu)</span>}
          </div>
        </div>
        <div className="text-xs text-yellow-300/70">
          ⚠️ ATENÇÃO: Neste jogo PERDE quem fizer a última jogada!
        </div>
        <div className="text-xs text-white/50">
          {isMyTurn ? `É a tua vez! (${state.jogadasValidas.length} jogadas disponíveis)` : 'A aguardar adversário...'}
        </div>
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

    // Se ainda não escolheu cor, mostrar um pequeno seletor ou usar cor padrão
    // No modo campeonato, o Produto permite colocar QUALQUER cor.
    // Para simplificar a UI de torneio, se não houver cor selecionada, 
    // assumimos que o jogador quer colocar a sua própria cor primeiro.
    const cor = corSelecao || (myRole === 'jogador1' ? 'preta' : 'branca');
    onMove({ q, r, cor } as any);
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
  const hexToPixel = (q: number, r: number) => {
    const size = 25;
    const x = size * (Math.sqrt(3) * q + Math.sqrt(3) / 2 * r);
    const y = size * (3 / 2 * r);
    return { x: x + 200, y: y + 200 }; // offset para centrar
  };

  return (
    <div className="space-y-4">
      <div className="text-center mb-2">
        <label className="text-white/70 text-sm mb-2 block">Escolhe a cor da peça a colocar:</label>
        <div className="flex justify-center gap-4">
          <button
            onClick={() => setCorSelecao('preta')}
            className={`px-4 py-2 rounded-lg border flex items-center gap-2 transition-all ${corSelecao === 'preta' || (!corSelecao && myRole === 'jogador1') ? 'bg-red-500/40 border-red-400 ring-2 ring-red-400' : 'bg-white/5 border-white/20'}`}
          >
            🔴 Preta
          </button>
          <button
            onClick={() => setCorSelecao('branca')}
            className={`px-4 py-2 rounded-lg border flex items-center gap-2 transition-all ${corSelecao === 'branca' || (!corSelecao && myRole === 'jogador2') ? 'bg-blue-500/40 border-blue-400 ring-2 ring-blue-400' : 'bg-white/5 border-white/20'}`}
          >
            🔵 Branca
          </button>
        </div>
      </div>

      <div className="relative w-full max-w-md mx-auto h-[350px]">
        <svg viewBox="0 0 400 400" className="w-full h-full">
          {hexCoords.map(({ q, r }) => {
            const { x, y } = hexToPixel(q, r);
            const celula = state.tabuleiro[`${q},${r}`] || 'vazia';
            const isPecaEmCurso = state.jogadaEmCurso.pos1?.q === q && state.jogadaEmCurso.pos1?.r === r;
            const jogadaValida = isJogadaValida(q, r);

            let fill = '#d6d3d1'; // stone-300
            if (celula === 'preta' || (isPecaEmCurso && state.jogadaEmCurso.cor1 === 'preta')) fill = '#ef4444'; // red-500
            else if (celula === 'branca' || (isPecaEmCurso && state.jogadaEmCurso.cor1 === 'branca')) fill = '#3b82f6'; // blue-500
            else if (jogadaValida) fill = '#86efac'; // green-300

            return (
              <g key={`${q},${r}`}>
                <circle
                  cx={x}
                  cy={y}
                  r={20}
                  fill={fill}
                  stroke={jogadaValida ? '#22c55e' : '#a8a29e'}
                  strokeWidth={jogadaValida ? 3 : 1}
                  className={jogadaValida ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}
                  onClick={() => handleCellClick(q, r)}
                />
              </g>
            );
          })}
        </svg>
      </div>

      {/* Pontuação */}
      <div className="flex flex-col items-center gap-2 text-sm text-white/70">
        <div className="flex justify-center gap-6">
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${myRole === 'jogador1' ? 'bg-red-500/30 ring-2 ring-red-400' : ''}`}>
            <span className="text-xl">🔴</span>
            <span>Pontos: {state.pontuacaoPretas.produto}</span>
            {myRole === 'jogador1' && <span className="text-xs">(tu)</span>}
          </div>
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${myRole === 'jogador2' ? 'bg-blue-500/30 ring-2 ring-blue-400' : ''}`}>
            <span className="text-xl">🔵</span>
            <span>Pontos: {state.pontuacaoBrancas.produto}</span>
            {myRole === 'jogador2' && <span className="text-xs">(tu)</span>}
          </div>
        </div>
        <div className="text-xs text-white/50">
          {isMyTurn
            ? (state.jogadaEmCurso.pos1
              ? 'Coloca a segunda peça'
              : `É a tua vez! (${state.casasVazias.length} casas disponíveis)`)
            : 'A aguardar adversário...'}
        </div>
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

  const getCelulaClasses = (linha: number, coluna: number): string => {
    const celula = state.tabuleiro[linha]?.[coluna];
    const jogadaValida = isJogadaValida(linha, coluna);

    let classes = 'aspect-square flex items-center justify-center transition-all duration-200 ';

    if (jogadaValida) {
      classes += 'cursor-pointer ';
    }

    return classes;
  };

  return (
    <div className="space-y-4">
      <div className="aspect-square max-w-md mx-auto bg-amber-200 p-4 rounded-xl">
        {/* Linhas do tabuleiro */}
        <div className="relative w-full h-full">
          {/* Grid de linhas */}
          <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${tamanho - 1} ${tamanho - 1}`} preserveAspectRatio="none">
            {/* Linhas horizontais */}
            {Array.from({ length: tamanho }).map((_, i) => (
              <line key={`h${i}`} x1="0" y1={i} x2={tamanho - 1} y2={i} stroke="#8B7355" strokeWidth="0.05" />
            ))}
            {/* Linhas verticais */}
            {Array.from({ length: tamanho }).map((_, i) => (
              <line key={`v${i}`} x1={i} y1="0" x2={i} y2={tamanho - 1} stroke="#8B7355" strokeWidth="0.05" />
            ))}
          </svg>

          {/* Pedras e interações */}
          <div className={`grid gap-0 h-full`} style={{ gridTemplateColumns: `repeat(${tamanho}, 1fr)` }}>
            {state.tabuleiro.map((linha, linhaIdx) =>
              linha.map((celula, colunaIdx) => {
                const jogadaValida = isJogadaValida(linhaIdx, colunaIdx);
                return (
                  <button
                    key={`${linhaIdx}-${colunaIdx}`}
                    onClick={() => jogadaValida && onMove({ linha: linhaIdx, coluna: colunaIdx })}
                    className={getCelulaClasses(linhaIdx, colunaIdx)}
                    disabled={!jogadaValida}
                  >
                    {celula === 'preta' && (
                      <div className="w-[90%] h-[90%] rounded-full bg-gray-900 shadow-lg" />
                    )}
                    {celula === 'branca' && (
                      <div className="w-[90%] h-[90%] rounded-full bg-white shadow-lg border border-gray-300" />
                    )}
                    {celula === 'vazia' && jogadaValida && (
                      <div className="w-[60%] h-[60%] rounded-full bg-green-400/50 ring-2 ring-green-500" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Legenda */}
      <div className="flex flex-col items-center gap-2 text-sm text-white/70">
        <div className="flex justify-center gap-6">
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${myRole === 'jogador1' ? 'bg-gray-700/50 ring-2 ring-gray-400' : ''}`}>
            <div className="w-4 h-4 rounded-full bg-gray-900" />
            <span>Preto</span>
            {myRole === 'jogador1' && <span className="text-xs">(tu)</span>}
          </div>
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${myRole === 'jogador2' ? 'bg-white/30 ring-2 ring-white/50' : ''}`}>
            <div className="w-4 h-4 rounded-full bg-white border border-gray-300" />
            <span>Branco</span>
            {myRole === 'jogador2' && <span className="text-xs">(tu)</span>}
          </div>
        </div>
        <div className="text-xs text-yellow-300/70">
          ⚡ A primeira captura vence!
        </div>
        <div className="text-xs text-white/50">
          {isMyTurn ? `É a tua vez! (${state.jogadasValidas.length} jogadas disponíveis)` : 'A aguardar adversário...'}
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
  const [tipoAcao, setTipoAcao] = useState<'colocacao' | 'substituicao' | null>('colocacao');
  const [selecao, setSelecao] = useState<{
    posPropria?: NexPosicao;
    posNeutra?: NexPosicao;
    neutrasParaProprias: NexPosicao[];
    propriaParaNeutra?: NexPosicao;
  }>({ neutrasParaProprias: [] });

  const corJogador = myRole === 'jogador1' ? 'preta' : 'branca';

  const handleCellClick = (x: number, y: number) => {
    if (!isMyTurn) return;

    const celula = state.tabuleiro[x][y];

    if (tipoAcao === 'colocacao') {
      if (celula !== 'vazia') return;

      if (!selecao.posPropria) {
        setSelecao({ ...selecao, posPropria: { x, y } });
      } else if (!selecao.posNeutra && (selecao.posPropria.x !== x || selecao.posPropria.y !== y)) {
        onMove({
          tipo: 'colocacao',
          posPropria: selecao.posPropria,
          posNeutra: { x, y }
        } as any);
        setSelecao({ neutrasParaProprias: [] });
      }
    } else if (tipoAcao === 'substituicao') {
      if (selecao.neutrasParaProprias.length < 2) {
        if (celula !== 'neutra') return;
        if (selecao.neutrasParaProprias.some(p => p.x === x && p.y === y)) return;
        setSelecao({ ...selecao, neutrasParaProprias: [...selecao.neutrasParaProprias, { x, y }] });
      } else {
        if (celula !== corJogador) return;
        onMove({
          tipo: 'substituicao',
          neutrasParaProprias: selecao.neutrasParaProprias as [NexPosicao, NexPosicao],
          propriaParaNeutra: { x, y }
        } as any);
        setSelecao({ neutrasParaProprias: [] });
      }
    }
  };

  // Coordenadas para o losango
  const hexCoords = useMemo(() => {
    const coords: NexPosicao[] = [];
    for (let x = 0; x < 11; x++) {
      for (let y = 0; y < 11; y++) {
        coords.push({ x, y });
      }
    }
    return coords;
  }, []);

  // Projeção isométrica para o losango horizontal
  const getHexPos = (x: number, y: number) => {
    const size = 18;
    // Ajuste para caber no SVG 400x400
    const xPos = 200 + (x - y) * size * 0.866;
    const yPos = 50 + (x + y) * size * 0.75;
    return { x: xPos, y: yPos };
  };

  return (
    <div className="space-y-4">
      {/* Seletor de Ação */}
      <div className="flex flex-wrap justify-center gap-2">
        <button
          onClick={() => { setTipoAcao('colocacao'); setSelecao({ neutrasParaProprias: [] }); }}
          className={`px-3 py-1.5 rounded-lg text-sm transition-all ${tipoAcao === 'colocacao' ? 'bg-red-500 text-white ring-2 ring-red-400' : 'bg-white/5 text-white/70 hover:bg-white/10'}`}
        >
          Colocação (1 Própria + 1 Neutra)
        </button>
        <button
          onClick={() => { setTipoAcao('substituicao'); setSelecao({ neutrasParaProprias: [] }); }}
          className={`px-3 py-1.5 rounded-lg text-sm transition-all ${tipoAcao === 'substituicao' ? 'bg-blue-500 text-white ring-2 ring-blue-400' : 'bg-white/5 text-white/70 hover:bg-white/10'}`}
        >
          Substituição (2 Neutras-&gt;P, 1 P-&gt;Neutra)
        </button>
        {state.swapDisponivel && (
          <button
            onClick={() => onMove({ type: 'nex_swap' } as any)}
            className="px-3 py-1.5 rounded-lg text-sm bg-purple-500 text-white hover:bg-purple-600 transition-all"
          >
            Regra da Torta (Swap)
          </button>
        )}
      </div>

      {/* Tabuleiro SVG Rhombus */}
      <div className="relative w-full max-w-md mx-auto aspect-square">
        <svg viewBox="0 0 400 350" className="w-full h-full">
          {/* Bordas do tabuleiro (indicadores de vitória) */}
          <path d="M 200 40 L 370 190 L 200 340 L 30 190 Z" fill="none" stroke="#444" strokeWidth="2" strokeDasharray="4 2" />

          {hexCoords.map(({ x, y }) => {
            const pos = getHexPos(x, y);
            const celula = state.tabuleiro[x][y];

            let fill = '#d6d3d1'; // vazia
            if (celula === 'preta') fill = '#ef4444';
            else if (celula === 'branca') fill = '#3b82f6';
            else if (celula === 'neutra') fill = '#78716c'; // stone-600

            // Destaque de seleção
            const isSelected = (tipoAcao === 'colocacao' && (selecao.posPropria?.x === x && selecao.posPropria?.y === y)) ||
              (tipoAcao === 'substituicao' && selecao.neutrasParaProprias.some(p => p.x === x && p.y === y));

            return (
              <g key={`${x},${y}`} onClick={() => handleCellClick(x, y)} className="cursor-pointer">
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={isSelected ? 10 : 8}
                  fill={fill}
                  className="transition-all duration-300"
                  stroke={isSelected ? '#fff' : 'none'}
                  strokeWidth="2"
                />
              </g>
            );
          })}

          {/* Indicadores de direção de vitória */}
          <text x="200" y="25" textAnchor="middle" fill="#ef4444" fontSize="10" fontWeight="bold">Vermelho (↕ Vertical)</text>
          <text x="200" y="340" textAnchor="middle" fill="#ef4444" fontSize="10" fontWeight="bold">Vermelho (↕ Vertical)</text>
          <text x="15" y="190" textAnchor="middle" fill="#3b82f6" fontSize="10" fontWeight="bold" transform="rotate(-90 15 190)">Azul (↔ Horizontal)</text>
          <text x="385" y="190" textAnchor="middle" fill="#3b82f6" fontSize="10" fontWeight="bold" transform="rotate(90 385 190)">Azul (↔ Horizontal)</text>
        </svg>
      </div>

      {/* Status da Ação */}
      <div className="bg-white/5 p-3 rounded-lg text-center text-sm">
        {tipoAcao === 'colocacao' && (
          <p className="text-white/80">
            {!selecao.posPropria ? 'Seleciona uma casa para a TUA peça' : 'Agora seleciona uma casa para a peça NEUTRA'}
          </p>
        )}
        {tipoAcao === 'substituicao' && (
          <p className="text-white/80">
            {selecao.neutrasParaProprias.length < 2
              ? `Seleciona 2 peças neutras para substituir (${selecao.neutrasParaProprias.length}/2)`
              : 'Seleciona UMA peça tua para tornar neutra'}
          </p>
        )}
        {selecao.posPropria && (
          <button
            onClick={() => setSelecao({ neutrasParaProprias: [] })}
            className="mt-2 text-xs text-red-400 hover:underline"
          >
            Cancelar seleção
          </button>
        )}
      </div>
    </div>
  );
}
