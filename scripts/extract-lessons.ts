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
import * as produto from '../src/games/produto/logic';
import { LADO_TABULEIRO as PRODUTO_LADO, posToKey } from '../src/games/produto/types';
import type { ProdutoState, Posicao as PosicaoHex } from '../src/games/produto/types';
import * as nex from '../src/games/nex/logic';
import { LADO_TABULEIRO as NEX_LADO } from '../src/games/nex/types';
import type { NexState, Posicao as PosicaoNex } from '../src/games/nex/types';

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

interface ProdutoMove {
  placements: Array<{ pos: PosicaoHex; cor: 'preta' | 'branca' }>;
}

const PRODUTO_N = PRODUTO_LADO - 1;

function produtoRowCol(pos: PosicaoHex): { linha: number; coluna: number } {
  const linha = pos.r + PRODUTO_N;
  const qMin = Math.max(-PRODUTO_N, -pos.r - PRODUTO_N);
  const qMax = Math.min(PRODUTO_N, -pos.r + PRODUTO_N);
  const len = qMax - qMin + 1;
  const prefix = Math.floor((2 * PRODUTO_N + 1 - len) / 2);
  return { linha, coluna: prefix + (pos.q - qMin) };
}

const produtoAdapter: GameAdapter<ProdutoState, ProdutoMove> = {
  name: 'produto',
  initial: () => produto.criarEstadoInicial('vs-computador'),
  moves: (s) => {
    const vazias = s.casasVazias;
    const cores: Array<'preta' | 'branca'> = ['preta', 'branca'];
    const moves: ProdutoMove[] = [];
    if (s.primeiraJogada) {
      for (const pos of vazias) for (const cor of cores) moves.push({ placements: [{ pos, cor }] });
      return moves;
    }
    for (let i = 0; i < vazias.length; i += 1) {
      for (let j = i + 1; j < vazias.length; j += 1) {
        for (const cor1 of cores) {
          for (const cor2 of cores) {
            moves.push({ placements: [{ pos: vazias[i]!, cor: cor1 }, { pos: vazias[j]!, cor: cor2 }] });
          }
        }
      }
    }
    return moves;
  },
  play: (s, m) => {
    let next = s;
    for (const { pos, cor } of m.placements) next = produto.colocarPeca(next, pos, cor);
    return next;
  },
  status: (s) => s.estado,
  current: (s) => s.jogadorAtual,
  key: (s) =>
    Object.keys(s.tabuleiro)
      .sort()
      .map((k) => (s.tabuleiro[k] === 'vazia' ? '.' : s.tabuleiro[k] === 'preta' ? 'P' : 'B'))
      .join('') + `:${s.jogadorAtual}`,
  describeMove: (m) =>
    m.placements.map(({ pos, cor }) => `(${pos.q},${pos.r}) ${cor}`).join(' + '),
  moveCell: (m) => produtoRowCol(m.placements[0]!.pos),
  rows: (s) => {
    // X = cor de quem joga, O = adversária; '#' preenche o recorte hexagonal
    const minha = s.jogadorAtual === 'jogador1' ? 'preta' : 'branca';
    const width = 2 * PRODUTO_N + 1;
    const grid: string[][] = Array.from({ length: width }, () => Array(width).fill('#'));
    for (const key of Object.keys(s.tabuleiro)) {
      const [q, r] = key.split(',').map(Number) as [number, number];
      const { linha, coluna } = produtoRowCol({ q, r });
      const cell = s.tabuleiro[key]!;
      grid[linha]![coluna] = cell === 'vazia' ? '.' : cell === minha ? 'X' : 'O';
    }
    return grid.map((row) => row.join(''));
  },
};

interface NexRaceCandidate {
  toPlay: string;
  plies: number;
  rows: string[];
  winningCell: { linha: number; coluna: number };
  opponentThreats: Array<{ linha: number; coluna: number }>;
  legalPlacementCells: number;
}

/**
 * Critério exato do Nex («ligação imediata»): exatamente uma casa completa a
 * ligação do jogador atual JÁ, e nenhuma substituição vence de imediato —
 * ambos os factos verificados exaustivamente. Nota de honestidade: ao
 * contrário dos finais resolvidos, isto NÃO prova que as alternativas
 * perdem o jogo — apenas que falham a vitória imediata (no Nex, a pedra
 * neutra bloqueia corridas com uma única jogada, o que torna a prova de
 * derrota das alternativas um problema de busca profunda).
 */
const NEX_DIRECOES = [
  { dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 },
  { dx: 0, dy: -1 }, { dx: 1, dy: -1 }, { dx: -1, dy: 1 },
] as const;

function nexVizinhos(pos: PosicaoNex): PosicaoNex[] {
  const result: PosicaoNex[] = [];
  for (const { dx, dy } of NEX_DIRECOES) {
    const x = pos.x + dx;
    const y = pos.y + dy;
    if (x >= 0 && x < NEX_LADO && y >= 0 && y < NEX_LADO) result.push({ x, y });
  }
  return result;
}

/** O tabuleiro do Nex indexa-se `tabuleiro[x][y]` (ver verificarVitoria). */
function nexCells(board: NexState['tabuleiro']): { empties: PosicaoNex[]; neutras: PosicaoNex[] } {
  const empties: PosicaoNex[] = [];
  const neutras: PosicaoNex[] = [];
  for (let x = 0; x < NEX_LADO; x += 1) {
    for (let y = 0; y < NEX_LADO; y += 1) {
      const cell = board[x]![y]!;
      if (cell === 'vazia') empties.push({ x, y });
      else if (cell === 'neutra') neutras.push({ x, y });
    }
  }
  return { empties, neutras };
}

function nexRaceCandidate(state: NexState, plies: number): NexRaceCandidate | null {
  const board = state.tabuleiro;
  const minhaCor = nex.getCorJogador(state, state.jogadorAtual);
  const corDele = minhaCor === 'preta' ? 'branca' : 'preta';
  const { empties, neutras } = nexCells(board);
  if (empties.length < 2) return null;

  const connectsWith = (cor: 'preta' | 'branca', pos: PosicaoNex): boolean => {
    const copy = board.map((row) => [...row]);
    copy[pos.x]![pos.y] = cor;
    return nex.verificarVitoria(copy, cor);
  };

  const myWins = empties.filter((pos) => connectsWith(minhaCor, pos));
  if (myWins.length !== 1) return null;

  const theirWins = empties.filter((pos) => connectsWith(corDele, pos));

  // nenhuma substituição pode vencer já (2 neutras a tornarem-se minhas)
  if (nex.podeSubstituir(board, state.jogadorAtual, state.swapEfetuado ?? false)) {
    for (let i = 0; i < neutras.length; i += 1) {
      for (let j = i + 1; j < neutras.length; j += 1) {
        const copy = board.map((row) => [...row]);
        copy[neutras[i]!.x]![neutras[i]!.y] = minhaCor;
        copy[neutras[j]!.x]![neutras[j]!.y] = minhaCor;
        if (nex.verificarVitoria(copy, minhaCor)) return null;
      }
    }
  }

  // Diagrama por linhas visuais: linha = y, coluna = x (tabuleiro é [x][y]).
  const rows: string[] = [];
  for (let y = 0; y < NEX_LADO; y += 1) {
    let row = '';
    for (let x = 0; x < NEX_LADO; x += 1) {
      const cell = board[x]![y]!;
      row += cell === 'vazia' ? '.' : cell === 'neutra' ? 'N' : cell === minhaCor ? 'X' : 'O';
    }
    rows.push(row);
  }
  const win = myWins[0]!;
  return {
    toPlay: state.jogadorAtual,
    plies,
    rows,
    winningCell: { linha: win.y, coluna: win.x },
    opponentThreats: theirWins.map((pos) => ({ linha: pos.y, coluna: pos.x })),
    legalPlacementCells: empties.length,
  };
}

/**
 * Distância 0-1 de ligação para `cor`: caminho mínimo entre as duas margens
 * atravessando pedras próprias (custo 0) e casas vazias (custo 1).
 * Devolve, por casa vazia, o custo do melhor caminho que passa por ela.
 */
function nexPathScores(board: NexState['tabuleiro'], cor: 'preta' | 'branca'): Map<string, number> {
  const bfs = (fromStart: boolean): number[][] => {
    const dist: number[][] = Array.from({ length: NEX_LADO }, () => Array(NEX_LADO).fill(Infinity));
    const deque: Array<[number, number]> = [];
    const trySeed = (x: number, y: number) => {
      const cell = board[x]![y]!;
      if (cell !== cor && cell !== 'vazia') return;
      const cost = cell === cor ? 0 : 1;
      if (cost < dist[x]![y]!) {
        dist[x]![y] = cost;
        if (cost === 0) deque.unshift([x, y]);
        else deque.push([x, y]);
      }
    };
    for (let i = 0; i < NEX_LADO; i += 1) {
      if (cor === 'preta') trySeed(i, fromStart ? 0 : NEX_LADO - 1);
      else trySeed(fromStart ? 0 : NEX_LADO - 1, i);
    }
    while (deque.length > 0) {
      const [x, y] = deque.shift()!;
      const base = dist[x]![y]!;
      for (const viz of nexVizinhos({ x, y })) {
        const cell = board[viz.x]![viz.y]!;
        if (cell !== cor && cell !== 'vazia') continue;
        const cost = base + (cell === cor ? 0 : 1);
        if (cost < dist[viz.x]![viz.y]!) {
          dist[viz.x]![viz.y] = cost;
          if (cell === cor) deque.unshift([viz.x, viz.y]);
          else deque.push([viz.x, viz.y]);
        }
      }
    }
    return dist;
  };
  const fromA = bfs(true);
  const fromB = bfs(false);
  const scores = new Map<string, number>();
  for (let x = 0; x < NEX_LADO; x += 1) {
    for (let y = 0; y < NEX_LADO; y += 1) {
      if (board[x]![y] !== 'vazia') continue;
      scores.set(`${x},${y}`, fromA[x]![y]! + fromB[x]![y]! - 1);
    }
  }
  return scores;
}

function pickMin(scores: Map<string, number>, random: () => number): PosicaoNex | null {
  let best = Infinity;
  const ties: PosicaoNex[] = [];
  for (const [key, score] of scores) {
    if (score < best) {
      best = score;
      ties.length = 0;
    }
    if (score === best) {
      const [x, y] = key.split(',').map(Number) as [number, number];
      ties.push({ x, y });
    }
  }
  if (!Number.isFinite(best) || ties.length === 0) return null;
  return ties[Math.floor(random() * ties.length)]!;
}

function extractNexRaces(options: { playouts: number; max: number; seed: number }): NexRaceCandidate[] {
  const candidates: NexRaceCandidate[] = [];
  const seen = new Set<string>();
  for (let p = 0; p < options.playouts && candidates.length < options.max; p += 1) {
    const random = mulberry32((options.seed ^ (p * 0x85ebca6b)) >>> 0);
    let state = nex.criarEstadoInicial('vs-computador');
    let plies = 0;
    while (state.estado === 'a-jogar' && plies < 130) {
      const { empties } = nexCells(state.tabuleiro);
      if (empties.length < 2) break;

      if (plies > 10) {
        const candidate = nexRaceCandidate(state, plies);
        if (candidate) {
          const key = candidate.rows.join('|') + candidate.toPlay;
          if (!seen.has(key)) {
            seen.add(key);
            candidates.push(candidate);
          }
          break;
        }
      }

      const minhaCor = nex.getCorJogador(state, state.jogadorAtual);
      const corDele = minhaCor === 'preta' ? 'branca' : 'preta';
      const myScores = nexPathScores(state.tabuleiro, minhaCor);
      const own =
        (random() < 0.8 ? pickMin(myScores, random) : null) ??
        empties[Math.floor(random() * empties.length)]!;
      const restantes = empties.filter((e) => e.x !== own.x || e.y !== own.y);
      const boardAfterOwn = state.tabuleiro.map((row) => [...row]);
      boardAfterOwn[own.x]![own.y] = minhaCor;
      const theirScores = nexPathScores(boardAfterOwn, corDele);
      theirScores.delete(`${own.x},${own.y}`);
      const neutral =
        (random() < 0.5 ? pickMin(theirScores, random) : null) ??
        restantes[Math.floor(random() * restantes.length)]!;
      state = nex.executarColocacao(state, { tipo: 'colocacao', posPropria: own, posNeutra: neutral });
      plies += 1;
    }
  }
  return candidates;
}

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
    produto: produtoAdapter as GameAdapter<unknown, unknown>,
  };

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = join(process.cwd(), 'artifacts', 'lessons-classic', stamp);
  await mkdir(outDir, { recursive: true });

  for (const game of games) {
    if (game === 'nex') {
      const started = performance.now();
      const races = extractNexRaces({ playouts: options.playouts, max: options.max, seed: options.seed });
      const seconds = ((performance.now() - started) / 1000).toFixed(1);
      await writeFile(join(outDir, 'nex.json'), `${JSON.stringify({ options, criterion: 'race', candidates: races }, null, 2)}\n`);
      const preview = races
        .map((c, i) => {
          const marked = c.rows.map((row) => [...row]);
          marked[c.winningCell.linha]![c.winningCell.coluna] = '!';
          for (const t of c.opponentThreats) marked[t.linha]![t.coluna] = '?';
          return [
            `#${i} toPlay=${c.toPlay} plies=${c.plies} vazias=${c.legalPlacementCells} ameaçasDele=${c.opponentThreats.length} vence=(${c.winningCell.linha},${c.winningCell.coluna})`,
            ...marked.map((row) => `  ${row.join('')}`),
            '',
          ].join('\n');
        })
        .join('\n');
      await writeFile(join(outDir, 'nex.txt'), `## nex: ${races.length} corridas de ligação (demonstrado)\n${preview}`);
      console.log(`nex: ${races.length} candidatos em ${seconds}s`);
      continue;
    }
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
