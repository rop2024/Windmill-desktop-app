-- Puzzle Trainer: tracks puzzle solve attempts and spaced-repetition scheduling
CREATE TABLE IF NOT EXISTS puzzle_solves (
  id TEXT PRIMARY KEY,
  puzzle_id TEXT NOT NULL REFERENCES puzzles(id) ON DELETE CASCADE,
  correct INTEGER NOT NULL DEFAULT 0,
  time_ms INTEGER NOT NULL DEFAULT 0,
  solved_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_puzzle_solves_puzzle_id ON puzzle_solves(puzzle_id);
CREATE INDEX IF NOT EXISTS idx_puzzle_solves_solved_at ON puzzle_solves(solved_at);

CREATE TABLE IF NOT EXISTS puzzle_schedule (
  puzzle_id TEXT PRIMARY KEY REFERENCES puzzles(id) ON DELETE CASCADE,
  next_review INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  interval_days INTEGER NOT NULL DEFAULT 1,
  ease_factor REAL NOT NULL DEFAULT 2.5,
  repetitions INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_puzzle_schedule_next_review ON puzzle_schedule(next_review);
