import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

describe('atari-go-ladder-baseline script', () => {
  test('generates JSON summary with N-C2/N-C3 consistency fields', async () => {
    const repoRoot = join(import.meta.dir, '..');
    const run = spawnSync('bun', ['run', 'baseline:atari-go'], {
      cwd: repoRoot,
      env: {
        ...process.env,
        ATARIGO_GAMES_PER_MIRROR: '1',
        ATARIGO_MAX_PLIES: '8',
        ATARIGO_BUDGET_SCALE: '0.05',
      },
      encoding: 'utf8',
    });

    expect(run.status).toBe(0);

    const latestPath = join(repoRoot, 'artifacts', 'atari-go-baseline', 'latest', 'baseline.json');
    const raw = await readFile(latestPath, 'utf8');
    const baseline = JSON.parse(raw) as {
      ladder: Array<{ strongerLevel: number; weakerLevel: number; t1Pass: boolean }>;
      t2ByLevel: Record<string, { p50: number; t2Pass: boolean }>;
      nC2: { failedPairs: string[]; passAll: boolean };
      nC3: {
        failedLevels: number[];
        monotonicSteps: Array<{ fromLevel: number; toLevel: number; pass: boolean }>;
        monotonicPassCount: number;
        monotonicPassRequired: number;
        passAll: boolean;
      };
      totals: { games: number; decisions: number };
    };

    expect(baseline.totals.games).toBe(8);
    expect(baseline.totals.decisions).toBeGreaterThan(0);
    expect(baseline.ladder.length).toBe(4);
    expect(Object.keys(baseline.t2ByLevel)).toEqual(['1', '2', '3', '4', '5']);

    expect(Array.isArray(baseline.nC2.failedPairs)).toBeTrue();
    expect(typeof baseline.nC2.passAll).toBe('boolean');

    expect(Array.isArray(baseline.nC3.failedLevels)).toBeTrue();
    expect(baseline.nC3.monotonicSteps.length).toBe(4);
    expect(baseline.nC3.monotonicPassCount).toBeLessThanOrEqual(4);
    expect(baseline.nC3.monotonicPassRequired).toBe(3);
    expect(typeof baseline.nC3.passAll).toBe('boolean');

    const firstLadderPair = baseline.ladder[0];
    expect(firstLadderPair.strongerLevel).toBe(2);
    expect(firstLadderPair.weakerLevel).toBe(1);
    }, 30000);
});
