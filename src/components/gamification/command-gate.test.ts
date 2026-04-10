import { describe, expect, test } from 'bun:test';
import { createCommandGate } from './command-gate';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

describe('command gate', () => {
  test('waits for bootstrap before running commands', async () => {
    const gate = createCommandGate();
    const boot = deferred();
    const steps: string[] = [];

    gate.setBootstrap(boot.promise.then(() => steps.push('bootstrap')));

    const command = gate.run(async () => {
      steps.push('command');
      return 'done';
    });

    await Promise.resolve();
    expect(steps).toEqual([]);

    boot.resolve();
    await expect(command).resolves.toBe('done');
    expect(steps).toEqual(['bootstrap', 'command']);
  });

  test('serializes commands even when one finishes later', async () => {
    const gate = createCommandGate();
    gate.setBootstrap(Promise.resolve());

    const first = deferred();
    const steps: string[] = [];

    const firstRun = gate.run(async () => {
      steps.push('first:start');
      await first.promise;
      steps.push('first:end');
      return 'first';
    });

    const secondRun = gate.run(async () => {
      steps.push('second');
      return 'second';
    });

    first.resolve();
    await expect(firstRun).resolves.toBe('first');
    await expect(secondRun).resolves.toBe('second');
    expect(steps).toEqual(['first:start', 'first:end', 'second']);
  });

  test('continues after a rejected command', async () => {
    const gate = createCommandGate();
    gate.setBootstrap(Promise.resolve());
    const steps: string[] = [];

    await expect(
      gate.run(async () => {
        steps.push('fail');
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    await expect(
      gate.run(async () => {
        steps.push('next');
        return 'ok';
      }),
    ).resolves.toBe('ok');

    expect(steps).toEqual(['fail', 'next']);
  });
});
