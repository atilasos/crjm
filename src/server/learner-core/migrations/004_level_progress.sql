-- Persistir o nível de dificuldade das partidas contra a IA, para os
-- desafios do percurso («vence o Nx») contarem automaticamente.

ALTER TABLE learner_activity_events ADD COLUMN difficulty_level INTEGER;

CREATE TABLE IF NOT EXISTS learner_level_progress (
  user_id TEXT NOT NULL,
  game_id TEXT NOT NULL,
  difficulty_level INTEGER NOT NULL,
  played_count INTEGER NOT NULL DEFAULT 0,
  win_count INTEGER NOT NULL DEFAULT 0,
  current_win_streak INTEGER NOT NULL DEFAULT 0,
  best_win_streak INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, game_id, difficulty_level)
);
