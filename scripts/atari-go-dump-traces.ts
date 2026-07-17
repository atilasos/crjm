/**
 * atari-go-dump-traces.ts
 *
 * Joga N partidas aleatórias de Atari Go 9x9 usando as regras TypeScript
 * (src/games/atari-go/logic.ts — fonte de verdade) e escreve um trace JSONL
 * em training/traces/atari-go-traces.jsonl, um objeto por ply:
 *
 *   { game, ply, board, toPlay, legalMoves, movePlayed, captured, status }
 *
 * - board: array de 81 (0=vazia, 1=preta, 2=branca), estado ANTES da jogada
 * - toPlay: 1 (pretas) | 2 (brancas)
 * - legalMoves: índices linha*9+coluna das jogadas legais nesse estado
 * - movePlayed: índice da jogada efetuada
 * - captured: true se a jogada capturou (=> vitória do jogador que jogou)
 * - status: estado APÓS a jogada: 'ongoing' | 'win' | 'draw'
 *
 * Uso: bun scripts/atari-go-dump-traces.ts [--games N] [--seed S] [--out caminho]
 */

import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  criarEstadoInicial,
  colocarPedra,
} from '../src/games/atari-go/logic';
import { AtariGoState, Celula, Posicao, TAMANHO_TABULEIRO } from '../src/games/atari-go/types';

// RNG determinístico (mulberry32)
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

function parseArgs(): { games: number; seed: number; out: string } {
  const argv = process.argv.slice(2);
  let games = 500;
  let seed = 20260717;
  let out = join(import.meta.dir, '..', 'training', 'traces', 'atari-go-traces.jsonl');
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--games') games = parseInt(argv[++i], 10);
    else if (argv[i] === '--seed') seed = parseInt(argv[++i], 10);
    else if (argv[i] === '--out') out = argv[++i];
  }
  if (!Number.isFinite(games) || games <= 0) throw new Error(`--games inválido: ${games}`);
  return { games, seed, out };
}

function boardToArray(tabuleiro: Celula[][]): number[] {
  const arr: number[] = new Array(81);
  for (let l = 0; l < TAMANHO_TABULEIRO; l++) {
    for (let c = 0; c < TAMANHO_TABULEIRO; c++) {
      const cel = tabuleiro[l][c];
      arr[l * 9 + c] = cel === 'vazia' ? 0 : cel === 'preta' ? 1 : 2;
    }
  }
  return arr;
}

function posToIndex(p: Posicao): number {
  return p.linha * 9 + p.coluna;
}

function main() {
  const { games, seed, out } = parseArgs();
  const rng = mulberry32(seed);
  mkdirSync(dirname(out), { recursive: true });

  const lines: string[] = [];
  let totalPlies = 0;
  const resultados = { win: 0, draw: 0 };

  for (let game = 0; game < games; game++) {
    let state: AtariGoState = criarEstadoInicial('dois-jogadores');
    let ply = 0;

    while (state.estado === 'a-jogar') {
      if (ply >= 81) {
        throw new Error(`jogo ${game}: excedeu 81 plies sem terminar (impossível)`);
      }
      const board = boardToArray(state.tabuleiro);
      const toPlay = state.jogadorAtual === 'jogador1' ? 1 : 2;
      const legalMoves = state.jogadasValidas.map(posToIndex).sort((a, b) => a - b);
      if (legalMoves.length === 0) {
        throw new Error(`jogo ${game} ply ${ply}: estado 'a-jogar' sem jogadas legais`);
      }

      const escolha = state.jogadasValidas[Math.floor(rng() * state.jogadasValidas.length)];
      const capturasAntes = state.pedrasCapturadas.pretas + state.pedrasCapturadas.brancas;
      const novoState = colocarPedra(state, escolha);
      if (novoState === state) {
        throw new Error(`jogo ${game} ply ${ply}: jogada rejeitada ${posToIndex(escolha)}`);
      }
      const capturasDepois = novoState.pedrasCapturadas.pretas + novoState.pedrasCapturadas.brancas;
      const captured = capturasDepois > capturasAntes;

      let status: 'ongoing' | 'win' | 'draw';
      if (novoState.estado === 'a-jogar') status = 'ongoing';
      else if (novoState.estado === 'empate') status = 'draw';
      else status = 'win';

      // Coerência interna: vitória <=> captura
      if ((status === 'win') !== captured) {
        throw new Error(`jogo ${game} ply ${ply}: incoerência captura/vitória`);
      }

      lines.push(
        JSON.stringify({
          game,
          ply,
          board,
          toPlay,
          legalMoves,
          movePlayed: posToIndex(escolha),
          captured,
          status,
        })
      );

      state = novoState;
      ply++;
      totalPlies++;
    }

    if (state.estado === 'empate') resultados.draw++;
    else resultados.win++;
  }

  Bun.write(out, lines.join('\n') + '\n');
  console.log(
    `OK: ${games} jogos, ${totalPlies} plies, ${resultados.win} vitórias, ${resultados.draw} empates -> ${out}`
  );
}

main();
