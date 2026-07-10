CREATE TABLE IF NOT EXISTS learner_puzzle_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  xp_delta INTEGER NOT NULL DEFAULT 6,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS learner_pattern_progress (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pattern_id TEXT NOT NULL,
  game_id TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('seen', 'used_with_help', 'used_alone', 'mastered')),
  solo_context_ids_json TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, pattern_id)
);

CREATE TABLE IF NOT EXISTS learner_mission_claims (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mission_id TEXT NOT NULL,
  period_key TEXT NOT NULL,
  reward_xp INTEGER NOT NULL,
  claimed_at TEXT NOT NULL,
  PRIMARY KEY (user_id, mission_id, period_key)
);
