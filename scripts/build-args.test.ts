import { expect, test } from 'bun:test';
import { parseBuildArgs } from './build-args';

test('build options preserve booleans, lists, numeric values and nested flags', () => {
  expect(parseBuildArgs(['--outdir=dist-test', '--no-splitting', '--minify.whitespace=true', '--external=react, react-dom', '--define.VERSION=1.2', '--skip-wasm'])).toEqual({
    outdir: 'dist-test', splitting: false, minify: { whitespace: true }, external: ['react', 'react-dom'], define: { VERSION: 1.2 }, skipWasm: true,
  });
});

test('space syntax, repeated options and embedded equals keep existing parsing', () => {
  expect(parseBuildArgs(['ignored', '--target', 'browser', '--target=node', '--banner=a=b', '--define.ONE=1', '--define.TWO=two'])).toEqual({
    target: 'node', banner: 'a', define: { ONE: 1, TWO: 'two' },
  });
});

test('nested options cannot be assigned to a scalar', () => {
  expect(() => parseBuildArgs(['--minify', '--minify.syntax=true'])).toThrow(TypeError);
});

test('Bun validates unsupported option values at the build boundary', async () => {
  const options = parseBuildArgs(['--target=invalid']);
  expect(() => Bun.build({ entrypoints: [import.meta.path], ...options })).toThrow();
});
