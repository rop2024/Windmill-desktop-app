CREATE TABLE IF NOT EXISTS engine_analysis (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  ply INTEGER NOT NULL,
  fen TEXT NOT NULL,
  engine_version TEXT NOT NULL,
  settings_hash TEXT NOT NULL,
  score_cp INTEGER,
  score_mate INTEGER,
  bestmove TEXT,
  pv TEXT,
  depth INTEGER,
  analyzed_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  UNIQUE(game_id, ply, settings_hash)
);

CREATE INDEX IF NOT EXISTS idx_engine_analysis_game_ply ON engine_analysis(game_id, ply);
CREATE INDEX IF NOT EXISTS idx_engine_analysis_fen ON engine_analysis(fen);
