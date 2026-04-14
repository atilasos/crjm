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

export function isAdminAuthorized(authHeader: string | null, adminKey: string): boolean {
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
