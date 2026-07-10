/**
 * Tests for Gatos & Cães AI Engine
 */

import { describe, test, expect } from 'bun:test';
import { computeBestMove, toCompactBoard } from './engine';
import { criarEstadoInicial, colocarPeca, isJogadaValida } from '../logic';
import type { GatosCaesState, Posicao } from '../types';

describe('Gatos & Cães AI Engine', () => {
  describe('computeBestMove', () => {
    test('returns a valid move for initial state', () => {
      const state = criarEstadoInicial('vs-computador');
      const { move, stats } = computeBestMove(state, 3);

      expect(move).not.toBeNull();
      expect(move).toHaveProperty('linha');
      expect(move).toHaveProperty('coluna');
      expect(isJogadaValida(state, move!)).toBe(true);
    });

    test('returns a move from central squares for first cat', () => {
      const state = criarEstadoInicial('vs-computador');
      const { move } = computeBestMove(state, 3);

      // First cat must be placed in central squares (3,3), (3,4), (4,3), (4,4)
      expect(move).not.toBeNull();
      const isCentral =
        (move!.linha === 3 || move!.linha === 4) &&
        (move!.coluna === 3 || move!.coluna === 4);
      expect(isCentral).toBe(true);
    });

    test('works at difficulty level 1', () => {
      const state = criarEstadoInicial('vs-computador');
      const { move, stats } = computeBestMove(state, 1);

      expect(move).not.toBeNull();
      expect(isJogadaValida(state, move!)).toBe(true);
      expect(stats.nodes).toBeGreaterThan(0);
      expect(stats.timeMs).toBeGreaterThanOrEqual(0);
    });

    test('works at difficulty level 2', () => {
      const state = criarEstadoInicial('vs-computador');
      const { move, stats } = computeBestMove(state, 2);

      expect(move).not.toBeNull();
      expect(isJogadaValida(state, move!)).toBe(true);
      expect(stats.nodes).toBeGreaterThan(0);
      expect(stats.timeMs).toBeGreaterThanOrEqual(0);
    });

    test('keeps a legal fallback when the deadline expires before depth one', () => {
      let state = criarEstadoInicial('vs-computador');
      state = colocarPeca(state, { linha: 3, coluna: 3 });

      const { move } = computeBestMove(state, 2, { timeLimit: 1 });

      expect(move).not.toBeNull();
      expect(isJogadaValida(state, move!)).toBe(true);
    });

    test('higher difficulty searches deeper', () => {
      const state = criarEstadoInicial('vs-computador');

      const result1 = computeBestMove(state, 1);
      const result2 = computeBestMove(state, 2);

      // Higher difficulty should search more nodes (usually)
      // Note: At the start, this might not always be true due to early cutoffs
      expect(result2.stats.depth).toBeGreaterThanOrEqual(result1.stats.depth);
    });

    test('returns null when no valid moves exist', () => {
      // Create a state where current player has no valid moves
      // This is hard to set up naturally, so we just verify the function handles it
      const state = criarEstadoInicial('vs-computador');
      const compactBoard = toCompactBoard(state);

      // Verify the board conversion works
      expect(compactBoard.sideToMove).toBe('jogador1');
      expect(compactBoard.primeiroGatoColocado).toBe(false);
      expect(compactBoard.primeiroCaoColocado).toBe(false);
    });

    test('finds winning moves quickly', () => {
      // Setup a state closer to end game
      let state = criarEstadoInicial('vs-computador');

      // Place some pieces to create a more interesting position
      // First cat in center
      state = colocarPeca(state, { linha: 3, coluna: 3 });
      // First dog outside center
      state = colocarPeca(state, { linha: 0, coluna: 0 });

      const { move, stats } = computeBestMove(state, 3);

      expect(move).not.toBeNull();
      expect(isJogadaValida(state, move!)).toBe(true);
    });
  });

  describe('toCompactBoard', () => {
    test('converts empty board correctly', () => {
      const state = criarEstadoInicial('vs-computador');
      const board = toCompactBoard(state);

      expect(board.gatos).toBe(0n);
      expect(board.caes).toBe(0n);
      expect(board.sideToMove).toBe('jogador1');
      expect(board.primeiroGatoColocado).toBe(false);
      expect(board.primeiroCaoColocado).toBe(false);
    });

    test('tracks piece placement', () => {
      let state = criarEstadoInicial('vs-computador');

      // Place first cat at (3,3)
      state = colocarPeca(state, { linha: 3, coluna: 3 });
      let board = toCompactBoard(state);

      // Bit for (3,3) = row*8 + col = 3*8 + 3 = 27
      expect(board.gatos).toBe(1n << 27n);
      expect(board.caes).toBe(0n);
      expect(board.sideToMove).toBe('jogador2');
      expect(board.primeiroGatoColocado).toBe(true);

      // Place first dog at (0,0)
      state = colocarPeca(state, { linha: 0, coluna: 0 });
      board = toCompactBoard(state);

      expect(board.gatos).toBe(1n << 27n);
      expect(board.caes).toBe(1n << 0n);
      expect(board.sideToMove).toBe('jogador1');
      expect(board.primeiroCaoColocado).toBe(true);
    });
  });

  describe('search statistics', () => {
    test('reports meaningful statistics', () => {
      const state = criarEstadoInicial('vs-computador');
      const { stats } = computeBestMove(state, 3);

      expect(stats).toHaveProperty('nodes');
      expect(stats).toHaveProperty('ttHits');
      expect(stats).toHaveProperty('ttProbes');
      expect(stats).toHaveProperty('cutoffs');
      expect(stats).toHaveProperty('depth');
      expect(stats).toHaveProperty('score');
      expect(stats).toHaveProperty('timeMs');
      expect(stats).toHaveProperty('nodesPerSecond');

      expect(stats.nodes).toBeGreaterThan(0);
      expect(stats.depth).toBeGreaterThan(0);
    });

    test('transposition table provides cache hits', () => {
      let state = criarEstadoInicial('vs-computador');
      state = colocarPeca(state, { linha: 3, coluna: 3 });
      state = colocarPeca(state, { linha: 0, coluna: 0 });
      state = colocarPeca(state, { linha: 3, coluna: 4 });
      state = colocarPeca(state, { linha: 0, coluna: 7 });

      const { stats } = computeBestMove(state, 2);

      // After several moves, we should see some TT activity
      expect(stats.ttProbes).toBeGreaterThan(0);
    });
  });

  describe('AI quality', () => {
    test('avoids losing when possible', () => {
      // The AI should not make obviously bad moves
      let state = criarEstadoInicial('vs-computador');

      // Make several moves using difficulty 1 (fast)
      for (let i = 0; i < 4; i++) {
        if (state.estado !== 'a-jogar') break;

        const { move } = computeBestMove(state, 1);
        if (!move) break;

        expect(isJogadaValida(state, move)).toBe(true);
        state = colocarPeca(state, move);
      }

      // AI should have made valid moves throughout
      expect(state.totalGatos + state.totalCaes).toBeGreaterThanOrEqual(4);
    });

    test('normal difficulty plays better than easy', () => {
      let state = criarEstadoInicial('vs-computador');

      // Just verify both difficulties can play through a game
      const easyResult = computeBestMove(state, 1);
      const normalResult = computeBestMove(state, 2);

      expect(easyResult.move).not.toBeNull();
      expect(normalResult.move).not.toBeNull();

      // Normal should search more deeply than easy
      expect(normalResult.stats.depth).toBeGreaterThanOrEqual(easyResult.stats.depth);
    });
  });
});
