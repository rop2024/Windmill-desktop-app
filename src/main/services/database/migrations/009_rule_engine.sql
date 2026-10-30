-- Rule Engine: persistent counters and flags
CREATE TABLE IF NOT EXISTS rule_counters (
  name TEXT PRIMARY KEY,
  value INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE TABLE IF NOT EXISTS rule_flags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_id TEXT NOT NULL,
  flag TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  counter_name TEXT,
  counter_value INTEGER,
  triggered_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  game_id TEXT,
  acknowledged INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_rule_flags_flag ON rule_flags(flag);
CREATE INDEX IF NOT EXISTS idx_rule_flags_acknowledged ON rule_flags(acknowledged);
CREATE INDEX IF NOT EXISTS idx_rule_flags_triggered_at ON rule_flags(triggered_at);
