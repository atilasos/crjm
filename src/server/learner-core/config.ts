export interface LearnerCoreConfig {
  dbPath: string;
  sessionCookieName: string;
  sessionCookieMaxAgeSeconds: number;
  sessionSecret: string;
}

export function getLearnerCoreConfig(env: NodeJS.ProcessEnv = process.env): LearnerCoreConfig {
  const dbPath = env.CRJM_LEARNER_DB_PATH || '.data/learner-core-v1.sqlite';
  const sessionCookieName = env.CRJM_SESSION_COOKIE_NAME || 'crjm_session';
  const sessionCookieMaxAgeSeconds = Number.parseInt(env.CRJM_SESSION_COOKIE_MAX_AGE || '2592000', 10);
  const sessionSecret = env.CRJM_SESSION_SECRET || 'dev-session-secret';

  if (Number.isNaN(sessionCookieMaxAgeSeconds) || sessionCookieMaxAgeSeconds <= 0) {
    throw new Error('CRJM_SESSION_COOKIE_MAX_AGE must be a positive integer');
  }

  if (env.NODE_ENV === 'production' && sessionSecret === 'dev-session-secret') {
    throw new Error('CRJM_SESSION_SECRET must be set in production');
  }

  return {
    dbPath,
    sessionCookieName,
    sessionCookieMaxAgeSeconds,
    sessionSecret,
  };
}
