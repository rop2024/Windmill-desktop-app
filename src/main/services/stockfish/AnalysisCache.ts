import Database from 'better-sqlite3'
import { createHash } from 'node:crypto'
import { getDB } from '../database/connection'
import { logger } from '../logger'

export type CachedPosition = {
  fen_hash: string
  fen: string
  engine_version: string
  settings_hash: string
  depth: number
  score_cp: number | null
  score_mate: number | null
  bestmove: string | null
  pv: string | null
}

function hashFen(fen: string, engineVersion: string, settingsHash: string, depth: number): string {
  const payload = `${fen}|${engineVersion}|${settingsHash}|${depth}`
  return createHash('sha1').update(payload).digest('hex')
}

function settingsHash(settings: { depth: number; threads: number; hash: number; multiPV: number }): string {
  const payload = JSON.stringify(settings)
  return createHash('sha1').update(payload).digest('hex').slice(0, 16)
}

export class AnalysisCache {
  private get db(): Database.Database {
    return getDB()
  }

  lookup(
    fen: string,
    engineVersion: string,
    settings: { depth: number; threads: number; hash: number; multiPV: number }
  ): CachedPosition | null {
    const fenHash = hashFen(fen, engineVersion, settingsHash(settings), settings.depth)
    const row = this.db
      .prepare('SELECT * FROM position_cache WHERE fen_hash = ?')
      .get(fenHash) as CachedPosition | undefined
    if (!row) return null
    return {
      ...row,
      pv: row.pv ? JSON.parse(row.pv) : null
    }
  }

  store(
    fen: string,
    engineVersion: string,
    settings: { depth: number; threads: number; hash: number; multiPV: number },
    result: {
      score_cp: number | null
      score_mate: number | null
      bestmove: string | null
      pv: string[]
      depth: number
    }
  ): void {
    const fenHash = hashFen(fen, engineVersion, settingsHash(settings), settings.depth)
    const existing = this.db
      .prepare('SELECT 1 FROM position_cache WHERE fen_hash = ?')
      .get(fenHash)
    if (existing) return

    this.db.prepare(
      'INSERT INTO position_cache (fen_hash, fen, engine_version, settings_hash, depth, score_cp, score_mate, bestmove, pv, analyzed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, strftime(\'%s\', \'now\'))'
    ).run(
      fenHash,
      fen,
      engineVersion,
      settingsHash(settings),
      result.depth,
      result.score_cp,
      result.score_mate,
      result.bestmove,
      JSON.stringify(result.pv)
    )
    logger.debug('Position cached', { fenHash, depth: result.depth })
  }
}
