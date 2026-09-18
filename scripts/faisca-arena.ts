import { mkdir } from 'node:fs/promises';
import { computeFaisca, FAISCA_DIFFICULTIES, type FaiscaLevel } from '../src/games/faisca/ai/engine';
import { criarEstadoInicial, colocarPeca, getJogadasValidas, isJogadaValida } from '../src/games/faisca/logic';

// Run on its own: time-budgeted arenas must never compete for CPU.
const seed = Number(process.env.SEED ?? 3002026);
const games = Number(process.env.GAMES ?? 50);
if (!Number.isInteger(games) || games < 50 || games % 2) throw new Error('Use an even number of games >= 50.');
let rng = seed >>> 0;
const random = () => { rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0; return rng / 4294967296; };
const results = [];
const latencies: Record<FaiscaLevel, number[]> = { 1: [], 2: [] };
for (let pair = 0; pair < games / 2; pair++) {
  const openings = getJogadasValidas(criarEstadoInicial());
  const opening = openings[Math.floor(random() * openings.length)]!;
  for (const firstLevel of [1, 2] as const) {
    let state = colocarPeca(criarEstadoInicial(), opening);
    let ply = 1;
    const moves = [opening];
    while (state.estado === 'a-jogar' && ply < 30) {
      const level = (state.jogadorAtual === 'jogador1' ? firstLevel : 3 - firstLevel) as FaiscaLevel;
      const response = computeFaisca({ version: '1.0', gameId: 'faisca', requestId: `${pair}-${firstLevel}-${ply}`,
        state, level, mode: 'competitive', seed: seed + pair * 100 + ply,
        timeBudgetMs: FAISCA_DIFFICULTIES[level].timeBudgetMs });
      if (!response.bestMove || !isJogadaValida(state, response.bestMove)) throw new Error(`Illegal move: ${response.requestId}`);
      latencies[level].push(response.stats.elapsedMs);
      moves.push(response.bestMove);
      state = colocarPeca(state, response.bestMove);
      ply++;
    }
    if (state.estado === 'a-jogar') throw new Error('Incomplete match');
    const winnerLevel = state.estado === 'vitoria-jogador1' ? firstLevel : 3 - firstLevel;
    results.push({ pair, firstLevel, opening, winner: state.estado, winnerLevel, moves });
  }
}
const latency = Object.fromEntries(([1, 2] as const).map(level => {
  const samples = latencies[level].sort((a, b) => a - b);
  return [level, { count: samples.length, p50: samples[Math.floor(samples.length * .5)],
    p95: samples[Math.floor(samples.length * .95)], max: samples.at(-1), samples }];
}));
const wins = { 1: results.filter(r => r.winnerLevel === 1).length, 2: results.filter(r => r.winnerLevel === 2).length };
const report = { date: new Date().toISOString(), seed, games, pairedOpenings: true, alternatingSides: true,
  runtime: `Bun ${Bun.version}`, budgetsMs: FAISCA_DIFFICULTIES, illegalMoves: 0, wins, latency, results };
await mkdir('artifacts/faisca-arena', { recursive: true });
await Bun.write(`artifacts/faisca-arena/seed-${seed}.json`, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ seed, games, wins, illegalMoves: 0, latency: Object.fromEntries(Object.entries(latency).map(([k, v]) => [k, { ...v, samples: undefined }])) }, null, 2));
