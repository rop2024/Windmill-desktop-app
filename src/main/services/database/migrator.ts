import m001 from './migrations/001_initial.sql?raw'
import m002 from './migrations/002_external_id.sql?raw'
import m003 from './migrations/003_engine_analysis.sql?raw'
import m004 from './migrations/004_analysis_cache.sql?raw'
import m005 from './migrations/005_stats_columns.sql?raw'
import m006 from './migrations/006_performance_indexes.sql?raw'
import m007 from './migrations/007_sync_metadata.sql?raw'
import m008 from './migrations/008_game_tactics.sql?raw'
import m009 from './migrations/009_rule_engine.sql?raw'
import m010 from './migrations/010_puzzles.sql?raw'
import m011 from './migrations/011_puzzle_trainer.sql?raw'
import m012 from './migrations/012_achievements.sql?raw'
import m020 from './migrations/020_repertoire.sql?raw'
import { getDB } from './connection'
import { logger } from '../logger'

type Migration = { version: number; sql: string }

const migrations: Migration[] = [
  { version: 1, sql: m001 as unknown as string },
  { version: 2, sql: m002 as unknown as string },
  { version: 3, sql: m003 as unknown as string },
  { version: 4, sql: m004 as unknown as string },
  { version: 5, sql: m005 as unknown as string },
  { version: 6, sql: m006 as unknown as string },
  { version: 7, sql: m007 as unknown as string },
  { version: 8, sql: m008 as unknown as string },
  { version: 9, sql: m009 as unknown as string },
  { version: 10, sql: m010 as unknown as string },
  { version: 11, sql: m011 as unknown as string },
  { version: 12, sql: m012 as unknown as string },
  { version: 20, sql: m020 as unknown as string }
]

export async function runMigrations(): Promise<void> {
  const db = getDB()

  db.prepare(
    'CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime(\'now\')))'
  ).run()

  const appliedRows = db.prepare('SELECT version FROM schema_migrations').all() as { version: number }[]
  const applied = new Set(appliedRows.map((r) => r.version))

  for (const { version, sql } of migrations) {
    if (applied.has(version)) continue
    const tx = db.transaction(() => {
      db.exec(sql)
    })
    tx()
    db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(version)
    logger.info('Migration applied', { version })
  }

  const versionRow = db
    .prepare('SELECT MAX(version) as version FROM schema_migrations')
    .get() as { version: number | null }
  db.pragma(`user_version = ${versionRow.version ?? 0}`)
}
