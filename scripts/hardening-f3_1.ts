import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

interface CheckResult {
  id: string;
  command: string;
  durationMs: number;
  status: 'pass' | 'fail';
  exitCode: number;
  stdoutTail: string;
  stderrTail: string;
}

interface DominorioBaselineDigest {
  generatedAt: string;
  games: number;
  decisions: number;
  t1: {
    failedPairs: string[];
    passAll: boolean;
  };
  t2: {
    failedLevels: number[];
    passAll: boolean;
  };
  t3Pass: boolean;
  t4Pass: boolean;
  pedagogy: {
    p1Pass: boolean;
    p5Pass: boolean;
    p6Pass: boolean;
    p7Pass: boolean;
  };
}

interface HardeningSummary {
  phase: 'F3.1';
  generatedAt: string;
  checks: CheckResult[];
  aggregate: {
    total: number;
    passed: number;
    failed: number;
    ok: boolean;
  };
  dominorioBaseline: DominorioBaselineDigest | null;
}

function tail(text: string, maxChars = 800): string {
  if (text.length <= maxChars) return text;
  return text.slice(text.length - maxChars);
}

function runCheck(
  id: string,
  command: string,
  args: string[],
  env: Record<string, string> = {},
): CheckResult {
  const started = Date.now();
  const result = spawnSync(command, args, {
    cwd: join(import.meta.dir, '..'),
    env: {
      ...process.env,
      ...env,
    },
    encoding: 'utf8',
  });
  const durationMs = Date.now() - started;
  const code = result.status ?? 1;

  return {
    id,
    command: [command, ...args].join(' '),
    durationMs,
    status: code === 0 ? 'pass' : 'fail',
    exitCode: code,
    stdoutTail: tail(result.stdout ?? ''),
    stderrTail: tail(result.stderr ?? ''),
  };
}

async function readDominorioBaselineDigest(): Promise<DominorioBaselineDigest | null> {
  const baselinePath = join(import.meta.dir, '..', 'artifacts', 'dominorio-baseline', 'latest', 'baseline.json');
  try {
    const raw = await readFile(baselinePath, 'utf8');
    const data = JSON.parse(raw) as {
      generatedAt: string;
      totals: { games: number; decisions: number };
      ladder: Array<{ strongerLevel: number; weakerLevel: number; t1Pass: boolean }>;
      t2ByLevel: Record<string, { t2Pass: boolean }>;
      t3: { t3Pass: boolean };
      t4: { t4Pass: boolean };
      pedagogy: { p1Pass: boolean; p5Pass: boolean; p6Pass: boolean; p7Pass: boolean };
    };

    const failedPairs = data.ladder
      .filter((row) => !row.t1Pass)
      .map((row) => `N${row.strongerLevel}>N${row.weakerLevel}`);

    const failedLevels = Object.entries(data.t2ByLevel)
      .filter(([, value]) => !value.t2Pass)
      .map(([level]) => Number(level))
      .sort((a, b) => a - b);

    return {
      generatedAt: data.generatedAt,
      games: data.totals.games,
      decisions: data.totals.decisions,
      t1: {
        failedPairs,
        passAll: failedPairs.length === 0,
      },
      t2: {
        failedLevels,
        passAll: failedLevels.length === 0,
      },
      t3Pass: data.t3.t3Pass,
      t4Pass: data.t4.t4Pass,
      pedagogy: {
        p1Pass: data.pedagogy.p1Pass,
        p5Pass: data.pedagogy.p5Pass,
        p6Pass: data.pedagogy.p6Pass,
        p7Pass: data.pedagogy.p7Pass,
      },
    };
  } catch {
    return null;
  }
}

async function writeSummary(summary: HardeningSummary): Promise<void> {
  const stamp = summary.generatedAt.replace(/[:]/g, '-').replace(/\..+$/, '');
  const outputDir = join(import.meta.dir, '..', 'artifacts', 'hardening', 'f3.1', stamp);
  const latestDir = join(import.meta.dir, '..', 'artifacts', 'hardening', 'f3.1', 'latest');

  await mkdir(outputDir, { recursive: true });
  await mkdir(latestDir, { recursive: true });

  const json = `${JSON.stringify(summary, null, 2)}\n`;
  await writeFile(join(outputDir, 'summary.json'), json, 'utf8');
  await writeFile(join(latestDir, 'summary.json'), json, 'utf8');
}

async function main(): Promise<void> {
  const checks: CheckResult[] = [];

  checks.push(runCheck('dominorio-v1-adapter-tests', 'bun', ['test', 'src/games/dominorio/ai/v1-adapter.test.ts']));
  checks.push(runCheck('atari-go-v1-adapter-tests', 'bun', ['test', 'src/games/atari-go/ai/v1-adapter.test.ts']));
  checks.push(
    runCheck('dominorio-baseline-lite', 'bun', ['run', 'baseline:dominorio'], {
      DOMINORIO_GAMES_PER_MIRROR: '1',
      DOMINORIO_BUDGET_SCALE: '0.05',
      DOMINORIO_T4_PROBE_EVERY_PLY: '12',
      DOMINORIO_MAX_PLIES: '32',
    }),
  );

  const passed = checks.filter((check) => check.status === 'pass').length;
  const failed = checks.length - passed;
  const dominorioBaseline = await readDominorioBaselineDigest();

  const summary: HardeningSummary = {
    phase: 'F3.1',
    generatedAt: new Date().toISOString(),
    checks,
    aggregate: {
      total: checks.length,
      passed,
      failed,
      ok: failed === 0,
    },
    dominorioBaseline,
  };

  await writeSummary(summary);
  console.log(JSON.stringify(summary, null, 2));

  if (!summary.aggregate.ok) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('[hardening-f3.1] fatal', error);
  process.exit(1);
});
