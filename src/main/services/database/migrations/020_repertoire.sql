-- Opening Repertoire Builder: user-defined repertoire lines and coverage tracking
CREATE TABLE IF NOT EXISTS repertoire_lines (
  id TEXT PRIMARY KEY,
  color TEXT NOT NULL, -- 'w' | 'b'
  eco TEXT,
  name TEXT NOT NULL,
  moves TEXT NOT NULL, -- JSON array of SAN moves defining the line
  priority TEXT NOT NULL DEFAULT 'medium', -- 'high' | 'medium' | 'low'
  added_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_repertoire_lines_color ON repertoire_lines(color);
CREATE INDEX IF NOT EXISTS idx_repertoire_lines_eco ON repertoire_lines(eco);

CREATE TABLE IF NOT EXISTS repertoire_coverage (
  line_id TEXT PRIMARY KEY REFERENCES repertoire_lines(id) ON DELETE CASCADE,
  games_played INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  draws INTEGER NOT NULL DEFAULT 0,
  last_played INTEGER,
  win_rate INTEGER NOT NULL DEFAULT 0,
  coverage_pct INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_repertoire_coverage_last_played ON repertoire_coverage(last_played);
