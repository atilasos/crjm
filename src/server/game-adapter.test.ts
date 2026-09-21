import { criarEstadoInicial as criarY, aplicarJogada as aplicarY } from '../games/y/logic';
import { toNetworkFaiscaMove, toNetworkGameState, fromNetworkGameState } from '../tournament/game-protocol';
import { describe, it, expect, test } from 'bun:test';
import assert from 'node:assert/strict';
import { getGameAdapter } from './game-adapter';
import type { ProdutoState } from '../games/produto/types';
import type { AtariGoState } from '../games/atari-go/types';
import type { NexState } from '../games/nex/types';
import { criarEstadoInicial as criarFaisca, colocarPeca as colocarFaisca } from '../games/faisca/logic';

describe('Faísca no torneio', () => {
    it('aplica a abertura pelas mesmas regras locais e recusa a repetição', () => {
        const adapter = getGameAdapter('faisca');
        expect(adapter).not.toBeNull();
        const initial = adapter!.createInitialState();
        const move = { row: 2, col: 5, distance: 3, direction: 'left' };
        const next = adapter!.applyMove(initial, move)!;
        expect(next).toEqual(colocarFaisca(criarFaisca(), { casa: { linha: 2, coluna: 5 }, distancia: 3, direcao: 'esquerda' }));
        expect(adapter!.applyMove(next, move)).toBeNull();
        expect(initial).toEqual(criarFaisca());
    });
});

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
            assert.ok(nextState.tabuleiro[3]);
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
            assert.ok(nextState.tabuleiro[5]);
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

it('Faísca: sequência oficial local/online, reservas, quatro direções, saltos e resultado', () => {
    const adapter = getGameAdapter('faisca')!;
    const sequence = ['f3', 'c3', 'c1', 'f1', 'f2', 'c2', 'c5', 'f5', 'f4', 'c4', 'a4', 'a2', 'a5', 'b5', 'b4', 'd4', 'd1', 'e1', 'b1', 'b2', 'b3', 'a3', 'a1'];
    let local = criarFaisca();
    let online = adapter.createInitialState();
    for (let i = 0; i < sequence.length - 1; i++) {
        const from = sequence[i]!, to = sequence[i + 1]!;
        const row = 5 - Number(from[1]), col = from.charCodeAt(0) - 97;
        const nextRow = 5 - Number(to[1]), nextCol = to.charCodeAt(0) - 97;
        const move = { casa: { linha: row, coluna: col },
            distancia: (Math.abs(nextRow - row) + Math.abs(nextCol - col)) as 1 | 2 | 3,
            direcao: nextRow < row ? 'cima' as const : nextRow > row ? 'baixo' as const : nextCol < col ? 'esquerda' as const : 'direita' as const };
        const before = structuredClone(online);
        for (const invalid of [null, [], {}, { row, col, distance: '1', direction: 'up' },
            { row: row + 0.5, col, distance: 1, direction: 'right' },
            { row, col, distance: 4, direction: 'right' }, { row, col, distance: 1, direction: '__proto__' },
            { row: -1, col, distance: 1, direction: 'down' }]) {
            expect(adapter.isValidMove(online, invalid)).toBe(false);
            expect(adapter.applyMove(online, invalid)).toBeNull();
        }
        if (i === 20) {
            expect(adapter.applyMove(online, { row, col, distance: 3, direction: 'right' })).toBeNull();
            expect(local.reservas.jogador1[3]).toBe(0);
        }
        expect(online).toEqual(before);
        local = colocarFaisca(local, move);
        const next = adapter.applyMove(online, toNetworkFaiscaMove(move));
        expect(next).toEqual(local);
        online = next!;
        expect(fromNetworkGameState('faisca', JSON.parse(JSON.stringify(toNetworkGameState('faisca', local))))).toEqual(local);
    }
    expect(adapter.isGameOver(online)).toBe(true);
    expect(adapter.getWinner(online)).toBe('jogador2');
    expect(adapter.applyMove(online, { row: 4, col: 0, distance: 2, direction: 'right' })).toBeNull();
});


describe('Y no torneio', () => {
    it('aplica a abertura e a troca mantendo a identidade e a peça inicial', () => {
        const adapter = getGameAdapter('y');
        expect(adapter).not.toBeNull();
        if (!adapter) throw new Error('Y indisponível no torneio');
        const initial = adapter.createInitialState();
        expect(adapter.applyMove(initial, { type: 'swap' })).toBeNull();
        const opened = adapter.applyMove(initial, { type: 'place', node: 'A1' });
        expect(opened).toEqual(aplicarY(criarY(), { type: 'place', node: 'A1' }));
        if (!opened) throw new Error('Abertura recusada');
        const swapped = adapter.applyMove(opened, { type: 'swap' });
        expect(swapped).toEqual(aplicarY(aplicarY(criarY(), { type: 'place', node: 'A1' }), { type: 'swap' }));
        if (!swapped) throw new Error('Troca recusada');
        expect(adapter.getCurrentPlayer(swapped)).toBe('jogador1');
        expect(adapter.applyMove(swapped, { type: 'swap' })).toBeNull();
        expect(adapter.applyMove(swapped, { type: 'place', node: 'A1' })).toBeNull();
        expect(initial).toEqual(criarY());
    });
});


test.each([false, true])('Y: sequência local/online, serialização e vencedor com troca=%s', swap => {
    const adapter = getGameAdapter('y');
    if (!adapter) throw new Error('Y indisponível');
    let local = criarY();
    let online = adapter.createInitialState();
    const path = ['A1', 'B1', 'C1', 'D3', 'E3', 'E4', 'E5', 'E6', 'E7', 'D8', 'C7', 'B8', 'A9'];
    const replies = ['M1', 'L1', 'K1', 'J1', 'I1', 'G1', 'E1', 'D1', 'I9', 'J7', 'K5', 'L3'];
    const play = (move: import('../games/y/types').YMove) => {
        expect(adapter.isValidMove(online, move)).toBe(true);
        local = aplicarY(local, move);
        const next = adapter.applyMove(online, move);
        expect(next).toEqual(local);
        if (!next) throw new Error('Jogada recusada');
        online = next;
        expect(fromNetworkGameState('y', JSON.parse(JSON.stringify(toNetworkGameState('y', local))))).toEqual(local);
        expect(adapter.getCurrentPlayer(online)).toBe(local.jogadorAtual);
    };
    play({ type: 'place', node: 'A1' });
    if (swap) play({ type: 'swap' });
    for (let i = 1; i < path.length; i++) {
        play({ type: 'place', node: replies[i - 1]! });
        expect(adapter.applyMove(online, { type: 'swap' })).toBeNull();
        play({ type: 'place', node: path[i]! });
    }
    expect(adapter.getWinner(online)).toBe(swap ? 'jogador2' : 'jogador1');
    expect(adapter.isGameOver(online)).toBe(true);
    expect(adapter.applyMove(online, { type: 'place', node: 'A5' })).toBeNull();
    expect(adapter.applyMove(online, { type: 'swap' })).toBeNull();
});

test('Y: rejeita entradas inválidas sem alterar o estado', () => {
    const adapter = getGameAdapter('y');
    if (!adapter) throw new Error('Y indisponível');
    const initial = adapter.createInitialState();
    for (const move of [null, {}, [], 1, { type: 'place' }, { type: 'place', node: 1 },
        { type: 'place', node: 'fora' }, { type: 'place', node: '__proto__' }, { type: 'swap' }, { type: 'reset' }]) {
        expect(adapter.isValidMove(initial, move)).toBe(false);
        expect(adapter.applyMove(initial, move)).toBeNull();
        expect(initial).toEqual(criarY());
    }
});
