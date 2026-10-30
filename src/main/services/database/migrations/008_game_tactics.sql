-- Tactical Detector: stores detected tactical motifs per game
CREATE TABLE IF NOT EXISTS game_tactics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  ply INTEGER NOT NULL,
  san TEXT NOT NULL,
  tactic_type TEXT NOT NULL,
  label TEXT NOT NULL, -- 'created' | 'missed' | 'defended' | 'none'
  side TEXT NOT NULL, -- 'w' | 'b'
  description TEXT NOT NULL,
  fen_before TEXT NOT NULL,
  fen_after TEXT NOT NULL,
  target_square TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_game_tactics_game_id ON game_tactics(game_id);
CREATE INDEX IF NOT EXISTS idx_game_tactics_type ON game_tactics(tactic_type);
CREATE INDEX IF NOT EXISTS idx_game_tactics_side ON game_tactics(side);
CREATE INDEX IF NOT EXISTS idx_game_tactics_label ON game_tactics(label);
