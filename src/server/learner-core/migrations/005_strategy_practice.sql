CREATE TABLE learner_strategy_attempts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id TEXT NOT NULL,
  variant INTEGER NOT NULL,
  hint_used INTEGER NOT NULL DEFAULT 0,
  answer TEXT,
  prediction TEXT,
  correct INTEGER,
  created_at TEXT NOT NULL,
  completed_at TEXT
);
CREATE INDEX learner_strategy_history ON learner_strategy_attempts(user_id, game_id, created_at);
CREATE UNIQUE INDEX learner_strategy_open ON learner_strategy_attempts(user_id, game_id) WHERE completed_at IS NULL;
