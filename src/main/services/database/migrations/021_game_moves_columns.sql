-- Align game_moves with the move repository writes while preserving legacy query names.
CREATE TABLE game_moves_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  move_number INTEGER NOT NULL,
  san TEXT NOT NULL,
  uci TEXT,
  fen_before TEXT,
  fen_after TEXT,
  created_at INTEGER NOT NULL,
  ply INTEGER GENERATED ALWAYS AS (move_number) VIRTUAL,
  fen TEXT GENERATED ALWAYS AS (fen_after) VIRTUAL,
  UNIQUE(game_id, move_number)
);

INSERT INTO game_moves_new (id, game_id, move_number, san, fen_after, created_at)
SELECT id, game_id, move_number, san, fen, created_at FROM game_moves;

DROP TABLE game_moves;
ALTER TABLE game_moves_new RENAME TO game_moves;

CREATE INDEX IF NOT EXISTS idx_game_moves_game_id ON game_moves(game_id);
CREATE INDEX IF NOT EXISTS idx_game_moves_move_number ON game_moves(game_id, move_number);
