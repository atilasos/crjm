CREATE TABLE IF NOT EXISTS learner_puzzle_completions (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  puzzle_id TEXT NOT NULL,
  game_id TEXT NOT NULL,
  used_hint INTEGER NOT NULL DEFAULT 0 CHECK (used_hint IN (0, 1)),
  occurred_at TEXT NOT NULL,
  xp_delta INTEGER NOT NULL DEFAULT 6,
  PRIMARY KEY (user_id, puzzle_id)
);

CREATE TABLE IF NOT EXISTS learner_streak_shields (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_key TEXT NOT NULL,
  used_at TEXT NOT NULL,
  PRIMARY KEY (user_id, week_key)
);
