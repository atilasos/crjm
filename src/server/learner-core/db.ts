import { Database } from 'bun:sqlite';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { LearnerCoreConfig } from './config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, 'migrations');

function ensureParentDir(dbPath: string): void {
  if (dbPath === ':memory:') return;
  mkdirSync(path.dirname(path.resolve(process.cwd(), dbPath)), { recursive: true });
}

function applyMigrations(db: Database): void {
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)');

  const applied = new Set(
    db.query<{ version: string }, []>('SELECT version FROM schema_migrations ORDER BY version').all().map((row) => row.version),
  );

  const files = readdirSync(migrationsDir).filter((file) => file.endsWith('.sql')).sort();
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(path.join(migrationsDir, file), 'utf8');
    db.exec('BEGIN');
    try {
      db.exec(sql);
      db.query('INSERT INTO schema_migrations (version) VALUES (?)').run(file);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
}

let cachedPath: string | null = null;
let cachedDb: Database | null = null;

export function createLearnerCoreDb(config: LearnerCoreConfig): Database {
  ensureParentDir(config.dbPath);
  const db = new Database(config.dbPath);
  applyMigrations(db);
  return db;
}

export function getLearnerCoreDb(config: LearnerCoreConfig): Database {
  if (!cachedDb || cachedPath !== config.dbPath) {
    cachedDb?.close(false);
    cachedDb = createLearnerCoreDb(config);
    cachedPath = config.dbPath;
  }
  return cachedDb;
}
