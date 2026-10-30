-- Puzzle Generator: stores mined puzzle positions from user's games
CREATE TABLE IF NOT EXISTS puzzles (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  ply INTEGER NOT NULL,
  san TEXT NOT NULL,
  fen_before TEXT NOT NULL,
  fen_after TEXT NOT NULL,
  solution_san TEXT NOT NULL,
  solution_pv TEXT NOT NULL,
  score_cp INTEGER,
  score_mate INTEGER,
  centipawn_loss INTEGER,
  difficulty TEXT NOT NULL, -- 'easy' | 'medium' | 'hard' | 'expert'
  tactic_type TEXT,
  tactic_label TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_puzzles_game_id ON puzzles(game_id);
CREATE INDEX IF NOT EXISTS idx_puzzles_difficulty ON puzzles(difficulty);
CREATE INDEX IF NOT EXISTS idx_puzzles_tactic ON puzzles(tactic_type);
CREATE INDEX IF NOT EXISTS idx_puzzles_created_at ON puzzles(created_at);
