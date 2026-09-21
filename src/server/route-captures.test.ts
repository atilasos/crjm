import { describe, expect, test } from 'bun:test';
import assert from 'node:assert/strict';
import { requiredRouteCapture } from './route-captures';

describe('required route captures', () => {
  test('keeps encoded and Unicode route identifiers unchanged', () => {
    const match = '/api/classes/turma%2F1/students/João'.match(/^\/api\/classes\/([^/]+)\/students\/([^/]+)$/);
    assert.ok(match);
    expect(requiredRouteCapture(match, 1)).toBe('turma%2F1');
    expect(requiredRouteCapture(match, 2)).toBe('João');
  });

  test('keeps an empty capture distinct from an absent capture', () => {
    const match = ''.match(/^(.*)$/);
    assert.ok(match);
    expect(requiredRouteCapture(match, 1)).toBe('');
    expect(() => requiredRouteCapture(match, 2)).toThrow(TypeError);
  });

  test('rejects a capture omitted by an optional pattern group', () => {
    const match = '/api/classes'.match(/^\/api\/classes(?:\/([^/]+))?$/);
    assert.ok(match);
    expect(() => requiredRouteCapture(match, 1)).toThrow(TypeError);
  });
});
