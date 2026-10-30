-- Sync metadata: tracks Chess.com sync state (username, last sync timestamp)
CREATE TABLE IF NOT EXISTS sync_metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_sync_metadata_key ON sync_metadata(key);
