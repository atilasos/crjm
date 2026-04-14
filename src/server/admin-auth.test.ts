import { describe, expect, test } from 'bun:test';
import { adminChallengeHeaders, adminSessionCookie, isAdminAuthorized } from './admin-auth';

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

  test('accepts signed admin cookie', () => {
    const cookie = adminSessionCookie('secret123').split(';')[0];
    expect(isAdminAuthorized(null, 'secret123', cookie)).toBe(true);
  });

  test('adds basic auth challenge header', () => {
    expect(adminChallengeHeaders({ 'X-Test': '1' })).toEqual({
      'WWW-Authenticate': 'Basic realm="CRJM Admin"',
      'X-Test': '1',
    });
  });

  test('marks admin cookie secure in production', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    expect(adminSessionCookie('secret123')).toContain('Secure');
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });
});
