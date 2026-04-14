import { randomBytes } from 'node:crypto';

export interface LearnerCoreConfig {
  dbPath: string;
  sessionCookieName: string;
  sessionCookieMaxAgeSeconds: number;
  sessionSecret: string;
}

const runtimeSessionSecret = randomBytes(32).toString('base64url');

export function getLearnerCoreConfig(env: NodeJS.ProcessEnv = process.env): LearnerCoreConfig {
  const dbPath = env.CRJM_LEARNER_DB_PATH || '.data/learner-core-v1.sqlite';
  const sessionCookieName = env.CRJM_SESSION_COOKIE_NAME || 'crjm_session';
  const sessionCookieMaxAgeSeconds = Number.parseInt(env.CRJM_SESSION_COOKIE_MAX_AGE || '2592000', 10);
  const sessionSecret = env.CRJM_SESSION_SECRET || runtimeSessionSecret;

  if (Number.isNaN(sessionCookieMaxAgeSeconds) || sessionCookieMaxAgeSeconds <= 0) {
    throw new Error('CRJM_SESSION_COOKIE_MAX_AGE must be a positive integer');
  }

  return {
    dbPath,
    sessionCookieName,
    sessionCookieMaxAgeSeconds,
    sessionSecret,
  };
}
