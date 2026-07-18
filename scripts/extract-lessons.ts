/**
 * F3 dos percursos (docs/PERCURSOS-CAMPEONATO.md): extração de lições dos
 * jogos de colocação com regras TypeScript, por RESOLUÇÃO EXATA de finais.
 *
 * Em vez de confiar em avaliações heurísticas do motor, joga aberturas
 * aleatórias com seed até o número de jogadas legais ser pequeno e resolve
 * a posição por negamax memoizado até ao fim do jogo. Um candidato a puzzle
 * é uma posição com ≥3 jogadas legais em que EXATAMENTE UMA vence — uma
 * afirmação demonstrada, não estimada.
 *
 * Uso: bun scripts/extract-lessons.ts [--games dominorio,quelhas,gatos-caes]
 *        [--playouts 400] [--solve-moves 12] [--max 12] [--seed 20260718]
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import * as dominorio from '../src/games/dominorio/logic';
import type { Domino, DominorioState } from '../src/games/dominorio/types';
import * as quelhas from '../src/games/quelhas/logic';
import type { QuelhasState, Segmento } from '../src/games/quelhas/types';
import * as gatosCaes from '../src/games/gatos-caes/logic';
import type { GatosCaesState, Posicao } from '../src/games/gatos-caes/types';

type Status = 'a-jogar' | 'vitoria-jogador1' | 'vitoria-jogador2' | 'empate';

interface GameAdapter<S, M> {
  name: string;
  initial(): S;
  moves(state: S): M[];
  play(state: S, move: M): S;
  status(state: S): Status;
  current(state: S): 'jogador1' | 'jogador2';
  key(state: S): string;
  describeMove(move: M): string;
  moveCell(move: M): { linha: number; coluna: number };
  rows(state: S): string[];
}

const dominorioAdapter: GameAdapter<DominorioState, Domino> = {
  name: 'dominorio',
  initial: () => dominorio.criarEstadoInicial('vs-computador'),
  moves: (s) => dominorio.calcularJogadasValidas(s.tabuleiro, s.jogadorAtual),
  play: (s, m) => dominorio.colocarDomino(s, m),
  status: (s) => s.estado,
  current: (s) => s.jogadorAtual,
  key: (s) =>
    s.tabuleiro.map((row) => row.map((c) => (c === 'vazia' ? '.' : c === 'ocupada-vertical' ? 'V' : 'H')).join('')).join('|') +
    `:${s.jogadorAtual}`,
  describeMove: (m) => `(${m.pos1.linha},${m.pos1.coluna})+(${m.pos2.linha},${m.pos2.coluna}) ${m.orientacao}`,
  moveCell: (m) => m.pos1,
  rows: (s) => {
    // X = dominós do jogador a mover (vertical=jogador1), O = do adversário
    const mineIsVertical = s.jogadorAtual === 'jogador1';
    return s.tabuleiro.map((row) =>
      row
        .map((c) => {
          if (c === 'vazia') return '.';
          const vertical = c === 'ocupada-vertical';
          return vertical === mineIsVertical ? 'X' : 'O';
        })
        .join(''),
    );
  },
};

const quelhasAdapter: GameAdapter<QuelhasState, Segmento> = {
  name: 'quelhas',
  initial: () => quelhas.criarEstadoInicial('vs-computador'),
  moves: (s) =>
    quelhas.calcularJogadasValidas(s.tabuleiro, quelhas.getOrientacaoJogador(s, s.jogadorAtual)),
  play: (s, m) => quelhas.colocarSegmento(s, m),
  status: (s) => s.estado,
  current: (s) => s.jogadorAtual,
  key: (s) =>
    s.tabuleiro.map((row) => row.map((c) => (c === 'vazia' ? '.' : '#')).join('')).join('|') +
    `:${s.jogadorAtual}:${quelhas.getOrientacaoJogador(s, s.jogadorAtual)}`,
  describeMove: (m) => `início (${m.inicio.linha},${m.inicio.coluna}), comprimento ${m.comprimento}, ${m.orientacao}`,
  moveCell: (m) => m.inicio,
  rows: (s) => s.tabuleiro.map((row) => row.map((c) => (c === 'vazia' ? '.' : 'N')).join('')),
};

const gatosCaesAdapter: GameAdapter<GatosCaesState, Posicao> = {
  name: 'gatos-caes',
  initial: () => gatosCaes.criarEstadoInicial('vs-computador'),
  moves: (s) =>
    gatosCaes.calcularJogadasValidas(s.tabuleiro, s.jogadorAtual, s.primeiroGatoColocado, s.primeiroCaoColocado),
  play: (s, m) => gatosCaes.colocarPeca(s, m),
  status: (s) => s.estado,
  current: (s) => s.jogadorAtual,
  key: (s) =>
    s.tabuleiro.map((row) => row.map((c) => (c === 'vazia' ? '.' : c === 'gato' ? 'G' : 'C')).join('')).join('|') +
    `:${s.jogadorAtual}`,
  describeMove: (m) => `casa (${m.linha},${m.coluna})`,
  moveCell: (m) => m,
  rows: (s) => {
    const mineIsGato = s.jogadorAtual === 'jogador1';
    return s.tabuleiro.map((row) =>
      row
        .map((c) => {
          if (c === 'vazia') return '.';
          return (c === 'gato') === mineIsGato ? 'X' : 'O';
        })
        .join(''),
    );
  },
};

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

interface SolveContext {
  memo: Map<string, boolean>;
  nodes: number;
  budget: number;
}

class SolveBudgetExceeded extends Error {}

/** true se quem está a mover em `state` vence com jogo perfeito. */
function solve<S, M>(adapter: GameAdapter<S, M>, state: S, ctx: SolveContext): boolean {
  const status = adapter.status(state);
  if (status !== 'a-jogar') {
    // terminal no próprio turno não acontece nos jogos de colocação; guarda:
    return status === (adapter.current(state) === 'jogador1' ? 'vitoria-jogador1' : 'vitoria-jogador2');
  }
  const key = adapter.key(state);
  const cached = ctx.memo.get(key);
  if (cached !== undefined) return cached;
  if ((ctx.nodes += 1) > ctx.budget) throw new SolveBudgetExceeded();

  const mover = adapter.current(state);
  let result = false;
  for (const move of adapter.moves(state)) {
    const next = adapter.play(state, move);
    const nextStatus = adapter.status(next);
    let moverWins: boolean;
    if (nextStatus === 'a-jogar') {
      moverWins = !solve(adapter, next, ctx);
    } else if (nextStatus === 'empate') {
      moverWins = false;
    } else {
      moverWins = nextStatus === (mover === 'jogador1' ? 'vitoria-jogador1' : 'vitoria-jogador2');
    }
    if (moverWins) {
      result = true;
      break;
    }
  }
  ctx.memo.set(key, result);
  return result;
}

interface Candidate {
  playoutSeed: number;
  plies: number;
  toPlay: string;
  legalMoves: number;
  rows: string[];
  winningMove: string;
  winningCell: { linha: number; coluna: number };
  losingSample: string[];
  solvedNodes: number;
}

function extractForGame<S, M>(
  adapter: GameAdapter<S, M>,
  options: { playouts: number; solveMoves: number; max: number; seed: number; nodeBudget: number },
): Candidate[] {
  const candidates: Candidate[] = [];
  const seen = new Set<string>();

  for (let p = 0; p < options.playouts && candidates.length < options.max; p += 1) {
    const random = mulberry32((options.seed ^ (p * 0x9e3779b9)) >>> 0);
    let state = adapter.initial();
    let plies = 0;

    while (adapter.status(state) === 'a-jogar') {
      const moves = adapter.moves(state);
      if (moves.length === 0) break;

      const key = adapter.key(state);
      if (moves.length >= 3 && moves.length <= options.solveMoves && !seen.has(key)) {
        seen.add(key);
        const ctx: SolveContext = { memo: new Map(), nodes: 0, budget: options.nodeBudget };
        try {
          const mover = adapter.current(state);
          const winning: M[] = [];
          for (const move of moves) {
            const next = adapter.play(state, move);
            const nextStatus = adapter.status(next);
            const moverWins =
              nextStatus === 'a-jogar'
                ? !solve(adapter, next, ctx)
                : nextStatus === (mover === 'jogador1' ? 'vitoria-jogador1' : 'vitoria-jogador2');
            if (moverWins) winning.push(move);
            if (winning.length > 1) break;
          }
          if (winning.length === 1) {
            candidates.push({
              playoutSeed: p,
              plies,
              toPlay: adapter.current(state),
              legalMoves: moves.length,
              rows: adapter.rows(state),
              winningMove: adapter.describeMove(winning[0]!),
              winningCell: adapter.moveCell(winning[0]!),
              losingSample: moves
                .filter((m) => m !== winning[0])
                .slice(0, 3)
                .map((m) => adapter.describeMove(m)),
              solvedNodes: ctx.nodes,
            });
          }
        } catch (error) {
          if (!(error instanceof SolveBudgetExceeded)) throw error;
        }
        if (candidates.length >= options.max) break;
      }

      state = adapter.play(state, moves[Math.floor(random() * moves.length)]!);
      plies += 1;
    }
  }
  return candidates;
}

function renderPreview(name: string, candidates: Candidate[]): string {
  const lines: string[] = [`## ${name}: ${candidates.length} posições com única jogada vencedora (demonstrado)`];
  candidates.forEach((c, i) => {
    lines.push(
      `#${i} toPlay=${c.toPlay} legais=${c.legalMoves} plies=${c.plies} nós=${c.solvedNodes} vence: ${c.winningMove}`,
    );
    const marked = c.rows.map((row) => [...row]);
    marked[c.winningCell.linha]![c.winningCell.coluna] = '!';
    lines.push(...marked.map((row) => `  ${row.join('')}`));
    lines.push(`  alternativas (perdem): ${c.losingSample.join(' | ')}`);
    lines.push('');
  });
  return lines.join('\n');
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const flag = (name: string, fallback: string) => {
    const index = args.indexOf(`--${name}`);
    return index >= 0 && index + 1 < args.length ? args[index + 1]! : fallback;
  };
  const games = flag('games', 'dominorio,quelhas,gatos-caes').split(',');
  const options = {
    playouts: Number(flag('playouts', '400')),
    solveMoves: Number(flag('solve-moves', '12')),
    max: Number(flag('max', '12')),
    seed: Number(flag('seed', '20260718')) >>> 0,
    nodeBudget: Number(flag('node-budget', '2000000')),
  };

  const adapters: Record<string, GameAdapter<unknown, unknown>> = {
    dominorio: dominorioAdapter as GameAdapter<unknown, unknown>,
    quelhas: quelhasAdapter as GameAdapter<unknown, unknown>,
    'gatos-caes': gatosCaesAdapter as GameAdapter<unknown, unknown>,
  };

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = join(process.cwd(), 'artifacts', 'lessons-classic', stamp);
  await mkdir(outDir, { recursive: true });

  for (const game of games) {
    const adapter = adapters[game];
    if (!adapter) {
      console.error(`sem adaptador para ${game} (disponíveis: ${Object.keys(adapters).join(', ')})`);
      continue;
    }
    const started = performance.now();
    const candidates = extractForGame(adapter, options);
    const seconds = ((performance.now() - started) / 1000).toFixed(1);
    await writeFile(join(outDir, `${game}.json`), `${JSON.stringify({ options, candidates }, null, 2)}\n`);
    await writeFile(join(outDir, `${game}.txt`), renderPreview(game, candidates));
    console.log(`${game}: ${candidates.length} candidatos em ${seconds}s`);
  }
  console.log(`artefactos: ${outDir}`);
}

await main();
