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
    const celula = state.tabuleiro[linha][coluna];
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
    const celula = state.tabuleiro[linha][coluna];
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
    const celula = state.tabuleiro[linha][coluna];
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
  const isJogadaValida = (q: number, r: number): boolean => {
    if (!isMyTurn) return false;
    return state.jogadasValidas.some(j => j.q === q && j.r === r);
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

  const getCelulaContent = (q: number, r: number): string => {
    const celula = state.tabuleiro.get(`${q},${r}`);
    if (celula === 'jogador1') return '🔴';
    if (celula === 'jogador2') return '🔵';
    return '';
  };

  const getCelulaClasses = (q: number, r: number): string => {
    const celula = state.tabuleiro.get(`${q},${r}`);
    const jogadaValida = isJogadaValida(q, r);
    
    let classes = 'w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-all duration-200 text-lg ';
    
    if (celula === 'vazia') {
      classes += 'bg-stone-300 ';
      if (jogadaValida) {
        classes += 'ring-2 ring-green-400 bg-green-200 cursor-pointer hover:bg-green-300 ';
      }
    } else if (celula === 'jogador1') {
      classes += 'bg-red-500 ';
    } else if (celula === 'jogador2') {
      classes += 'bg-blue-500 ';
    }
    
    return classes;
  };

  // Converter coordenadas hex para pixel (layout pointy-top)
  const hexToPixel = (q: number, r: number) => {
    const size = 20;
    const x = size * (Math.sqrt(3) * q + Math.sqrt(3) / 2 * r);
    const y = size * (3 / 2 * r);
    return { x: x + 200, y: y + 200 }; // offset para centrar
  };

  return (
    <div className="space-y-4">
      <div className="relative w-full max-w-md mx-auto" style={{ height: '400px' }}>
        <svg viewBox="0 0 400 400" className="w-full h-full">
          {hexCoords.map(({ q, r }) => {
            const { x, y } = hexToPixel(q, r);
            const celula = state.tabuleiro.get(`${q},${r}`);
            const jogadaValida = isJogadaValida(q, r);
            
            let fill = '#d6d3d1'; // stone-300
            if (celula === 'jogador1') fill = '#ef4444'; // red-500
            else if (celula === 'jogador2') fill = '#3b82f6'; // blue-500
            else if (jogadaValida) fill = '#86efac'; // green-300
            
            return (
              <g key={`${q},${r}`}>
                <circle
                  cx={x}
                  cy={y}
                  r={18}
                  fill={fill}
                  stroke={jogadaValida ? '#22c55e' : '#a8a29e'}
                  strokeWidth={jogadaValida ? 3 : 1}
                  className={jogadaValida ? 'cursor-pointer' : ''}
                  onClick={() => jogadaValida && onMove({ q, r })}
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
            <span>Pontos: {state.pontosJogador1}</span>
            {myRole === 'jogador1' && <span className="text-xs">(tu)</span>}
          </div>
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${myRole === 'jogador2' ? 'bg-blue-500/30 ring-2 ring-blue-400' : ''}`}>
            <span className="text-xl">🔵</span>
            <span>Pontos: {state.pontosJogador2}</span>
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
    const celula = state.tabuleiro[linha][coluna];
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
                    {celula === 'preto' && (
                      <div className="w-[90%] h-[90%] rounded-full bg-gray-900 shadow-lg" />
                    )}
                    {celula === 'branco' && (
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
  const tamanho = state.tabuleiro.length;

  const isJogadaValida = (linha: number, coluna: number): boolean => {
    if (!isMyTurn) return false;
    return state.jogadasValidas.some(j => j.linha === linha && j.coluna === coluna);
  };

  return (
    <div className="space-y-4">
      <div className="max-w-md mx-auto">
        {/* Tabuleiro hexagonal representado como grid deslocado */}
        <div className="flex flex-col items-center gap-1 p-4 bg-stone-700 rounded-xl">
          {state.tabuleiro.map((linha, linhaIdx) => (
            <div 
              key={linhaIdx} 
              className="flex gap-1"
              style={{ marginLeft: `${linhaIdx * 12}px` }}
            >
              {linha.map((celula, colunaIdx) => {
                const jogadaValida = isJogadaValida(linhaIdx, colunaIdx);
                let bgColor = 'bg-stone-400';
                if (celula === 'jogador1') bgColor = 'bg-red-500';
                else if (celula === 'jogador2') bgColor = 'bg-blue-500';
                else if (celula === 'neutro') bgColor = 'bg-gray-500';
                else if (jogadaValida) bgColor = 'bg-green-300';

                return (
                  <button
                    key={colunaIdx}
                    onClick={() => jogadaValida && onMove({ linha: linhaIdx, coluna: colunaIdx })}
                    className={`w-6 h-6 md:w-8 md:h-8 rounded-full ${bgColor} transition-all ${
                      jogadaValida ? 'ring-2 ring-green-400 cursor-pointer hover:bg-green-400' : ''
                    }`}
                    disabled={!jogadaValida}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legenda */}
      <div className="flex flex-col items-center gap-2 text-sm text-white/70">
        <div className="flex justify-center gap-6">
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${myRole === 'jogador1' ? 'bg-red-500/30 ring-2 ring-red-400' : ''}`}>
            <div className="w-4 h-4 rounded-full bg-red-500" />
            <span>Vermelho (↕️)</span>
            {myRole === 'jogador1' && <span className="text-xs">(tu)</span>}
          </div>
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${myRole === 'jogador2' ? 'bg-blue-500/30 ring-2 ring-blue-400' : ''}`}>
            <div className="w-4 h-4 rounded-full bg-blue-500" />
            <span>Azul (↔️)</span>
            {myRole === 'jogador2' && <span className="text-xs">(tu)</span>}
          </div>
        </div>
        <div className="text-xs text-white/50">
          Liga as tuas margens opostas para ganhar!
        </div>
        <div className="text-xs text-white/50">
          {isMyTurn ? `É a tua vez! (${state.jogadasValidas.length} jogadas disponíveis)` : 'A aguardar adversário...'}
        </div>
      </div>
    </div>
  );
}
