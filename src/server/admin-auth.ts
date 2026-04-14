import { createHmac, timingSafeEqual } from 'node:crypto';

const ADMIN_COOKIE_NAME = 'crjm_tournament_admin';

function decodeBasicAuthToken(encoded: string): { username: string; password: string } | null {
  try {
    const decoded = Buffer.from(encoded, 'base64').toString('utf8');
    const separator = decoded.indexOf(':');
    if (separator < 0) return null;

    return {
      username: decoded.slice(0, separator),
      password: decoded.slice(separator + 1),
    };
  } catch {
    return null;
  }
}

function signAdminCookie(adminKey: string): string {
  return createHmac('sha256', adminKey).update('crjm-admin-session').digest('base64url');
}

function parseCookies(header: string | null): Record<string, string> {
  if (!header) return {};
  return header.split(';').reduce<Record<string, string>>((acc, chunk) => {
    const [rawKey, ...rest] = chunk.trim().split('=');
    if (!rawKey || rest.length === 0) return acc;
    acc[rawKey] = decodeURIComponent(rest.join('='));
    return acc;
  }, {});
}

function hasValidAdminCookie(cookieHeader: string | null, adminKey: string): boolean {
  const cookies = parseCookies(cookieHeader);
  const cookie = cookies[ADMIN_COOKIE_NAME];
  if (!cookie) return false;

  const expected = signAdminCookie(adminKey);
  if (cookie.length !== expected.length) return false;

  return timingSafeEqual(Buffer.from(cookie), Buffer.from(expected));
}

export function isAdminAuthorized(authHeader: string | null, adminKey: string, cookieHeader?: string | null): boolean {
  if (hasValidAdminCookie(cookieHeader ?? null, adminKey)) {
    return true;
  }

  if (!authHeader) return false;

  if (authHeader === `Bearer ${adminKey}`) {
    return true;
  }

  if (!authHeader.startsWith('Basic ')) {
    return false;
  }

  const credentials = decodeBasicAuthToken(authHeader.slice(6));
  if (!credentials) return false;

  return credentials.username === 'admin' && credentials.password === adminKey;
}

export function adminChallengeHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
  return {
    'WWW-Authenticate': 'Basic realm="CRJM Admin"',
    ...extraHeaders,
  };
}

export function adminSessionCookie(adminKey: string): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${ADMIN_COOKIE_NAME}=${encodeURIComponent(signAdminCookie(adminKey))}; Path=/; HttpOnly; SameSite=Lax${secure}`;
}
