import Database from 'better-sqlite3'
import { join } from 'node:path'
import { app } from 'electron'
import { logger } from '../logger'

let db: Database.Database | null = null

export function initDB(): Database.Database {
  const userData = app.getPath('userData')
  const dbPath = join(userData, 'chess.db')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  logger.info('Database opened', { path: dbPath })
  return db
}

export function closeDB(): void {
  if (db) {
    db.close()
    db = null
    logger.info('Database closed')
  }
}

export function getDBPath(): string {
  return join(app.getPath('userData'), 'chess.db')
}

export function getDB(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDB() first.')
  }
  return db
}
