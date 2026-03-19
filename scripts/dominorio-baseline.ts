import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { DifficultyLevel, AIResponseV1 } from '../src/ai-core';
import { DIFFICULTY_PROFILES } from '../src/ai-core';
import { DominorioV1Adapter } from '../src/games/dominorio/ai';
import { buildQuickReviewItems } from '../src/games/dominorio/ai/pedagogy-mvp';
import { criarEstadoInicial, isJogadaValida, colocarDomino } from '../src/games/dominorio/logic';
import type { DominorioState, Domino } from '../src/games/dominorio/types';

const LEVELS: DifficultyLevel[] = [1, 2, 3, 4, 5];
const LADDER: Array<[DifficultyLevel, DifficultyLevel]> = [
  [2, 1],
  [3, 2],
  [4, 3],
  [5, 4],
];
const ACTION_VERBS = ['prioriza', 'fecha', 'mantém', 'joga', 'protege', 'foca', 'tenta'];
const REASON_KEYWORDS = ['ameaça', 'paridade', 'corredor', 'mobilidade', 'final', 'espaço', 'zona'];

interface HarnessOptions {
  gamesPerMirror: number;
  t4ProbeEveryPly: number;
  maxPliesPerGame: number;
  budgetScale: number;
}

interface DecisionSample {
  level: DifficultyLevel;
  elapsedMs: number;
  legal: boolean;
  explainText: string;
  bestMoveExists: boolean;
  p1: boolean;
  p5: boolean;
  p7: boolean;
}

interface T4Probe {
  ply: number;
  level: DifficultyLevel;
  sameMove: boolean;
  primaryEngine: string;
  repeatEngine: string;
}

interface GameRun {
  gameId: string;
  strongerLevel: DifficultyLevel;
  weakerLevel: DifficultyLevel;
  strongerAs: 'jogador1' | 'jogador2';
  winner: 'stronger' | 'weaker' | 'draw-timeout';
  plies: number;
  decisions: DecisionSample[];
  t4Probes: T4Probe[];
  p6Passed: boolean;
}

interface LadderSummary {
  strongerLevel: DifficultyLevel;
  weakerLevel: DifficultyLevel;
  games: number;
  strongerWins: number;
  weakerWins: number;
  draws: number;
  strongerWinrate: number;
  strongerWinrateWhenStarts: number;
  strongerWinrateWhenSecond: number;
  t1Pass: boolean;
}

interface PercentileStats {
  p50: number;
  p95: number;
  budgetMs: number;
  t2Pass: boolean;
}

interface BaselineResult {
  generatedAt: string;
  options: HarnessOptions;
  definitions: {
    technical: Record<'T1' | 'T2' | 'T3' | 'T4', string>;
    pedagogical: Record<'P1' | 'P5' | 'P6' | 'P7', string>;
  };
  totals: {
    games: number;
    decisions: number;
  };
  ladder: LadderSummary[];
  t2ByLevel: Record<DifficultyLevel, PercentileStats>;
  t3: {
    invalidMoves: number;
    totalDecisions: number;
    invalidRate: number;
    t3Pass: boolean;
  };
  t4: {
    mode: 'ts-repeatability-proxy';
    notes: string;
    probes: number;
    divergences: number;
    divergenceRate: number;
    t4Pass: boolean;
  };
  pedagogy: {
    p1Rate: number;
    p5Rate: number;
    p6Rate: number;
    p7Rate: number;
    p1Pass: boolean;
    p5Pass: boolean;
    p6Pass: boolean;
    p7Pass: boolean;
  };
  gameRuns: GameRun[];
}

function parseOptions(): HarnessOptions {
  const gamesPerMirror = Number(process.env.DOMINORIO_GAMES_PER_MIRROR ?? 8);
  const t4ProbeEveryPly = Number(process.env.DOMINORIO_T4_PROBE_EVERY_PLY ?? 6);
  const maxPliesPerGame = Number(process.env.DOMINORIO_MAX_PLIES ?? 64);
  const budgetScale = Number(process.env.DOMINORIO_BUDGET_SCALE ?? 1);

  return {
    gamesPerMirror: Number.isFinite(gamesPerMirror) && gamesPerMirror > 0 ? Math.trunc(gamesPerMirror) : 8,
    t4ProbeEveryPly:
      Number.isFinite(t4ProbeEveryPly) && t4ProbeEveryPly > 0 ? Math.trunc(t4ProbeEveryPly) : 6,
    maxPliesPerGame: Number.isFinite(maxPliesPerGame) && maxPliesPerGame > 0 ? Math.trunc(maxPliesPerGame) : 64,
    budgetScale: Number.isFinite(budgetScale) && budgetScale > 0 ? budgetScale : 1,
  };
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return Number(sorted[idx].toFixed(2));
}

function hasActionableVerb(text: string): boolean {
  const lower = text.toLowerCase();
  return ACTION_VERBS.some((verb) => lower.includes(verb));
}

function hasReasonKeyword(text: string): boolean {
  const lower = text.toLowerCase();
  return REASON_KEYWORDS.some((keyword) => lower.includes(keyword));
}

function winnerForPerspective(
  state: DominorioState,
  strongerAs: 'jogador1' | 'jogador2',
): 'stronger' | 'weaker' {
  const strongerWon =
    (state.estado === 'vitoria-jogador1' && strongerAs === 'jogador1') ||
    (state.estado === 'vitoria-jogador2' && strongerAs === 'jogador2');
  return strongerWon ? 'stronger' : 'weaker';
}

function moveEquals(a: Domino | null, b: Domino | null): boolean {
  if (!a || !b) return a === b;

  const a1 = `${a.pos1.linha}:${a.pos1.coluna}`;
  const a2 = `${a.pos2.linha}:${a.pos2.coluna}`;
  const b1 = `${b.pos1.linha}:${b.pos1.coluna}`;
  const b2 = `${b.pos2.linha}:${b.pos2.coluna}`;

  return (a1 === b1 && a2 === b2) || (a1 === b2 && a2 === b1);
}

function toCsv(result: BaselineResult): string {
  const lines: string[] = [];
  lines.push('section,metric,key,value');

  for (const row of result.ladder) {
    lines.push(`T1,stronger_winrate,N${row.strongerLevel}_vs_N${row.weakerLevel},${row.strongerWinrate}`);
    lines.push(`T1,stronger_winrate_starts,N${row.strongerLevel}_vs_N${row.weakerLevel},${row.strongerWinrateWhenStarts}`);
    lines.push(`T1,stronger_winrate_second,N${row.strongerLevel}_vs_N${row.weakerLevel},${row.strongerWinrateWhenSecond}`);
    lines.push(`T1,pass,N${row.strongerLevel}_vs_N${row.weakerLevel},${row.t1Pass}`);
  }

  for (const level of LEVELS) {
    const t2 = result.t2ByLevel[level];
    lines.push(`T2,p50_ms,N${level},${t2.p50}`);
    lines.push(`T2,p95_ms,N${level},${t2.p95}`);
    lines.push(`T2,budget_ms,N${level},${t2.budgetMs}`);
    lines.push(`T2,pass,N${level},${t2.t2Pass}`);
  }

  lines.push(`T3,invalid_rate,global,${result.t3.invalidRate}`);
  lines.push(`T3,pass,global,${result.t3.t3Pass}`);
  lines.push(`T4,divergence_rate,global,${result.t4.divergenceRate}`);
  lines.push(`T4,pass,global,${result.t4.t4Pass}`);

  lines.push(`P,p1_rate,global,${result.pedagogy.p1Rate}`);
  lines.push(`P,p5_rate,global,${result.pedagogy.p5Rate}`);
  lines.push(`P,p6_rate,global,${result.pedagogy.p6Rate}`);
  lines.push(`P,p7_rate,global,${result.pedagogy.p7Rate}`);
  lines.push(`P,p1_pass,global,${result.pedagogy.p1Pass}`);
  lines.push(`P,p5_pass,global,${result.pedagogy.p5Pass}`);
  lines.push(`P,p6_pass,global,${result.pedagogy.p6Pass}`);
  lines.push(`P,p7_pass,global,${result.pedagogy.p7Pass}`);

  return `${lines.join('\n')}\n`;
}

function toMarkdown(result: BaselineResult): string {
  const lines: string[] = [];
  lines.push('# Dominorio F1.4 Baseline (AI vs AI)');
  lines.push('');
  lines.push(`- Generated at: ${result.generatedAt}`);
  lines.push(`- Games: ${result.totals.games}`);
  lines.push(`- Decisions: ${result.totals.decisions}`);
  lines.push(`- Harness mode: ${result.t4.mode}`);
  lines.push('');
  lines.push('## Technical Metrics');
  lines.push('');
  lines.push('| Metric | Value | Target | Status |');
  lines.push('| --- | ---: | --- | --- |');

  for (const row of result.ladder) {
    lines.push(
      `| T1 N${row.strongerLevel} vs N${row.weakerLevel} | ${(row.strongerWinrate * 100).toFixed(1)}% | >= 60% | ${row.t1Pass ? 'PASS' : 'FAIL'} |`,
    );
  }

  for (const level of LEVELS) {
    const t2 = result.t2ByLevel[level];
    lines.push(
      `| T2 N${level} p50/p95 | ${t2.p50.toFixed(1)}ms / ${t2.p95.toFixed(1)}ms | p50 <= ${t2.budgetMs}ms; p95 <= 2x p50 | ${t2.t2Pass ? 'PASS' : 'FAIL'} |`,
    );
  }

  lines.push(
    `| T3 legalidade | ${(1 - result.t3.invalidRate) * 100}% legal | 100% legal | ${result.t3.t3Pass ? 'PASS' : 'FAIL'} |`,
  );
  lines.push(
    `| T4 estabilidade | ${(result.t4.divergenceRate * 100).toFixed(2)}% divergência | <= 5% | ${result.t4.t4Pass ? 'PASS' : 'FAIL'} |`,
  );
  lines.push('');
  lines.push('## Pedagogical Proxies');
  lines.push('');
  lines.push('| Metric | Value | Target | Status |');
  lines.push('| --- | ---: | --- | --- |');
  lines.push(
    `| P1 (feedback curto + acionável) | ${(result.pedagogy.p1Rate * 100).toFixed(1)}% | >= 90% | ${result.pedagogy.p1Pass ? 'PASS' : 'FAIL'} |`,
  );
  lines.push(
    `| P5 (transparência mínima) | ${(result.pedagogy.p5Rate * 100).toFixed(1)}% | >= 85% | ${result.pedagogy.p5Pass ? 'PASS' : 'FAIL'} |`,
  );
  lines.push(
    `| P6 (turning points 1-3) | ${(result.pedagogy.p6Rate * 100).toFixed(1)}% | >= 90% | ${result.pedagogy.p6Pass ? 'PASS' : 'FAIL'} |`,
  );
  lines.push(
    `| P7 (próximo passo claro) | ${(result.pedagogy.p7Rate * 100).toFixed(1)}% | >= 90% | ${result.pedagogy.p7Pass ? 'PASS' : 'FAIL'} |`,
  );
  lines.push('');
  lines.push('## Notes');
  lines.push('');
  lines.push(`- T4 proxy note: ${result.t4.notes}`);

  return `${lines.join('\n')}\n`;
}

function buildRequest(
  state: DominorioState,
  level: DifficultyLevel,
  requestId: string,
  options: HarnessOptions,
): {
  version: '1.0';
  requestId: string;
  gameId: 'dominorio';
  mode: 'tutor';
  level: DifficultyLevel;
  state: DominorioState;
  timeBudgetMs: number;
  locale: 'pt-PT';
} {
  return {
    version: '1.0',
    requestId,
    gameId: 'dominorio',
    mode: 'tutor',
    level,
    state,
    timeBudgetMs: Math.max(1, Math.round(DIFFICULTY_PROFILES[level].timeBudgetMs * options.budgetScale)),
    locale: 'pt-PT',
  };
}

async function runGame(
  adapter: DominorioV1Adapter,
  strongerLevel: DifficultyLevel,
  weakerLevel: DifficultyLevel,
  strongerAs: 'jogador1' | 'jogador2',
  gameId: string,
  options: HarnessOptions,
): Promise<GameRun> {
  let state = criarEstadoInicial('dois-jogadores');
  const decisions: DecisionSample[] = [];
  const t4Probes: T4Probe[] = [];
  const history: Array<AIResponseV1<Domino, DominorioState>> = [];
  let ply = 0;

  while (state.estado === 'a-jogar' && ply < options.maxPliesPerGame) {
    const isJogador1Turn = state.jogadorAtual === 'jogador1';
    const level =
      (isJogador1Turn && strongerAs === 'jogador1') || (!isJogador1Turn && strongerAs === 'jogador2')
        ? strongerLevel
        : weakerLevel;

    const requestId = `dom-f14-${gameId}-p${ply}`;
    const request = buildRequest(state, level, requestId, options);

    const response = await adapter.compute(request);
    history.push(response);

    const bestMove = response.bestMove;
    const legal = bestMove ? isJogadaValida(state, bestMove) : state.jogadasValidas.length === 0;

    const p1 = response.explainText.length > 0 && response.explainText.length <= 160 && hasActionableVerb(response.explainText);
    const p5 = hasReasonKeyword(response.explainText);
    const p7 = Boolean(bestMove && response.topMoves.length > 0 && response.explainText.length > 0);

    decisions.push({
      level,
      elapsedMs: response.stats.elapsedMs,
      legal,
      explainText: response.explainText,
      bestMoveExists: bestMove !== null,
      p1,
      p5,
      p7,
    });

    if (options.t4ProbeEveryPly > 0 && ply % options.t4ProbeEveryPly === 0) {
      const repeated = await adapter.compute(buildRequest(state, level, `-repeat`, options));
      t4Probes.push({
        ply,
        level,
        sameMove: moveEquals(response.bestMove, repeated.bestMove),
        primaryEngine: response.stats.engine,
        repeatEngine: repeated.stats.engine,
      });
    }

    if (!legal) {
      break;
    }

    if (!bestMove) {
      break;
    }

    state = colocarDomino(state, bestMove);
    ply += 1;
  }

  const reviewItems = buildQuickReviewItems(history);
  const p6Passed = reviewItems.length >= 1 && reviewItems.length <= 3;

  const winner =
    state.estado === 'a-jogar'
      ? 'draw-timeout'
      : winnerForPerspective(state, strongerAs);

  return {
    gameId,
    strongerLevel,
    weakerLevel,
    strongerAs,
    winner,
    plies: ply,
    decisions,
    t4Probes,
    p6Passed,
  };
}

function summarize(results: GameRun[], options: HarnessOptions): BaselineResult {
  const ladder: LadderSummary[] = [];
  const elapsedByLevel: Record<DifficultyLevel, number[]> = {
    1: [],
    2: [],
    3: [],
    4: [],
    5: [],
  };

  let invalidMoves = 0;
  let totalDecisions = 0;
  let p1Ok = 0;
  let p5Ok = 0;
  let p7Ok = 0;
  let p6Ok = 0;
  let t4Probes = 0;
  let t4Divergences = 0;

  for (const run of results) {
    if (run.p6Passed) p6Ok += 1;

    for (const probe of run.t4Probes) {
      t4Probes += 1;
      if (!probe.sameMove) t4Divergences += 1;
    }

    for (const d of run.decisions) {
      totalDecisions += 1;
      elapsedByLevel[d.level].push(d.elapsedMs);
      if (!d.legal) invalidMoves += 1;
      if (d.p1) p1Ok += 1;
      if (d.p5) p5Ok += 1;
      if (d.p7) p7Ok += 1;
    }
  }

  for (const [strongerLevel, weakerLevel] of LADDER) {
    const subset = results.filter(
      (r) => r.strongerLevel === strongerLevel && r.weakerLevel === weakerLevel,
    );

    const strongerWins = subset.filter((r) => r.winner === 'stronger').length;
    const weakerWins = subset.filter((r) => r.winner === 'weaker').length;
    const draws = subset.filter((r) => r.winner === 'draw-timeout').length;

    const strongerStarts = subset.filter((r) => r.strongerAs === 'jogador1');
    const strongerSeconds = subset.filter((r) => r.strongerAs === 'jogador2');

    const strongerWinrate = subset.length === 0 ? 0 : strongerWins / subset.length;
    const strongerWinrateWhenStarts =
      strongerStarts.length === 0
        ? 0
        : strongerStarts.filter((r) => r.winner === 'stronger').length / strongerStarts.length;
    const strongerWinrateWhenSecond =
      strongerSeconds.length === 0
        ? 0
        : strongerSeconds.filter((r) => r.winner === 'stronger').length / strongerSeconds.length;

    ladder.push({
      strongerLevel,
      weakerLevel,
      games: subset.length,
      strongerWins,
      weakerWins,
      draws,
      strongerWinrate: Number(strongerWinrate.toFixed(4)),
      strongerWinrateWhenStarts: Number(strongerWinrateWhenStarts.toFixed(4)),
      strongerWinrateWhenSecond: Number(strongerWinrateWhenSecond.toFixed(4)),
      t1Pass: strongerWinrate >= 0.6,
    });
  }

  const t2ByLevel = {
    1: summarizeT2(1, elapsedByLevel[1]),
    2: summarizeT2(2, elapsedByLevel[2]),
    3: summarizeT2(3, elapsedByLevel[3]),
    4: summarizeT2(4, elapsedByLevel[4]),
    5: summarizeT2(5, elapsedByLevel[5]),
  } as Record<DifficultyLevel, PercentileStats>;

  const invalidRate = totalDecisions === 0 ? 0 : invalidMoves / totalDecisions;
  const divergenceRate = t4Probes === 0 ? 0 : t4Divergences / t4Probes;

  const p1Rate = totalDecisions === 0 ? 0 : p1Ok / totalDecisions;
  const p5Rate = totalDecisions === 0 ? 0 : p5Ok / totalDecisions;
  const p6Rate = results.length === 0 ? 0 : p6Ok / results.length;
  const p7Rate = totalDecisions === 0 ? 0 : p7Ok / totalDecisions;

  return {
    generatedAt: new Date().toISOString(),
    options,
    definitions: {
      technical: {
        T1: 'Winrate espelhado em ladder N+1 vs N, com forte a jogar primeiro e segundo; target >= 60%.',
        T2: 'Tempo por decisão por nível em p50/p95; target p50 <= budget N e p95 <= 2x p50.',
        T3: 'Taxa de legalidade da jogada escolhida (isJogadaValida); target 0% inválidas.',
        T4: 'Proxy de estabilidade (TS vs TS repetido): mesma posição + mesmo nível + dois pedidos consecutivos; target divergência <= 5%.',
      },
      pedagogical: {
        P1: 'Feedback curto e acionável: explainText <= 160 chars e com verbo de ação.',
        P5: 'Transparência mínima: explainText contém marcador de causa (ameaça/paridade/corredor/mobilidade/final/espaço/zona).',
        P6: 'Turning points proxy: buildQuickReviewItems(history) retorna 1..3 itens.',
        P7: 'Próximo passo claro proxy: bestMove presente + topMoves não vazio + explainText não vazio.',
      },
    },
    totals: {
      games: results.length,
      decisions: totalDecisions,
    },
    ladder,
    t2ByLevel,
    t3: {
      invalidMoves,
      totalDecisions,
      invalidRate: Number(invalidRate.toFixed(4)),
      t3Pass: invalidMoves === 0,
    },
    t4: {
      mode: 'ts-repeatability-proxy',
      notes:
        'WASM ainda não está ativo no adapter V1 do piloto; T4 mede divergência em repetição TS para manter cobertura até ativação WASM.',
      probes: t4Probes,
      divergences: t4Divergences,
      divergenceRate: Number(divergenceRate.toFixed(4)),
      t4Pass: divergenceRate <= 0.05,
    },
    pedagogy: {
      p1Rate: Number(p1Rate.toFixed(4)),
      p5Rate: Number(p5Rate.toFixed(4)),
      p6Rate: Number(p6Rate.toFixed(4)),
      p7Rate: Number(p7Rate.toFixed(4)),
      p1Pass: p1Rate >= 0.9,
      p5Pass: p5Rate >= 0.85,
      p6Pass: p6Rate >= 0.9,
      p7Pass: p7Rate >= 0.9,
    },
    gameRuns: results,
  };
}

function summarizeT2(level: DifficultyLevel, samples: number[]): PercentileStats {
  const p50 = percentile(samples, 0.5);
  const p95 = percentile(samples, 0.95);
  const budgetMs = DIFFICULTY_PROFILES[level].timeBudgetMs;
  const t2Pass = p50 <= budgetMs && p95 <= p50 * 2;

  return { p50, p95, budgetMs, t2Pass };
}

async function saveArtifacts(result: BaselineResult): Promise<void> {
  const stamp = result.generatedAt.replace(/[:]/g, '-').replace(/\..+$/, '');
  const outputDir = join(import.meta.dir, '..', 'artifacts', 'dominorio-baseline', stamp);
  const latestDir = join(import.meta.dir, '..', 'artifacts', 'dominorio-baseline', 'latest');

  await mkdir(outputDir, { recursive: true });
  await mkdir(latestDir, { recursive: true });

  const json = JSON.stringify(result, null, 2);
  const csv = toCsv(result);
  const md = toMarkdown(result);

  await writeFile(join(outputDir, 'baseline.json'), json, 'utf8');
  await writeFile(join(outputDir, 'baseline.csv'), csv, 'utf8');
  await writeFile(join(outputDir, 'baseline.md'), md, 'utf8');

  await writeFile(join(latestDir, 'baseline.json'), json, 'utf8');
  await writeFile(join(latestDir, 'baseline.csv'), csv, 'utf8');
  await writeFile(join(latestDir, 'baseline.md'), md, 'utf8');

  console.log(`[dominorio-baseline] artifacts written to ${outputDir}`);
  console.log(`[dominorio-baseline] latest snapshot updated at ${latestDir}`);
}

async function main(): Promise<void> {
  const options = parseOptions();
  console.log('[dominorio-baseline] starting', options);

  const adapter = new DominorioV1Adapter();
  const runs: GameRun[] = [];

  try {
    for (const [strongerLevel, weakerLevel] of LADDER) {
      for (let i = 0; i < options.gamesPerMirror; i += 1) {
        const gameA = `${strongerLevel}v${weakerLevel}-A-${i + 1}`;
        runs.push(
          await runGame(adapter, strongerLevel, weakerLevel, 'jogador1', gameA, options),
        );

        const gameB = `${strongerLevel}v${weakerLevel}-B-${i + 1}`;
        runs.push(
          await runGame(adapter, strongerLevel, weakerLevel, 'jogador2', gameB, options),
        );
      }
    }
  } finally {
    adapter.terminate();
  }

  const baseline = summarize(runs, options);
  await saveArtifacts(baseline);

  const t1Fails = baseline.ladder.filter((row) => !row.t1Pass).length;
  const t2Fails = LEVELS.filter((level) => !baseline.t2ByLevel[level].t2Pass).length;

  console.log(
    `[dominorio-baseline] done: games=${baseline.totals.games}, decisions=${baseline.totals.decisions}, t1Fails=${t1Fails}, t2Fails=${t2Fails}, t3Pass=${baseline.t3.t3Pass}, t4Pass=${baseline.t4.t4Pass}`,
  );
}

main().catch((error) => {
  console.error('[dominorio-baseline] fatal', error);
  process.exit(1);
});
