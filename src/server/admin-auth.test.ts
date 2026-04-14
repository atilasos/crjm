import { describe, expect, test } from 'bun:test';
import { adminChallengeHeaders, isAdminAuthorized } from './admin-auth';

describe('admin auth helpers', () => {
  test('accepts legacy bearer token access', () => {
    expect(isAdminAuthorized('Bearer secret123', 'secret123')).toBe(true);
  });

  test('accepts basic auth for admin user', () => {
    const token = Buffer.from('admin:secret123').toString('base64');
    expect(isAdminAuthorized(`Basic ${token}`, 'secret123')).toBe(true);
  });

  test('rejects invalid credentials', () => {
    const token = Buffer.from('teacher:secret123').toString('base64');
    expect(isAdminAuthorized(`Basic ${token}`, 'secret123')).toBe(false);
    expect(isAdminAuthorized(null, 'secret123')).toBe(false);
  });

  test('adds basic auth challenge header', () => {
    expect(adminChallengeHeaders({ 'X-Test': '1' })).toEqual({
      'WWW-Authenticate': 'Basic realm="CRJM Admin"',
      'X-Test': '1',
    });
  });
});
