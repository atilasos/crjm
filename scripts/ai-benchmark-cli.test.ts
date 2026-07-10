import { describe, expect, test } from 'bun:test';
import { readOptionalArg } from './ai-benchmark-cli';

describe('AI benchmark CLI parsing', () => {
  test('não confunde argv[0] com output quando a flag não existe', () => {
    expect(readOptionalArg(['/usr/local/bin/bun', 'script.ts'], '--output')).toBeUndefined();
  });

  test('lê apenas o valor que segue a flag', () => {
    expect(readOptionalArg(['bun', 'script.ts', '--output', 'report.json'], '--output')).toBe('report.json');
    expect(readOptionalArg(['bun', 'script.ts', '--output', '--profile'], '--output')).toBeUndefined();
  });
});
