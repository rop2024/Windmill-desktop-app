ALTER TABLE games ADD COLUMN external_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_games_external ON games(source, external_id);
