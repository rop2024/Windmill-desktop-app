-- Add statistics columns to games table
ALTER TABLE games ADD COLUMN player_color TEXT;
ALTER TABLE games ADD COLUMN player_rating INTEGER;
ALTER TABLE games ADD COLUMN opponent TEXT;
ALTER TABLE games ADD COLUMN opponent_rating INTEGER;
ALTER TABLE games ADD COLUMN outcome TEXT;
ALTER TABLE games ADD COLUMN time_class TEXT;
ALTER TABLE games ADD COLUMN played_at INTEGER;

-- Backfill outcome from result column (from White's POV; user color unknown, so map conservatively)
-- result column stores 'win'/'loss'/'draw' from White's perspective.
-- Without knowing user color, set outcome = result when user is White (default assumption for backfill).
UPDATE games SET outcome = result WHERE outcome IS NULL;

-- Backfill played_at from updated_at if not set
UPDATE games SET played_at = updated_at WHERE played_at IS NULL;

-- Indexes for statistics queries
CREATE INDEX IF NOT EXISTS idx_games_outcome ON games(outcome);
CREATE INDEX IF NOT EXISTS idx_games_played_at ON games(played_at);
CREATE INDEX IF NOT EXISTS idx_games_time_class ON games(time_class);
CREATE INDEX IF NOT EXISTS idx_games_opponent ON games(opponent);
CREATE INDEX IF NOT EXISTS idx_games_opening ON games(pgn);
