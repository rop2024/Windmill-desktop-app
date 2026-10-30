CREATE TABLE IF NOT EXISTS position_cache (
  fen_hash TEXT PRIMARY KEY,
  fen TEXT NOT NULL,
  engine_version TEXT NOT NULL,
  settings_hash TEXT NOT NULL,
  depth INTEGER NOT NULL,
  score_cp INTEGER,
  score_mate INTEGER,
  bestmove TEXT,
  pv TEXT,
  analyzed_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_position_cache_settings ON position_cache(engine_version, settings_hash);

ALTER TABLE engine_analysis ADD COLUMN centipawn_loss INTEGER;
ALTER TABLE engine_analysis ADD COLUMN classification TEXT;

CREATE INDEX IF NOT EXISTS idx_engine_analysis_classification ON engine_analysis(classification);
