import { expect, test } from 'bun:test';
import { formatDateTime, formatDuration, formatNumber } from './format';

test('formats decimals and duration plurals for the chosen language', () => {
  expect(formatNumber(1.5, 'pt-PT')).toBe('1,5');
  expect(formatNumber(1.5, 'en')).toBe('1.5');
  expect(formatDuration(1000, 'pt-PT')).toBe('1 segundo');
  expect(formatDuration(2000, 'en')).toBe('2 seconds');
  expect(formatDuration(1000, 'ne')).toBe('1 सेकेन्ड');
});
test('Nepali uses the same 0–9 digits as the school boards', () => {
  expect(formatNumber(123, 'ne', { useGrouping: false })).toBe('123');
  expect(formatDateTime(new Date('2026-09-15T12:00:00Z'), 'ne', { year: 'numeric', timeZone: 'UTC' })).toBe('2026');
});
