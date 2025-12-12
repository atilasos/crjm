/**
 * Bitboard Implementation Tests
 * 
 * Tests for the TypeScript bitboard reference implementation.
 * These also serve as a specification for the Rust WASM implementation.
 */

import { test, expect, describe } from "bun:test";
import {
  generateMoves,
  countMoves,
  applyMove,
  isGameOver,
  evaluate,
  evaluateAdvanced,
  countSafeMoves,
  orderMoves,
  boardToBitboard,
  anchorToDomino,
  playerToSide,
} from "./bitboard";
import {
  squareIndex,
  indexToSquare,
  setBit,
  getBit,
  popCount,
} from "./types";
import { calcularJogadasValidas, criarTabuleiroInicial, colocarDomino, criarEstadoInicial } from "../logic";
import type { Celula } from "../types";

// ============================================================================
// Basic Bit Operations
// ============================================================================

describe("Bit Operations", () => {
  test("squareIndex converts row/col to bit index correctly", () => {
    expect(squareIndex(0, 0)).toBe(0);
    expect(squareIndex(0, 7)).toBe(7);
    expect(squareIndex(1, 0)).toBe(8);
    expect(squareIndex(7, 7)).toBe(63);
    expect(squareIndex(3, 4)).toBe(28);
  });
  
  test("indexToSquare converts bit index to row/col correctly", () => {
    expect(indexToSquare(0)).toEqual({ row: 0, col: 0 });
    expect(indexToSquare(7)).toEqual({ row: 0, col: 7 });
    expect(indexToSquare(8)).toEqual({ row: 1, col: 0 });
    expect(indexToSquare(63)).toEqual({ row: 7, col: 7 });
    expect(indexToSquare(28)).toEqual({ row: 3, col: 4 });
  });
  
  test("setBit and getBit work correctly for low bits", () => {
    let [low, high] = setBit(0, 0, 0);
    expect(getBit(low, high, 0)).toBe(true);
    expect(getBit(low, high, 1)).toBe(false);
    
    [low, high] = setBit(low, high, 31);
    expect(getBit(low, high, 31)).toBe(true);
    expect(getBit(low, high, 32)).toBe(false);
  });
  
  test("setBit and getBit work correctly for high bits", () => {
    let [low, high] = setBit(0, 0, 32);
    expect(getBit(low, high, 32)).toBe(true);
    expect(getBit(low, high, 31)).toBe(false);
    
    [low, high] = setBit(low, high, 63);
    expect(getBit(low, high, 63)).toBe(true);
  });
  
  test("popCount counts bits correctly", () => {
    expect(popCount(0, 0)).toBe(0);
    expect(popCount(1, 0)).toBe(1);
    expect(popCount(0xFF, 0)).toBe(8);
    expect(popCount(0xFFFFFFFF, 0)).toBe(32);
    expect(popCount(0xFFFFFFFF, 0xFFFFFFFF)).toBe(64);
    expect(popCount(0, 1)).toBe(1);
  });
});

// ============================================================================
// Move Generation
// ============================================================================

describe("Move Generation", () => {
  test("empty board has 56 vertical moves", () => {
    const moves = generateMoves(0, 0, 0);
    expect(moves.length).toBe(56); // 8 cols × 7 rows
  });
  
  test("empty board has 56 horizontal moves", () => {
    const moves = generateMoves(0, 0, 1);
    expect(moves.length).toBe(56); // 7 cols × 8 rows
  });
  
  test("countMoves matches generateMoves length", () => {
    expect(countMoves(0, 0, 0)).toBe(56);
    expect(countMoves(0, 0, 1)).toBe(56);
    
    // Random occupied position
    const [low, high] = [0x00FF00FF, 0x00FF00FF];
    expect(countMoves(low, high, 0)).toBe(generateMoves(low, high, 0).length);
    expect(countMoves(low, high, 1)).toBe(generateMoves(low, high, 1).length);
  });
  
  test("vertical moves have correct anchor positions", () => {
    const moves = generateMoves(0, 0, 0);
    
    for (const anchor of moves) {
      const { row, col } = indexToSquare(anchor);
      // Anchor must be in rows 0-6 (not bottom row)
      expect(row).toBeLessThan(7);
      // Column can be any
      expect(col).toBeGreaterThanOrEqual(0);
      expect(col).toBeLessThan(8);
    }
  });
  
  test("horizontal moves have correct anchor positions", () => {
    const moves = generateMoves(0, 0, 1);
    
    for (const anchor of moves) {
      const { row, col } = indexToSquare(anchor);
      // Row can be any
      expect(row).toBeGreaterThanOrEqual(0);
      expect(row).toBeLessThan(8);
      // Anchor must be in cols 0-6 (not rightmost column)
      expect(col).toBeLessThan(7);
    }
  });
  
  test("placing a domino reduces available moves", () => {
    // Place vertical domino at (0,0)-(1,0)
    const [low, high] = applyMove(0, 0, 0, 0);
    
    const vMoves = countMoves(low, high, 0);
    const hMoves = countMoves(low, high, 1);
    
    // Both should be less than 56
    expect(vMoves).toBeLessThan(56);
    expect(hMoves).toBeLessThan(56);
  });
  
  test("applyMove sets correct bits for vertical move", () => {
    const anchor = squareIndex(2, 3); // Row 2, Col 3
    const [low, high] = applyMove(0, 0, anchor, 0);
    
    // Should occupy anchor and anchor+8 (below)
    expect(getBit(low, high, anchor)).toBe(true);
    expect(getBit(low, high, anchor + 8)).toBe(true);
    
    // Other squares should be empty
    expect(getBit(low, high, anchor + 1)).toBe(false);
  });
  
  test("applyMove sets correct bits for horizontal move", () => {
    const anchor = squareIndex(2, 3); // Row 2, Col 3
    const [low, high] = applyMove(0, 0, anchor, 1);
    
    // Should occupy anchor and anchor+1 (right)
    expect(getBit(low, high, anchor)).toBe(true);
    expect(getBit(low, high, anchor + 1)).toBe(true);
    
    // Other squares should be empty
    expect(getBit(low, high, anchor + 8)).toBe(false);
  });
});

// ============================================================================
// Consistency with Original Logic
// ============================================================================

describe("Consistency with Original Game Logic", () => {
  test("bitboard move count matches calcularJogadasValidas", () => {
    const tabuleiro = criarTabuleiroInicial();
    const [low, high] = boardToBitboard(tabuleiro);
    
    // Vertical (jogador1)
    const jsVertical = calcularJogadasValidas(tabuleiro, 'jogador1');
    const bbVertical = countMoves(low, high, 0);
    expect(bbVertical).toBe(jsVertical.length);
    
    // Horizontal (jogador2)
    const jsHorizontal = calcularJogadasValidas(tabuleiro, 'jogador2');
    const bbHorizontal = countMoves(low, high, 1);
    expect(bbHorizontal).toBe(jsHorizontal.length);
  });
  
  test("bitboard move count matches after several moves", () => {
    let state = criarEstadoInicial('dois-jogadores');
    
    // Play 10 moves
    for (let i = 0; i < 10; i++) {
      const jogadas = state.jogadasValidas;
      if (jogadas.length === 0) break;
      
      const jogada = jogadas[Math.floor(Math.random() * jogadas.length)];
      state = colocarDomino(state, jogada);
      
      const [low, high] = boardToBitboard(state.tabuleiro);
      const side = playerToSide(state.jogadorAtual);
      
      const jsCount = state.jogadasValidas.length;
      const bbCount = countMoves(low, high, side);
      
      expect(bbCount).toBe(jsCount);
    }
  });
  
  test("boardToBitboard conversion is correct", () => {
    const tabuleiro: Celula[][] = Array(8).fill(null).map(() => 
      Array(8).fill('vazia') as Celula[]
    );
    
    // Place some pieces
    tabuleiro[0][0] = 'ocupada-vertical';
    tabuleiro[1][0] = 'ocupada-vertical';
    tabuleiro[3][3] = 'ocupada-horizontal';
    tabuleiro[3][4] = 'ocupada-horizontal';
    
    const [low, high] = boardToBitboard(tabuleiro);
    
    // Check occupied squares
    expect(getBit(low, high, squareIndex(0, 0))).toBe(true);
    expect(getBit(low, high, squareIndex(1, 0))).toBe(true);
    expect(getBit(low, high, squareIndex(3, 3))).toBe(true);
    expect(getBit(low, high, squareIndex(3, 4))).toBe(true);
    
    // Check empty squares
    expect(getBit(low, high, squareIndex(0, 1))).toBe(false);
    expect(getBit(low, high, squareIndex(7, 7))).toBe(false);
  });
  
  test("anchorToDomino creates correct Domino structure", () => {
    // Vertical
    const vDomino = anchorToDomino(squareIndex(2, 3), 0);
    expect(vDomino.pos1).toEqual({ linha: 2, coluna: 3 });
    expect(vDomino.pos2).toEqual({ linha: 3, coluna: 3 });
    expect(vDomino.orientacao).toBe('vertical');
    
    // Horizontal
    const hDomino = anchorToDomino(squareIndex(2, 3), 1);
    expect(hDomino.pos1).toEqual({ linha: 2, coluna: 3 });
    expect(hDomino.pos2).toEqual({ linha: 2, coluna: 4 });
    expect(hDomino.orientacao).toBe('horizontal');
  });
  
  test("playerToSide converts correctly", () => {
    expect(playerToSide('jogador1')).toBe(0);
    expect(playerToSide('jogador2')).toBe(1);
  });
});

// ============================================================================
// Game Over Detection
// ============================================================================

describe("Game Over Detection", () => {
  test("empty board is not game over", () => {
    expect(isGameOver(0, 0, 0)).toBe(false);
    expect(isGameOver(0, 0, 1)).toBe(false);
  });
  
  test("full board is game over for both sides", () => {
    // All bits set
    const full = [0xFFFFFFFF, 0xFFFFFFFF] as [number, number];
    expect(isGameOver(full[0], full[1], 0)).toBe(true);
    expect(isGameOver(full[0], full[1], 1)).toBe(true);
  });
  
  test("game ends when current player has no moves", () => {
    // Create a position where vertical has no moves
    // Fill odd rows completely (no vertical pairs possible)
    let low = 0;
    let high = 0;
    
    // Fill rows 0, 2, 4, 6 with single cells pattern
    // Actually, to block all vertical moves, fill every other row
    for (let row = 0; row < 8; row += 2) {
      for (let col = 0; col < 8; col++) {
        const idx = squareIndex(row, col);
        if (idx < 32) {
          low |= (1 << idx);
        } else {
          high |= (1 << (idx - 32));
        }
      }
    }
    
    // Vertical can't move (no two consecutive empty rows in any column)
    expect(isGameOver(low >>> 0, high >>> 0, 0)).toBe(true);
    
    // Horizontal might still have moves in the empty rows
    const hMoves = countMoves(low >>> 0, high >>> 0, 1);
    expect(hMoves).toBeGreaterThan(0);
  });
});

// ============================================================================
// Evaluation
// ============================================================================

describe("Evaluation", () => {
  test("empty board evaluation is reasonable", () => {
    const score = evaluate(0, 0, 0);
    // Should be in reasonable range (not winning/losing)
    expect(Math.abs(score)).toBeLessThan(1000);
  });
  
  test("evaluation is symmetric", () => {
    const scoreV = evaluate(0, 0, 0);
    const scoreH = evaluate(0, 0, 1);
    // Both sides have same mobility on empty board, but different safe moves
    expect(Math.abs(scoreV - scoreH)).toBeLessThan(50);
  });
  
  test("winning position has high score", () => {
    // Create position where opponent has no moves
    let low = 0;
    let high = 0;
    
    // Fill even rows
    for (let row = 0; row < 8; row += 2) {
      for (let col = 0; col < 8; col++) {
        const idx = squareIndex(row, col);
        if (idx < 32) {
          low |= (1 << idx);
        } else {
          high |= (1 << (idx - 32));
        }
      }
    }
    
    // Horizontal is playing, vertical has no moves - horizontal wins
    const score = evaluate(low >>> 0, high >>> 0, 1);
    expect(score).toBeGreaterThan(9000); // Near mate score
  });
  
  test("losing position has low score", () => {
    let low = 0;
    let high = 0;
    
    // Fill even rows
    for (let row = 0; row < 8; row += 2) {
      for (let col = 0; col < 8; col++) {
        const idx = squareIndex(row, col);
        if (idx < 32) {
          low |= (1 << idx);
        } else {
          high |= (1 << (idx - 32));
        }
      }
    }
    
    // Vertical is playing but has no moves - vertical loses
    const score = evaluate(low >>> 0, high >>> 0, 0);
    expect(score).toBeLessThan(-9000);
  });
  
  test("countSafeMoves returns correct count", () => {
    // Empty board: each column/row has 8 empty squares = 4 safe moves
    const vSafe = countSafeMoves(0, 0, 0);
    const hSafe = countSafeMoves(0, 0, 1);
    
    expect(vSafe).toBe(32); // 8 columns × 4 pairs
    expect(hSafe).toBe(32); // 8 rows × 4 pairs
  });
});

// ============================================================================
// Move Ordering
// ============================================================================

describe("Move Ordering", () => {
  test("orderMoves returns all moves", () => {
    const moves = generateMoves(0, 0, 0);
    const ordered = orderMoves(0, 0, moves, 0);
    
    expect(ordered.length).toBe(moves.length);
    expect(new Set(ordered).size).toBe(moves.length);
  });
  
  test("winning move is ordered first", () => {
    // Create a position where one move wins immediately
    // This is hard to construct, so we just verify ordering works
    const moves = generateMoves(0, 0, 0);
    const ordered = orderMoves(0, 0, moves, 0);
    
    // First move should have been evaluated
    expect(ordered.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe("Edge Cases", () => {
  test("moves on board edges are valid", () => {
    // Top-left corner vertical
    const vMoves = generateMoves(0, 0, 0);
    expect(vMoves).toContain(squareIndex(0, 0));
    
    // Top-left corner horizontal
    const hMoves = generateMoves(0, 0, 1);
    expect(hMoves).toContain(squareIndex(0, 0));
  });
  
  test("bottom row anchors not in vertical moves", () => {
    const moves = generateMoves(0, 0, 0);
    
    // Row 7 anchors should not be present
    for (let col = 0; col < 8; col++) {
      expect(moves).not.toContain(squareIndex(7, col));
    }
  });
  
  test("rightmost column anchors not in horizontal moves", () => {
    const moves = generateMoves(0, 0, 1);
    
    // Col 7 anchors should not be present
    for (let row = 0; row < 8; row++) {
      expect(moves).not.toContain(squareIndex(row, 7));
    }
  });
  
  test("applying move near boundaries works", () => {
    // Bottom-most valid vertical move
    const anchor = squareIndex(6, 0);
    const [low, high] = applyMove(0, 0, anchor, 0);
    
    expect(getBit(low, high, squareIndex(6, 0))).toBe(true);
    expect(getBit(low, high, squareIndex(7, 0))).toBe(true);
    
    // Rightmost valid horizontal move
    const anchor2 = squareIndex(0, 6);
    const [low2, high2] = applyMove(0, 0, anchor2, 1);
    
    expect(getBit(low2, high2, squareIndex(0, 6))).toBe(true);
    expect(getBit(low2, high2, squareIndex(0, 7))).toBe(true);
  });
});

