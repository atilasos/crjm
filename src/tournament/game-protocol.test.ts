/**
 * Tests for game protocol types and conversion functions.
 * Validates that network types match CLIENT-INTEGRATION_NEW.md specification
 * and that conversions between network and local types work correctly.
 */

import { describe, test, expect } from 'bun:test';
import {
  // Gatos & Cães
  toNetworkGatosCaesMove,
  fromNetworkGatosCaesMove,
  toNetworkGatosCaesState,
  fromNetworkGatosCaesState,
  type NetworkGatosCaesMove,
  type NetworkGatosCaesState,
  // Dominório
  toNetworkDominorioMove,
  fromNetworkDominorioMove,
  type NetworkDominorioMove,
  // Quelhas
  toNetworkQuelhasMove,
  fromNetworkQuelhasMove,
  type NetworkQuelhasMove,
  // Produto
  toNetworkProdutoMove,
  fromNetworkProdutoMove,
  type NetworkProdutoMove,
  // Atari Go
  toNetworkAtariGoMove,
  fromNetworkAtariGoMove,
  type NetworkAtariGoMove,
  // Nex
  toNetworkNexMove,
  fromNetworkNexMove,
  type NetworkNexMove,
  // Generic
  fromNetworkGameState,
} from './game-protocol';

import type { Posicao as GatosCaesPosicao, GatosCaesState } from '../games/gatos-caes/types';
import type { Domino } from '../games/dominorio/types';
import type { Segmento } from '../games/quelhas/types';
import type { JogadaDupla } from '../games/produto/types';
import type { Posicao as AtariGoPosicao } from '../games/atari-go/types';

describe('Gatos & Cães Conversions', () => {
  test('toNetworkGatosCaesMove converts local position to network format', () => {
    const local: GatosCaesPosicao = { linha: 3, coluna: 4 };
    const network = toNetworkGatosCaesMove(local);
    
    expect(network.row).toBe(3);
    expect(network.col).toBe(4);
  });

  test('fromNetworkGatosCaesMove converts network position to local format', () => {
    const network: NetworkGatosCaesMove = { row: 5, col: 6 };
    const local = fromNetworkGatosCaesMove(network);
    
    expect(local.linha).toBe(5);
    expect(local.coluna).toBe(6);
  });

  test('Network state has correct cell values', () => {
    const networkState: NetworkGatosCaesState = {
      board: [
        ['empty', 'cat', 'dog'],
        ['dog', 'empty', 'cat'],
        ['cat', 'dog', 'empty'],
      ],
      currentPlayer: 'player1',
      catCount: 3,
      dogCount: 3,
      lastMove: { row: 1, col: 0 },
      winner: null,
      isFirstCatPlaced: true,
      isFirstDogPlaced: true,
    };
    
    expect(networkState.board[0][0]).toBe('empty');
    expect(networkState.board[0][1]).toBe('cat');
    expect(networkState.board[0][2]).toBe('dog');
  });

  test('fromNetworkGatosCaesState converts network state to local format', () => {
    const network: NetworkGatosCaesState = {
      board: [
        ['empty', 'cat'],
        ['dog', 'empty'],
      ],
      currentPlayer: 'player2',
      catCount: 1,
      dogCount: 1,
      lastMove: null,
      winner: 'player1',
      isFirstCatPlaced: true,
      isFirstDogPlaced: true,
    };
    
    const local = fromNetworkGatosCaesState(network);
    
    expect(local.tabuleiro[0][0]).toBe('vazia');
    expect(local.tabuleiro[0][1]).toBe('gato');
    expect(local.tabuleiro[1][0]).toBe('cao');
    expect(local.jogadorAtual).toBe('jogador2');
    expect(local.estado).toBe('vitoria-jogador1');
    expect(local.totalGatos).toBe(1);
    expect(local.totalCaes).toBe(1);
  });
});

describe('Dominório Conversions', () => {
  test('toNetworkDominorioMove converts domino to network format', () => {
    const domino: Domino = {
      pos1: { linha: 0, coluna: 0 },
      pos2: { linha: 1, coluna: 0 },
      orientacao: 'vertical',
    };
    const network = toNetworkDominorioMove(domino);
    
    expect(network.row1).toBe(0);
    expect(network.col1).toBe(0);
    expect(network.row2).toBe(1);
    expect(network.col2).toBe(0);
  });

  test('fromNetworkDominorioMove converts network to domino with correct orientation', () => {
    const verticalMove: NetworkDominorioMove = { row1: 0, col1: 0, row2: 1, col2: 0 };
    const verticalDomino = fromNetworkDominorioMove(verticalMove);
    expect(verticalDomino.orientacao).toBe('vertical');
    
    const horizontalMove: NetworkDominorioMove = { row1: 0, col1: 0, row2: 0, col2: 1 };
    const horizontalDomino = fromNetworkDominorioMove(horizontalMove);
    expect(horizontalDomino.orientacao).toBe('horizontal');
  });
});

describe('Quelhas Conversions', () => {
  test('toNetworkQuelhasMove converts segment to cells array', () => {
    const segmento: Segmento = {
      inicio: { linha: 2, coluna: 3 },
      comprimento: 4,
      orientacao: 'horizontal',
    };
    const network = toNetworkQuelhasMove(segmento);
    
    expect(network.cells).toHaveLength(4);
    expect(network.cells[0]).toEqual({ row: 2, col: 3 });
    expect(network.cells[1]).toEqual({ row: 2, col: 4 });
    expect(network.cells[2]).toEqual({ row: 2, col: 5 });
    expect(network.cells[3]).toEqual({ row: 2, col: 6 });
  });

  test('toNetworkQuelhasMove handles vertical segments', () => {
    const segmento: Segmento = {
      inicio: { linha: 1, coluna: 5 },
      comprimento: 3,
      orientacao: 'vertical',
    };
    const network = toNetworkQuelhasMove(segmento);
    
    expect(network.cells[0]).toEqual({ row: 1, col: 5 });
    expect(network.cells[1]).toEqual({ row: 2, col: 5 });
    expect(network.cells[2]).toEqual({ row: 3, col: 5 });
  });

  test('toNetworkQuelhasMove includes swap flag', () => {
    const segmento: Segmento = {
      inicio: { linha: 0, coluna: 0 },
      comprimento: 2,
      orientacao: 'horizontal',
    };
    const network = toNetworkQuelhasMove(segmento, true);
    
    expect(network.swap).toBe(true);
  });

  test('fromNetworkQuelhasMove reconstructs segment', () => {
    const network: NetworkQuelhasMove = {
      cells: [
        { row: 0, col: 0 },
        { row: 0, col: 1 },
        { row: 0, col: 2 },
      ],
      swap: false,
    };
    const { segmento, swap } = fromNetworkQuelhasMove(network);
    
    expect(segmento.inicio).toEqual({ linha: 0, coluna: 0 });
    expect(segmento.comprimento).toBe(3);
    expect(segmento.orientacao).toBe('horizontal');
    expect(swap).toBe(false);
  });
});

describe('Produto Conversions', () => {
  test('toNetworkProdutoMove converts double placement', () => {
    const jogada: JogadaDupla = {
      pos1: { q: 0, r: 0 },
      cor1: 'preta',
      pos2: { q: 1, r: -1 },
      cor2: 'branca',
    };
    const network = toNetworkProdutoMove(jogada);
    
    expect(network.placements).toHaveLength(2);
    expect(network.placements[0].coord).toEqual({ q: 0, r: 0 });
    expect(network.placements[0].color).toBe('black');
    expect(network.placements[1].coord).toEqual({ q: 1, r: -1 });
    expect(network.placements[1].color).toBe('white');
  });

  test('toNetworkProdutoMove handles single placement (first move)', () => {
    const jogada: JogadaDupla = {
      pos1: { q: 0, r: 0 },
      cor1: 'preta',
      pos2: null,
      cor2: null,
    };
    const network = toNetworkProdutoMove(jogada);
    
    expect(network.placements).toHaveLength(1);
  });

  test('fromNetworkProdutoMove converts back correctly', () => {
    const network: NetworkProdutoMove = {
      placements: [
        { coord: { q: -1, r: 2 }, color: 'white' },
        { coord: { q: 2, r: -2 }, color: 'black' },
      ],
    };
    const jogada = fromNetworkProdutoMove(network);
    
    expect(jogada.pos1).toEqual({ q: -1, r: 2 });
    expect(jogada.cor1).toBe('branca');
    expect(jogada.pos2).toEqual({ q: 2, r: -2 });
    expect(jogada.cor2).toBe('preta');
  });
});

describe('Atari Go Conversions', () => {
  test('toNetworkAtariGoMove converts position', () => {
    const pos: AtariGoPosicao = { linha: 4, coluna: 4 };
    const network = toNetworkAtariGoMove(pos);
    
    expect(network.row).toBe(4);
    expect(network.col).toBe(4);
    expect(network.pass).toBeUndefined();
  });

  test('toNetworkAtariGoMove handles pass', () => {
    const pos: AtariGoPosicao = { linha: 0, coluna: 0 };
    const network = toNetworkAtariGoMove(pos, true);
    
    expect(network.pass).toBe(true);
  });

  test('fromNetworkAtariGoMove converts back', () => {
    const network: NetworkAtariGoMove = { row: 8, col: 8, pass: false };
    const { posicao, pass } = fromNetworkAtariGoMove(network);
    
    expect(posicao.linha).toBe(8);
    expect(posicao.coluna).toBe(8);
    expect(pass).toBe(false);
  });
});

describe('Nex Conversions', () => {
  test('toNetworkNexMove converts place action', () => {
    const acao = {
      tipo: 'colocacao' as const,
      posPropria: { x: 5, y: 5 },
      posNeutra: { x: 6, y: 5 },
    };
    const network = toNetworkNexMove(acao);
    
    expect(network.type).toBe('place');
    expect(network.ownPiece).toEqual({ row: 5, col: 5 });
    expect(network.neutralPiece).toEqual({ row: 6, col: 5 });
  });

  test('toNetworkNexMove converts convert action', () => {
    const acao = {
      tipo: 'substituicao' as const,
      neutrasParaProprias: [{ x: 3, y: 3 }, { x: 4, y: 4 }] as [{ x: number; y: number }, { x: number; y: number }],
      propriaParaNeutra: { x: 5, y: 5 },
    };
    const network = toNetworkNexMove(acao);
    
    expect(network.type).toBe('convert');
    expect(network.neutralsToConvert).toHaveLength(2);
    expect(network.ownToNeutral).toEqual({ row: 5, col: 5 });
  });

  test('toNetworkNexMove converts swap action', () => {
    const network = toNetworkNexMove({ tipo: 'swap' });
    expect(network.type).toBe('swap');
  });

  test('fromNetworkNexMove converts place back', () => {
    const network: NetworkNexMove = {
      type: 'place',
      ownPiece: { row: 2, col: 3 },
      neutralPiece: { row: 2, col: 4 },
    };
    const acao = fromNetworkNexMove(network);
    
    expect(acao.tipo).toBe('colocacao');
    if (acao.tipo === 'colocacao') {
      expect(acao.posPropria).toEqual({ x: 2, y: 3 });
      expect(acao.posNeutra).toEqual({ x: 2, y: 4 });
    }
  });

  test('fromNetworkNexMove converts swap back', () => {
    const network: NetworkNexMove = { type: 'swap' };
    const acao = fromNetworkNexMove(network);
    
    expect(acao.tipo).toBe('swap');
  });
});

describe('Generic fromNetworkGameState', () => {
  test('routes to correct converter based on gameId', () => {
    const gatosCaesNetwork: NetworkGatosCaesState = {
      board: [['empty', 'empty'], ['empty', 'empty']],
      currentPlayer: 'player1',
      catCount: 0,
      dogCount: 0,
      lastMove: null,
      winner: null,
      isFirstCatPlaced: false,
      isFirstDogPlaced: false,
    };
    
    const state = fromNetworkGameState('gatos-caes', gatosCaesNetwork);
    
    // Should have GatosCaesState properties
    expect('totalGatos' in state).toBe(true);
    expect('totalCaes' in state).toBe(true);
  });
});
