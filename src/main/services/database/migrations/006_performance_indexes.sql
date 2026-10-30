-- Additional indexes for performance on large datasets
CREATE INDEX IF NOT EXISTS idx_games_result ON games(result);
CREATE INDEX IF NOT EXISTS idx_games_source ON games(source);
CREATE INDEX IF NOT EXISTS idx_games_external ON games(source, external_id);

-- ANALYZE to update query planner statistics
ANALYZE;
