/**
 * quelhas-dump-traces.ts
 *
 * Joga N partidas aleatórias de Quelhas 10×10 usando as regras TypeScript
 * (src/games/quelhas/logic.ts — fonte de verdade) e escreve um trace JSONL
 * em training/traces/quelhas-traces.jsonl, um objeto por ply:
 *
 *   { game, ply, board, toPlay, legalActions, actionPlayed, status }
 *
 * - board: array de 100 (0=vazia, 1=ocupada), estado ANTES da jogada
 * - toPlay: 1 (vertical) | 2 (horizontal)
 * - ação: id = start*9 + (comprimento-2), start = linha*10+coluna (a
 *   orientação é implícita no jogador) → 900 ações possíveis
 * - status APÓS a jogada: 'ongoing' | 'loss' (misère: o mover fez a última
 *   jogada possível? não — 'loss' significa que o ADVERSÁRIO ficou sem
 *   jogadas e portanto GANHA; quem moveu perde)
 *
 * Uso: bun scripts/quelhas-dump-traces.ts [--games N] [--seed S]
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  calcularJogadasValidas,
  colocarSegmento,
  criarEstadoInicial,
  getOrientacaoJogador,
} from '../src/games/quelhas/logic';
import type { Segmento } from '../src/games/quelhas/types';

const SIZE = 10;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function actionId(move: Segmento): number {
  const start = move.inicio.linha * SIZE + move.inicio.coluna;
  return start * 9 + (move.comprimento - 2);
}

function parseFlag(name: string, fallback: number): number {
  const args = process.argv.slice(2);
  const index = args.indexOf(`--${name}`);
  return index >= 0 && index + 1 < args.length ? Number(args[index + 1]) : fallback;
}

const games = parseFlag('games', 500);
const seed = parseFlag('seed', 20260718);
const random = mulberry32(seed);

const lines: string[] = [];
for (let g = 0; g < games; g += 1) {
  let state = criarEstadoInicial('vs-computador');
  let ply = 0;
  while (state.estado === 'a-jogar') {
    const orientacao = getOrientacaoJogador(state, state.jogadorAtual);
    const legal = calcularJogadasValidas(state.tabuleiro, orientacao);
    if (legal.length === 0) break;
    const board = state.tabuleiro.flat().map((c) => (c === 'vazia' ? 0 : 1));
    const move = legal[Math.floor(random() * legal.length)]!;
    const next = colocarSegmento(state, move);
    lines.push(
      JSON.stringify({
        game: g,
        ply,
        board,
        toPlay: state.jogadorAtual === 'jogador1' ? 1 : 2,
        legalActions: legal.map(actionId).sort((a, b) => a - b),
        actionPlayed: actionId(move),
        status: next.estado === 'a-jogar' ? 'ongoing' : 'loss',
      }),
    );
    state = next;
    ply += 1;
  }
}

const outDir = join(process.cwd(), 'training', 'traces');
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, 'quelhas-traces.jsonl');
writeFileSync(outPath, `${lines.join('\n')}\n`);
console.log(`${games} jogos, ${lines.length} plies → ${outPath}`);
