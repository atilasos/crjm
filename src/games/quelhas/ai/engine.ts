import type { Celula, Orientacao, Segmento } from '../types';

const BOARD_SIZE = 10;
const CELL_COUNT = BOARD_SIZE * BOARD_SIZE;
const MIN_LEN = 2;

type Occ = { low: bigint; high: bigint };

const LOW_MASKS: bigint[] = Array.from({ length: 64 }, (_, i) => 1n << BigInt(i));
const HIGH_MASKS: bigint[] = Array.from({ length: 64 }, (_, i) => 1n << BigInt(i));

function setBit(occ: Occ, idx: number): Occ {
  if (idx < 64) {
    return { low: occ.low | LOW_MASKS[idx]!, high: occ.high };
  }
  return { low: occ.low, high: occ.high | HIGH_MASKS[idx - 64]! };
}

function hasBit(occ: Occ, idx: number): boolean {
  if (idx < 64) return (occ.low & LOW_MASKS[idx]!) !== 0n;
  return (occ.high & HIGH_MASKS[idx - 64]!) !== 0n;
}

function boardToOcc(tabuleiro: Celula[][]): Occ {
  let occ: Occ = { low: 0n, high: 0n };
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (tabuleiro[r]![c] === 'ocupada') {
        occ = setBit(occ, r * BOARD_SIZE + c);
      }
    }
  }
  return occ;
}

// Move encoding: start(0..127) | (len<<7) | (orient<<11)
// orient: 0 = vertical, 1 = horizontal
type EncMove = number;

function encMove(start: number, len: number, orient: 0 | 1): EncMove {
  return start | (len << 7) | (orient << 11);
}

function decMove(m: EncMove): { start: number; len: number; orient: 0 | 1 } {
  return {
    start: m & 0x7f,
    len: (m >> 7) & 0x0f,
    orient: ((m >> 11) & 1) as 0 | 1,
  };
}

function orientToBit(o: Orientacao): 0 | 1 {
  return o === 'vertical' ? 0 : 1;
}

function bitToOrient(b: 0 | 1): Orientacao {
  return b === 0 ? 'vertical' : 'horizontal';
}

function moveToSegmento(m: EncMove): Segmento {
  const { start, len, orient } = decMove(m);
  return {
    inicio: { linha: Math.floor(start / BOARD_SIZE), coluna: start % BOARD_SIZE },
    comprimento: len,
    orientacao: bitToOrient(orient),
  };
}

function applyMove(occ: Occ, m: EncMove): Occ {
  const { start, len, orient } = decMove(m);
  const delta = orient === 0 ? BOARD_SIZE : 1;
  let next = occ;
  for (let i = 0; i < len; i++) {
    next = setBit(next, start + i * delta);
  }
  return next;
}

type Run = { start: number; len: number; orient: 0 | 1 };

function extractRuns(occ: Occ, orient: 0 | 1): Run[] {
  const runs: Run[] = [];
  if (orient === 0) {
    // vertical: scan columns
    for (let c = 0; c < BOARD_SIZE; c++) {
      let startRow = -1;
      for (let r = 0; r <= BOARD_SIZE; r++) {
        const idx = r * BOARD_SIZE + c;
        const empty = r < BOARD_SIZE && !hasBit(occ, idx);
        if (empty && startRow === -1) startRow = r;
        else if (!empty && startRow !== -1) {
          const len = r - startRow;
          if (len >= MIN_LEN) {
            runs.push({ start: startRow * BOARD_SIZE + c, len, orient });
          }
          startRow = -1;
        }
      }
    }
  } else {
    // horizontal: scan rows
    for (let r = 0; r < BOARD_SIZE; r++) {
      let startCol = -1;
      for (let c = 0; c <= BOARD_SIZE; c++) {
        const idx = r * BOARD_SIZE + c;
        const empty = c < BOARD_SIZE && !hasBit(occ, idx);
        if (empty && startCol === -1) startCol = c;
        else if (!empty && startCol !== -1) {
          const len = c - startCol;
          if (len >= MIN_LEN) {
            runs.push({ start: r * BOARD_SIZE + startCol, len, orient });
          }
          startCol = -1;
        }
      }
    }
  }
  return runs;
}

function estimateMoveCountFromRuns(runs: Run[]): number {
  // sum_{runs} sum_{k=2..L} (L-k+1) = sum_{runs} (L*(L-1))/2
  let total = 0;
  for (const run of runs) {
    total += (run.len * (run.len - 1)) / 2;
  }
  return total;
}

function generateAllMoves(occ: Occ, orient: 0 | 1): EncMove[] {
  const runs = extractRuns(occ, orient);
  const moves: EncMove[] = [];
  const delta = orient === 0 ? BOARD_SIZE : 1;
  for (const run of runs) {
    const base = run.start;
    const L = run.len;
    for (let len = MIN_LEN; len <= L; len++) {
      for (let off = 0; off <= L - len; off++) {
        moves.push(encMove(base + off * delta, len, orient));
      }
    }
  }
  return moves;
}

function generateCandidateMoves(occ: Occ, orient: 0 | 1): EncMove[] {
  const runs = extractRuns(occ, orient);
  const moves: EncMove[] = [];
  const seen = new Set<number>();
  const delta = orient === 0 ? BOARD_SIZE : 1;

  const add = (start: number, len: number) => {
    if (len < MIN_LEN) return;
    const m = encMove(start, len, orient);
    if (!seen.has(m)) {
      seen.add(m);
      moves.push(m);
    }
  };

  const splitScore = (L: number, offset: number, len: number): number => {
    const left = offset;
    const right = L - (offset + len);
    const leftGood = left >= 2 ? 1 : 0;
    const rightGood = right >= 2 ? 1 : 0;
    const wasted = (left === 1 ? 1 : 0) + (right === 1 ? 1 : 0);
    return 10 * (leftGood + rightGood) - 3 * wasted - Math.abs(left - right) * 0.2;
  };

  for (const run of runs) {
    const base = run.start;
    const L = run.len;

    if (L <= 6) {
      for (let len = MIN_LEN; len <= L; len++) {
        for (let off = 0; off <= L - len; off++) {
          add(base + off * delta, len);
        }
      }
      continue;
    }

    // Extremidades: 2 e 3 em ambas as pontas
    for (const len of [2, 3]) {
      if (len > L) continue;
      add(base, len);
      add(base + (L - len) * delta, len);
    }

    // Longos: L e L-1 (pos 0 e 1)
    add(base, L);
    if (L - 1 >= 2) {
      add(base, L - 1);
      add(base + 1 * delta, L - 1);
    }

    // Split central: escolher (off,len) em len ∈ {2,3,4}
    let best: { score: number; off: number; len: number } | null = null;
    for (const len of [2, 3, 4]) {
      if (len > L) continue;
      const center = Math.floor((L - len) / 2);
      const offs = [center - 1, center, center + 1].filter(o => o >= 0 && o <= L - len);
      for (const off of offs) {
        const score = splitScore(L, off, len);
        if (!best || score > best.score) best = { score, off, len };
      }
    }
    if (best) add(base + best.off * delta, best.len);

    // Amostras (quartis + centro) com len=2..4
    const samples = new Set<number>([
      0,
      Math.floor(L / 4),
      Math.floor(L / 2),
      Math.floor((3 * L) / 4),
      L - 2,
    ]);
    for (const off of samples) {
      for (const len of [2, 3, 4]) {
        if (len > L) continue;
        if (off < 0 || off > L - len) continue;
        add(base + off * delta, len);
      }
    }
  }

  return moves;
}

function generateMovesDynamic(occ: Occ, orient: 0 | 1): EncMove[] {
  const runs = extractRuns(occ, orient);
  if (runs.length === 0) return [];
  const est = estimateMoveCountFromRuns(runs);
  // Se o branching for pequeno, gerar tudo para não perder táticas.
  if (est <= 220) {
    return generateAllMoves(occ, orient);
  }
  return generateCandidateMoves(occ, orient);
}

type Metrics = {
  min: number;
  max: number;
  minExcl: number;
  maxExcl: number;
};

function addRunCells(mask: Occ, run: Run): Occ {
  const delta = run.orient === 0 ? BOARD_SIZE : 1;
  let next = mask;
  for (let i = 0; i < run.len; i++) {
    next = setBit(next, run.start + i * delta);
  }
  return next;
}

function runOverlaps(mask: Occ, run: Run): boolean {
  const delta = run.orient === 0 ? BOARD_SIZE : 1;
  for (let i = 0; i < run.len; i++) {
    if (hasBit(mask, run.start + i * delta)) return true;
  }
  return false;
}

function computeMetricsForOrient(occ: Occ, myOrient: 0 | 1, oppPlayableMask: Occ): Metrics {
  const runs = extractRuns(occ, myOrient);
  let min = 0;
  let max = 0;
  let minExcl = 0;
  let maxExcl = 0;

  for (const run of runs) {
    min += 1;
    max += Math.floor(run.len / 2);
    const exclusive = !runOverlaps(oppPlayableMask, run);
    if (exclusive) {
      minExcl += 1;
      maxExcl += Math.floor(run.len / 2);
    }
  }

  return { min, max, minExcl, maxExcl };
}

function evaluateMisere(occ: Occ, sideToMove: 0 | 1): number {
  const myOrient = sideToMove;
  const oppOrient = (1 - sideToMove) as 0 | 1;

  const runsV = extractRuns(occ, 0);
  const runsH = extractRuns(occ, 1);

  let maskV: Occ = { low: 0n, high: 0n };
  let maskH: Occ = { low: 0n, high: 0n };
  for (const r of runsV) maskV = addRunCells(maskV, r);
  for (const r of runsH) maskH = addRunCells(maskH, r);

  const mV = computeMetricsForOrient(occ, 0, maskH);
  const mH = computeMetricsForOrient(occ, 1, maskV);

  const my = myOrient === 0 ? mV : mH;
  const opp = myOrient === 0 ? mH : mV;

  let score = 0;

  // Reserva exclusiva (tempo)
  score += (my.maxExcl - opp.maxExcl) * 50;

  // Flexibilidade (max-min)
  score += ((my.max - my.min) - (opp.max - opp.min)) * 15;

  // Queremos que o adversário tenha de jogar
  if (opp.min > 0) score += opp.min * 30;

  // Controlo de tempo
  if (my.maxExcl >= opp.max && my.maxExcl > 0) {
    score += 200;
    score += (my.maxExcl - opp.max) * 25;
  }

  const totalMax = my.max + opp.max;
  if (totalMax <= 10) {
    if (opp.minExcl === 0 && my.minExcl > 0) score += 150;
    if (opp.min > my.min) score += (opp.min - my.min) * 40;
  }

  // Penalizar demasiadas obrigações sem controlo
  if (my.maxExcl <= opp.max) score -= my.min * 10;

  const effOpp = opp.min > 0 ? opp.max / opp.min : 0;
  const effMy = my.min > 0 ? my.max / my.min : 0;
  score += (effMy - effOpp) * 10;

  return score;
}

function hashStringToU32(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function makeRng(seed: number): () => number {
  let x = seed | 0;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 0x100000000;
  };
}

function cheapMoveScore(occ: Occ, m: EncMove, side: 0 | 1): number {
  const opp = (1 - side) as 0 | 1;
  const next = applyMove(occ, m);
  const oppMoves = generateMovesDynamic(next, opp);
  if (oppMoves.length === 0) return -1e9;

  const s = evaluateMisere(next, opp); // perspectiva do adversário a jogar
  return -s;
}

function rolloutWinForRoot(occAfterRoot: Occ, sideRoot: 0 | 1, rng: () => number, maxPlies = 120): boolean {
  let occ = occAfterRoot;
  let side: 0 | 1 = (1 - sideRoot) as 0 | 1;

  for (let ply = 0; ply < maxPlies; ply++) {
    const moves = generateMovesDynamic(occ, side);
    if (moves.length === 0) {
      // sem jogadas => side ganha (misère)
      return side !== sideRoot;
    }
    const mv = moves[Math.floor(rng() * moves.length)]!;
    occ = applyMove(occ, mv);
    side = (1 - side) as 0 | 1;
  }

  // fallback por avaliação
  const evalSide = evaluateMisere(occ, side);
  return side === sideRoot ? evalSide >= 0 : evalSide < 0;
}

export interface SearchParams {
  timeBudgetMs: number;
  maxDepth: number;
  topN: number;
  scoreDelta: number;
}

export interface SearchResult {
  bestMove: Segmento | null;
  depthReached: number;
  nodesSearched: number;
  elapsedMs: number;
  ttHitRate: number;
  score: number;
  fromBook: boolean;
}

type TTFlag = 0 | 1 | 2; // exact, lower, upper
type TTEntry = { depth: number; score: number; flag: TTFlag; bestMove: EncMove | -1; age: number };

const TT_MAX_ENTRIES = 220_000;
const tt = new Map<bigint, TTEntry>();
let ttAge = 0;

function ttKey(occ: Occ, side: 0 | 1): bigint {
  return (occ.high << 64n) | occ.low | (BigInt(side) << 127n);
}

function probeTT(
  key: bigint,
  depth: number,
  alpha: number,
  beta: number,
  stats: SearchStats
): { hit: boolean; score?: number; best?: EncMove | -1 } {
  stats.ttProbes++;
  const e = tt.get(key);
  if (!e) return { hit: false };
  stats.ttHits++;
  e.age = ttAge;
  if (e.depth < depth) return { hit: false, best: e.bestMove };
  if (e.flag === 0) return { hit: true, score: e.score, best: e.bestMove };
  if (e.flag === 1 && e.score >= beta) return { hit: true, score: e.score, best: e.bestMove };
  if (e.flag === 2 && e.score <= alpha) return { hit: true, score: e.score, best: e.bestMove };
  return { hit: false, best: e.bestMove };
}

function storeTT(key: bigint, entry: TTEntry): void {
  if (tt.size >= TT_MAX_ENTRIES) {
    // purga simples: limpar tudo (rápido e previsível)
    tt.clear();
  }
  tt.set(key, entry);
}

type SearchStats = {
  nodes: number;
  ttProbes: number;
  ttHits: number;
  deadline: number;
};

const killerMoves: Array<[EncMove | -1, EncMove | -1]> = [];
const history = new Map<number, number>();

function orderMoves(
  occ: Occ,
  side: 0 | 1,
  depth: number,
  moves: EncMove[],
  ttBest: EncMove | -1 | undefined
): EncMove[] {
  const scored = moves.map(m => {
    let p = 0;
    if (ttBest !== undefined && ttBest !== -1 && m === ttBest) p += 1000000;

    const killers = killerMoves[depth];
    if (killers) {
      if (killers[0] === m) p += 600000;
      else if (killers[1] === m) p += 450000;
    }

    p += history.get(m) || 0;

    // barato: encorajar lances curtos e "seguros"
    const { len } = decMove(m);
    p -= len * 10;

    // no topo, gastar um pouco mais
    if (depth >= 6) {
      p += cheapMoveScore(occ, m, side) * 0.1;
    }

    return { m, p };
  });

  scored.sort((a, b) => b.p - a.p);
  return scored.map(s => s.m);
}

function negamax(
  occ: Occ,
  side: 0 | 1,
  depth: number,
  alpha: number,
  beta: number,
  stats: SearchStats
): { score: number; bestMove: EncMove | -1 } {
  stats.nodes++;
  if ((stats.nodes & 2047) === 0 && Date.now() >= stats.deadline) {
    return { score: 0, bestMove: -1 };
  }

  const key = ttKey(occ, side);
  const ttRes = probeTT(key, depth, alpha, beta, stats);
  if (ttRes.hit) return { score: ttRes.score!, bestMove: ttRes.best ?? -1 };

  const moves = generateMovesDynamic(occ, side);
  if (moves.length === 0) {
    return { score: 100000 + depth, bestMove: -1 };
  }

  if (depth === 0) {
    return { score: evaluateMisere(occ, side), bestMove: -1 };
  }

  const ordered = orderMoves(occ, side, depth, moves, ttRes.best);
  const alphaOrig = alpha;
  let bestScore = -Infinity;
  let bestMove: EncMove | -1 = -1;

  // PVS
  let first = true;
  for (const m of ordered) {
    const child = applyMove(occ, m);
    const opp = (1 - side) as 0 | 1;

    let score: number;
    if (first) {
      score = -negamax(child, opp, depth - 1, -beta, -alpha, stats).score;
      first = false;
    } else {
      score = -negamax(child, opp, depth - 1, -alpha - 1, -alpha, stats).score;
      if (score > alpha && score < beta) {
        score = -negamax(child, opp, depth - 1, -beta, -alpha, stats).score;
      }
    }

    if (Date.now() >= stats.deadline) break;

    if (score > bestScore) {
      bestScore = score;
      bestMove = m;
    }

    if (score > alpha) alpha = score;
    if (alpha >= beta) {
      if (!killerMoves[depth]) killerMoves[depth] = [-1, -1];
      const [k1] = killerMoves[depth]!;
      if (k1 !== m) killerMoves[depth] = [m, k1];
      history.set(m, (history.get(m) || 0) + depth * depth * 200);
      break;
    }
  }

  let flag: TTFlag = 0;
  if (bestScore <= alphaOrig) flag = 2;
  else if (bestScore >= beta) flag = 1;
  else flag = 0;

  storeTT(key, { depth, score: bestScore, flag, bestMove, age: ttAge });
  return { score: bestScore, bestMove };
}

function monteCarloSeedHistoryRoot(
  occ: Occ,
  side: 0 | 1,
  timeBudgetMs: number,
  deadline: number
): void {
  const mcBudget = Math.floor(timeBudgetMs * 0.12);
  if (mcBudget < 60) return;

  const mcDeadline = Math.min(deadline, Date.now() + mcBudget);
  const moves = generateCandidateMoves(occ, side);
  if (moves.length <= 4) return;

  const scored = moves.map(m => ({ m, h: cheapMoveScore(occ, m, side) }));
  scored.sort((a, b) => b.h - a.h);

  const topN = Math.min(scored.length, Math.max(6, Math.min(12, Math.floor(scored.length * 0.4))));
  const top = scored.slice(0, topN);

  const seed = hashStringToU32(`${occ.low.toString(16)}:${occ.high.toString(16)}:${side}`);
  const rng = makeRng(seed);

  const wins = new Array(topN).fill(0);
  const sims = new Array(topN).fill(0);

  while (Date.now() < mcDeadline) {
    for (let i = 0; i < topN; i++) {
      if (Date.now() >= mcDeadline) break;
      const mv = top[i]!.m;
      const child = applyMove(occ, mv);
      const win = rolloutWinForRoot(child, side, rng);
      sims[i]++;
      if (win) wins[i]++;
    }
  }

  const ranked = top.map((t, i) => {
    const rate = (wins[i]! + 1) / (sims[i]! + 2);
    return { m: t.m, score: 1000 * rate + 0.001 * t.h };
  });
  ranked.sort((a, b) => b.score - a.score);

  for (let i = 0; i < ranked.length; i++) {
    const m = ranked[i]!.m;
    history.set(m, (history.get(m) || 0) + (ranked.length - i) * 4000);
  }
}

export function searchBestMove(
  tabuleiro: Celula[][],
  orientacaoIA: Orientacao,
  params: SearchParams
): SearchResult {
  const start = performance.now();
  const deadline = Date.now() + params.timeBudgetMs;

  const occ0 = boardToOcc(tabuleiro);
  const side: 0 | 1 = orientToBit(orientacaoIA);

  ttAge = (ttAge + 1) & 0xff;
  killerMoves.length = 0;
  history.clear();

  monteCarloSeedHistoryRoot(occ0, side, params.timeBudgetMs, deadline);

  const stats: SearchStats = { nodes: 0, ttHits: 0, ttProbes: 0, deadline };

  const INF = 1_000_000;
  let bestMove: EncMove | -1 = -1;
  let bestScore = -INF;
  let depthReached = 0;

  let window = 120;

  const rootMoves = generateMovesDynamic(occ0, side);
  if (rootMoves.length === 0) {
    return {
      bestMove: null,
      depthReached: 0,
      nodesSearched: 0,
      elapsedMs: performance.now() - start,
      ttHitRate: 0,
      score: -INF,
      fromBook: false,
    };
  }

  let rootOrdered = orderMoves(occ0, side, 1, rootMoves, undefined);

  for (let depth = 1; depth <= params.maxDepth; depth++) {
    if (Date.now() >= deadline) break;

    let alpha = depth === 1 ? -INF : bestScore - window;
    let beta = depth === 1 ? INF : bestScore + window;

    // manter PV move na frente ajuda bastante
    const ttRes = probeTT(ttKey(occ0, side), depth, -INF, INF, stats);
    rootOrdered = orderMoves(occ0, side, 1, rootOrdered, ttRes.best);

    let iterationBestMove: EncMove | -1 = rootOrdered[0] ?? -1;
    let iterationBestScore = -INF;

    const alphaOrig = alpha;

    // Root PVS (simples): primeiro em janela total, restantes nula
    let first = true;
    for (const m of rootOrdered) {
      const child = applyMove(occ0, m);
      const opp = (1 - side) as 0 | 1;

      let score: number;
      if (first) {
        score = -negamax(child, opp, depth - 1, -beta, -alpha, stats).score;
        first = false;
      } else {
        score = -negamax(child, opp, depth - 1, -alpha - 1, -alpha, stats).score;
        if (score > alpha && score < beta) {
          score = -negamax(child, opp, depth - 1, -beta, -alpha, stats).score;
        }
      }

      if (Date.now() >= deadline) break;

      if (score > iterationBestScore) {
        iterationBestScore = score;
        iterationBestMove = m;
      }
      if (score > alpha) alpha = score;
      if (alpha >= beta) break;
    }

    if (Date.now() >= deadline) break;

    // Se falhou janela, repetir com janela total
    if (depth > 1 && (iterationBestScore <= alphaOrig || iterationBestScore >= beta)) {
      window = Math.min(1200, window * 2);
      const full = negamax(occ0, side, depth, -INF, INF, stats);
      iterationBestScore = full.score;
      iterationBestMove = full.bestMove;
    } else if (depth > 1) {
      window = Math.max(60, Math.floor(window * 0.75));
    }

    if (iterationBestMove !== -1) {
      bestMove = iterationBestMove;
      bestScore = iterationBestScore;
      depthReached = depth;

      // PV ordering: mover melhor lance para a frente
      const idx = rootOrdered.indexOf(iterationBestMove);
      if (idx > 0) {
        rootOrdered = [iterationBestMove, ...rootOrdered.slice(0, idx), ...rootOrdered.slice(idx + 1)];
      }
    }
  }

  // Randomização para dificuldades mais baixas (como no Dominório)
  if (params.topN > 0 && rootOrdered.length > 1) {
    const candidates = rootOrdered
      .slice(0, params.topN)
      .map(m => ({ m, score: cheapMoveScore(occ0, m, side) }));
    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0]!;
    const close = candidates.filter(c => best.score - c.score <= params.scoreDelta);
    if (close.length > 1) {
      const seed = hashStringToU32(`${occ0.low.toString(16)}:${occ0.high.toString(16)}:${side}:rnd`);
      const rng = makeRng(seed);
      bestMove = close[Math.floor(rng() * close.length)]!.m;
    }
  }

  const ttHitRate = stats.ttProbes > 0 ? stats.ttHits / stats.ttProbes : 0;

  return {
    bestMove: bestMove === -1 ? null : moveToSegmento(bestMove),
    depthReached,
    nodesSearched: stats.nodes,
    elapsedMs: performance.now() - start,
    ttHitRate,
    score: bestScore,
    fromBook: false,
  };
}
