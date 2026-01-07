import { describe, it, expect } from 'bun:test';
import { getGameAdapter } from './game-adapter';
import type { ProdutoState } from '../games/produto/types';
import type { AtariGoState } from '../games/atari-go/types';
import type { NexState } from '../games/nex/types';

describe('Game Adapters - Network Move Handling', () => {

    describe('Produto Adapter', () => {
        const adapter = getGameAdapter('produto')!;

        it('should validate and apply a move in network format (placements)', () => {
            const state = adapter.createInitialState() as ProdutoState;
            const move = {
                placements: [{
                    coord: { q: 0, r: 0 },
                    color: 'black'
                }]
            };

            expect(adapter.isValidMove(state, move)).toBe(true);
            const nextState = adapter.applyMove(state, move) as ProdutoState;
            expect(nextState).not.toBeNull();
            expect(nextState.tabuleiro['0,0']).toBe('preta');
            // Na primeira jogada do jogo, termina logo o turno
            expect(nextState.jogadorAtual).toBe('jogador2');
        });

        it('should validate second placement in network format', () => {
            let state = adapter.createInitialState() as ProdutoState;
            // Primeira peça já colocada
            state = adapter.applyMove(state, { pos: { q: 0, r: 0 }, cor: 'preta' }) as ProdutoState;

            // Agora é vez do jogador 2, primeira peça da sua jogada dupla
            const move = {
                placements: [
                    { coord: { q: 1, r: 0 }, color: 'black' },
                    { coord: { q: 2, r: 0 }, color: 'white' }
                ]
            };

            expect(adapter.isValidMove(state, move)).toBe(true);
            const nextState = adapter.applyMove(state, move) as ProdutoState;
            expect(nextState).not.toBeNull();
            expect(nextState.tabuleiro['1,0']).toBe('preta');
            expect(nextState.tabuleiro['2,0']).toBe('branca');
            expect(nextState.jogadorAtual).toBe('jogador1'); // Turno passou
        });

        it('should NOT allow placing opponent color in the first move', () => {
            const state = adapter.createInitialState() as ProdutoState;
            const move = {
                placements: [{
                    coord: { q: 0, r: 0 },
                    color: 'white' // Player 1 starts as black
                }]
            };
            expect(adapter.isValidMove(state, move)).toBe(false);
        });

        it('should stay in the same player turn after placing only 1 of 2 pieces', () => {
            let state = adapter.createInitialState() as ProdutoState;
            state = adapter.applyMove(state, { pos: { q: 0, r: 0 }, cor: 'preta' }) as ProdutoState;

            // Agora é vez do jogador 2. Ele coloca 1 peça.
            const move = {
                placements: [{
                    coord: { q: 1, r: 0 },
                    color: 'black'
                }]
            };

            expect(adapter.isValidMove(state, move)).toBe(true);
            const nextState = adapter.applyMove(state, move) as ProdutoState;
            expect(nextState.jogadorAtual).toBe('jogador2'); // Ainda é vez dele
            expect(nextState.jogadaEmCurso.pos1).not.toBeNull();
        });
    });

    describe('Atari Go Adapter', () => {
        const adapter = getGameAdapter('atari-go')!;

        it('should validate and apply a move in network format (row, col)', () => {
            const state = adapter.createInitialState() as AtariGoState;
            const move = { row: 3, col: 5 };

            expect(adapter.isValidMove(state, move)).toBe(true);
            const nextState = adapter.applyMove(state, move) as AtariGoState;
            expect(nextState).not.toBeNull();
            expect(nextState.tabuleiro[3][5]).toBe('preta');
        });
    });

    describe('Nex Adapter', () => {
        const adapter = getGameAdapter('nex')!;

        it('should validate and apply a "place" move in network format', () => {
            const state = adapter.createInitialState() as NexState;
            const move = {
                type: 'place',
                ownPiece: { row: 5, col: 5 },
                neutralPiece: { row: 5, col: 6 }
            };

            expect(adapter.isValidMove(state, move)).toBe(true);
            const nextState = adapter.applyMove(state, move) as NexState;
            expect(nextState).not.toBeNull();
            expect(nextState.tabuleiro[5][5]).toBe('preta');
            expect(nextState.tabuleiro[5][6]).toBe('neutra');
        });

        it('should validate and apply a "swap" move in network format', () => {
            const state = adapter.createInitialState() as NexState;
            // Para swap ser válido em Nex, tem de ser a primeira jogada do segundo jogador?
            // Pelo logic.ts, swapDisponivel é gerido internamente.
            // Vamos simular um estado onde swap está disponível.
            state.swapDisponivel = true;

            const move = { type: 'swap' };
            expect(adapter.isValidMove(state, move)).toBe(true);
            const nextState = adapter.applyMove(state, move) as NexState;
            expect(nextState).not.toBeNull();
            expect(nextState.swapEfetuado).toBe(true);
        });
    });
});
