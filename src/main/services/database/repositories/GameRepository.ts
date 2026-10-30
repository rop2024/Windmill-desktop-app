import Database from 'better-sqlite3'
import { createHash } from 'node:crypto'
import { getDB } from '../connection'
import { type ParsedGame } from '@pgn/types'
import { flattenMainLine } from '@pgn/flattenMainLine'
import { serialize } from '@pgn/serialize'
import { logger } from '../../logger'
import type { Game, GameFilters, GameOutcome, PlayerColor, TimeClass } from '@shared/game'

export type GameRow = Game & { external_id?: string | null }

function computeExternalId(headers: Map<string, string>, movetext: string): string {
  const sorted = [...headers.entries()].sort(([a], [b]) => a.localeCompare(b))
  const payload = JSON.stringify(sorted) + '|' + movetext.trim()
  return createHash('sha1').update(payload).digest('hex')
}

function gameRowToGame(row: {
  id: string
  white_player: string
  black_player: string
  result: string
  pgn: string
  source: string
  created_at: number
  updated_at: number
  external_id?: string | null
  player_color?: string | null
  player_rating?: number | null
  opponent?: string | null
  opponent_rating?: number | null
  outcome?: string | null
  time_class?: string | null
  played_at?: number | null
}): GameRow {
  return {
    id: row.id,
    whitePlayer: row.white_player,
    blackPlayer: row.black_player,
    result: row.result as Game['result'],
    pgn: row.pgn,
    source: row.source as Game['source'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    external_id: row.external_id ?? undefined,
    playerColor: (row.player_color as PlayerColor | null) ?? undefined,
    playerRating: row.player_rating ?? undefined,
    opponent: row.opponent ?? undefined,
    opponentRating: row.opponent_rating ?? undefined,
    outcome: (row.outcome as GameOutcome | null) ?? undefined,
    timeClass: (row.time_class as TimeClass | null) ?? undefined,
    playedAt: row.played_at ?? undefined
  }
}

export class GameRepository {
  private db: Database.Database

  constructor() {
    this.db = getDB()
  }

  insertGame(parsed: ParsedGame): { ok: true; game: GameRow; duplicate: false } | { ok: true; game: null; duplicate: true } | { ok: false; error: unknown } {
    try {
      const externalId = computeExternalId(parsed.headers, parsed.movetext)
      const source = parsed.headers.get('Source') ?? 'local'

      const existing = this.db
        .prepare('SELECT id FROM games WHERE source = ? AND external_id = ?')
        .get(source, externalId) as { id: string } | undefined
      if (existing) {
        return { ok: true, game: null, duplicate: true }
      }

      const whitePlayer = parsed.headers.get('White') ?? 'Unknown'
      const blackPlayer = parsed.headers.get('Black') ?? 'Unknown'
      const result = (parsed.result ?? '*') as Game['result']
      const pgn = serializePgn(parsed)
      const now = Date.now()
      const id = crypto.randomUUID()

      const tx = this.db.transaction(() => {
        this.db.prepare(
          'INSERT INTO games (id, white_player, black_player, result, pgn, source, created_at, updated_at, external_id, player_color, player_rating, opponent, opponent_rating, outcome, time_class, played_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).run(
          id,
          whitePlayer,
          blackPlayer,
          result,
          pgn,
          source,
          now,
          now,
          externalId,
          parsed.playerColor ?? null,
          parsed.playerRating ?? null,
          parsed.opponent ?? null,
          parsed.opponentRating ?? null,
          parsed.outcome ?? null,
          parsed.timeClass ?? null,
          parsed.playedAt ?? now
        )

        if (parsed.root) {
          const rows = flattenMainLine(id, [parsed.root])
          const insertMove = this.db.prepare(
            'INSERT INTO game_moves (game_id, move_number, san, uci, fen_before, fen_after, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
          )
          for (const row of rows) {
            insertMove.run(row.gameId, row.moveNumber, row.san, row.uci, row.fenBefore, row.fenAfter, row.createdAt)
          }
        }
      })
      tx()

      const game = this.getById(id)
      if (!game) {
        throw new Error('Failed to read back inserted game')
      }
      return { ok: true, game, duplicate: false }
    } catch (e) {
      logger.error('GameRepository.insertGame failed', { error: e instanceof Error ? e.message : String(e) })
      return { ok: false, error: e }
    }
  }

  insertMany(parsed: ParsedGame[]): { ok: true; imported: number; duplicates: number } | { ok: false; error: unknown } {
    try {
      const db = this.db
      const tx = db.transaction(() => {
        const check = db.prepare('SELECT id FROM games WHERE source = ? AND external_id = ?')
        const insertGameStmt = db.prepare(
          'INSERT INTO games (id, white_player, black_player, result, pgn, source, created_at, updated_at, external_id, player_color, player_rating, opponent, opponent_rating, outcome, time_class, played_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )
        const insertMove = db.prepare(
          'INSERT INTO game_moves (game_id, move_number, san, uci, fen_before, fen_after, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        )

        let imported = 0
        let duplicates = 0
        const now = Date.now()

        for (const p of parsed) {
          const externalId = computeExternalId(p.headers, p.movetext)
          const source = p.headers.get('Source') ?? 'local'
          const exists = check.get(source, externalId) as { id: string } | undefined
          if (exists) {
            duplicates++
            continue
          }

          const id = crypto.randomUUID()
          const whitePlayer = p.headers.get('White') ?? 'Unknown'
          const blackPlayer = p.headers.get('Black') ?? 'Unknown'
          const result = (p.result ?? '*') as Game['result']
          const pgn = serializePgn(p)

          insertGameStmt.run(
            id,
            whitePlayer,
            blackPlayer,
            result,
            pgn,
            source,
            now,
            now,
            externalId,
            p.playerColor ?? null,
            p.playerRating ?? null,
            p.opponent ?? null,
            p.opponentRating ?? null,
            p.outcome ?? null,
            p.timeClass ?? null,
            p.playedAt ?? now
          )

          if (p.root) {
            const rows = flattenMainLine(id, [p.root])
            for (const row of rows) {
              insertMove.run(row.gameId, row.moveNumber, row.san, row.uci, row.fenBefore, row.fenAfter, row.createdAt)
            }
          }
          imported++
        }

        return { imported, duplicates }
      })

      const result = tx()
      logger.info('GameRepository.insertMany completed', result)
      return { ok: true, ...result }
    } catch (e) {
      logger.error('GameRepository.insertMany failed', { error: e instanceof Error ? e.message : String(e) })
      return { ok: false, error: e }
    }
  }

  getById(id: string): GameRow | null {
    const row = this.db.prepare('SELECT * FROM games WHERE id = ?').get(id) as
      | {
          id: string
          white_player: string
          black_player: string
          result: string
          pgn: string
          source: string
          created_at: number
          updated_at: number
          external_id?: string | null
        }
      | undefined
    if (!row) return null
    return gameRowToGame(row)
  }

  delete(id: string): { ok: true; deleted: boolean } | { ok: false; error: unknown } {
    try {
      const info = this.db.prepare('DELETE FROM games WHERE id = ?').run(id)
      return { ok: true, deleted: info.changes > 0 }
    } catch (e) {
      logger.error('GameRepository.delete failed', { error: e instanceof Error ? e.message : String(e) })
      return { ok: false, error: e }
    }
  }

  update(id: string, patch: Partial<Pick<Game, 'result' | 'pgn' | 'source'>>): { ok: true; game: GameRow } | { ok: false; error: unknown } {
    try {
      const sets: string[] = []
      const params: unknown[] = []
      if (patch.result !== undefined) { sets.push('result = ?'); params.push(patch.result) }
      if (patch.pgn !== undefined) { sets.push('pgn = ?'); params.push(patch.pgn) }
      if (patch.source !== undefined) { sets.push('source = ?'); params.push(patch.source) }
      if (sets.length === 0) {
        const game = this.getById(id)
        if (!game) return { ok: false, error: new Error('Game not found') }
        return { ok: true, game }
      }
      sets.push('updated_at = ?')
      params.push(Date.now(), id)

      const sql = `UPDATE games SET ${sets.join(', ')} WHERE id = ?`
      this.db.prepare(sql).run(...params)

      const game = this.getById(id)
      if (!game) return { ok: false, error: new Error('Game not found after update') }
      return { ok: true, game }
    } catch (e) {
      logger.error('GameRepository.update failed', { error: e instanceof Error ? e.message : String(e) })
      return { ok: false, error: e }
    }
  }

  count(filters: GameFilters = {}): number {
    const { where, params } = buildWhere(filters)
    const row = this.db.prepare(`SELECT COUNT(*) as c FROM games ${where}`).get(params) as { c: number }
    return row.c
  }

  query(filters: GameFilters = {}, sort: { field: 'updated_at' | 'created_at' | 'result'; dir: 'asc' | 'desc' } = { field: 'updated_at', dir: 'desc' }, limit = 50, offset = 0): { rows: GameRow[]; total: number } {
    const { where, params } = buildWhere(filters)
    const totalRow = this.db.prepare(`SELECT COUNT(*) as c FROM games ${where}`).get(params) as { c: number }
    const total = totalRow.c

    const orderDir = sort.dir === 'asc' ? 'ASC' : 'DESC'
    const orderField = sort.field === 'created_at' ? 'created_at' : 'updated_at'
    const rows = this.db.prepare(
      `SELECT * FROM games ${where} ORDER BY ${orderField} ${orderDir} LIMIT ? OFFSET ?`
    ).all([...params, limit, offset]) as Array<{
      id: string
      white_player: string
      black_player: string
      result: string
      pgn: string
      source: string
      created_at: number
      updated_at: number
      external_id?: string | null
    }>

    return {
      rows: rows.map(gameRowToGame),
      total
    }
  }
}

export function buildWhere(filters: GameFilters): { where: string; params: unknown[] } {
  const conditions: string[] = []
  const params: unknown[] = []

  if (filters.source) {
    conditions.push('source = ?')
    params.push(filters.source)
  }
  if (filters.result) {
    conditions.push('result = ?')
    params.push(filters.result)
  }
  if (filters.search) {
    conditions.push('(white_player LIKE ? OR black_player LIKE ? OR pgn LIKE ?)')
    const like = `%${filters.search}%`
    params.push(like, like, like)
  }
  if (filters.outcome) {
    conditions.push('outcome = ?')
    params.push(filters.outcome)
  }
  if (filters.timeClass) {
    conditions.push('time_class = ?')
    params.push(filters.timeClass)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  return { where, params }
}

function serializePgn(parsed: ParsedGame): string {
  const roots = parsed.root ? [parsed.root] : []
  return serialize(parsed.headers, roots, parsed.result ?? null)
}
