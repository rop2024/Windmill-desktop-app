import { OpeningDetector } from '@openings/OpeningDetector'
import { statisticsService } from '../statistics/StatisticsService'
import { getDB } from '../database/connection'
import type { GameFilters, PlayerColor } from '@shared/game'

export type RepertoireLine = {
  id: string
  color: PlayerColor
  eco: string | null
  name: string
  moves: string[]
  priority: 'high' | 'medium' | 'low'
  addedAt: number
  updatedAt: number
}

export type RepertoireCoverageLine = RepertoireLine & {
  gamesPlayed: number
  wins: number
  losses: number
  draws: number
  winRate: number
  lastPlayed: number | null
  coveragePct: number
  status: 'covered' | 'weak' | 'forgotten' | 'untouched'
}

export type RepertoireSummary = {
  totalLines: number
  coveredLines: number
  weakLines: number
  forgottenLines: number
  untouchedLines: number
  overallCoverage: number
  coverageByColor: Record<string, { total: number; covered: number }>
}

const FORGOTTEN_MONTHS = 6
const WEAK_WIN_RATE = 40

function emptyLine(line: RepertoireLine): RepertoireCoverageLine {
  return {
    ...line,
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    winRate: 0,
    lastPlayed: null,
    coveragePct: 0,
    status: 'untouched'
  }
}

export class RepertoireBuilder {
  private get db() {
    return getDB()
  }

  private detector = new OpeningDetector()

  addLine(color: PlayerColor, eco: string | null, name: string, moves: string[], priority: 'high' | 'medium' | 'low' = 'medium'): RepertoireLine {
    const id = crypto.randomUUID()
    const now = Date.now()
    this.db.prepare(
      `INSERT INTO repertoire_lines (id, color, eco, name, moves, priority, added_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, color, eco ?? null, name, JSON.stringify(moves), priority, now, now)
    return { id, color, eco, name, moves, priority, addedAt: now, updatedAt: now }
  }

  listLines(): RepertoireLine[] {
    const rows = this.db.prepare(
      'SELECT id, color, eco, name, moves, priority, added_at, updated_at FROM repertoire_lines ORDER BY priority DESC, name ASC'
    ).all() as Array<{
      id: string
      color: string
      eco: string | null
      name: string
      moves: string
      priority: string
      added_at: number
      updated_at: number
    }>
    return rows.map((r) => ({
      id: r.id,
      color: r.color as PlayerColor,
      eco: r.eco,
      name: r.name,
      moves: JSON.parse(r.moves),
      priority: r.priority as 'high' | 'medium' | 'low',
      addedAt: r.added_at,
      updatedAt: r.updated_at
    }))
  }

  updateLine(id: string, patch: { eco?: string | null | undefined; name?: string; moves?: string[]; priority?: 'high' | 'medium' | 'low' }): void {
    const fields: string[] = []
    const params: unknown[] = []
    if (patch.eco !== undefined) { fields.push('eco = ?'); params.push(patch.eco) }
    if (patch.name !== undefined) { fields.push('name = ?'); params.push(patch.name) }
    if (patch.moves !== undefined) { fields.push('moves = ?'); params.push(JSON.stringify(patch.moves)) }
    if (patch.priority !== undefined) { fields.push('priority = ?'); params.push(patch.priority) }
    if (fields.length === 0) return
    fields.push('updated_at = ?')
    params.push(Date.now(), id)
    this.db.prepare(`UPDATE repertoire_lines SET ${fields.join(', ')} WHERE id = ?`).run(...params)
  }

  deleteLine(id: string): boolean {
    const info = this.db.prepare('DELETE FROM repertoire_lines WHERE id = ?').run(id)
    return info.changes > 0
  }

  private lineMatchesGame(line: RepertoireLine, gameSan: string[]): boolean {
    if (line.moves.length === 0) return false
    const normalizedLine = line.moves.map((m) => m.replace(/[+#?!]+$/, '').trim())
    const normalizedGame = gameSan.map((m) => m.replace(/[+#?!]+$/, '').trim())
    for (let i = 0; i < normalizedLine.length; i++) {
      if (i >= normalizedGame.length) return false
      if (normalizedLine[i] !== normalizedGame[i]) return false
    }
    return true
  }

  computeCoverage(filters: GameFilters = {}): RepertoireCoverageLine[] {
    const lines = this.listLines()
    if (lines.length === 0) return []

    const games = statisticsService.fetchGames(filters)
    const coverage = new Map<string, RepertoireCoverageLine>()
    for (const line of lines) {
      coverage.set(line.id, emptyLine(line))
    }

    // Build detector entries from repertoire lines for game-level opening detection
    const entries = lines.map((l) => ({
      eco: l.eco ?? 'A00',
      name: l.name,
      variation: null,
      moves: l.moves
    }))
    this.detector.load(entries)

    const now = Date.now()
    const forgottenThreshold = now - FORGOTTEN_MONTHS * 30 * 24 * 3600 * 1000

    for (const g of games) {
      const plies = this.getGameSanPlies(g.id)
      if (plies.length === 0) continue
      const detected = this.detector.detect(plies)
      if (!detected) continue

      // Find matching repertoire line by ECO or name
      for (const line of lines) {
        if (line.eco && detected.eco && line.eco === detected.eco) {
          // Color filter: repertoire line color must match the player's color for that side of the game
          const isPlayerWhite = g.playerColor === 'w'
          const lineIsWhite = line.color === 'w'
          if (isPlayerWhite !== lineIsWhite) continue

          const cov = coverage.get(line.id)!
          cov.gamesPlayed++
          if (g.outcome === 'win') cov.wins++
          else if (g.outcome === 'loss') cov.losses++
          else if (g.outcome === 'draw') cov.draws++
          if (!cov.lastPlayed || g.playedAt! > cov.lastPlayed) cov.lastPlayed = g.playedAt
          break
        } else if (line.name && detected.name && line.name.toLowerCase() === detected.name.toLowerCase()) {
          const isPlayerWhite = g.playerColor === 'w'
          const lineIsWhite = line.color === 'w'
          if (isPlayerWhite !== lineIsWhite) continue

          const cov = coverage.get(line.id)!
          cov.gamesPlayed++
          if (g.outcome === 'win') cov.wins++
          else if (g.outcome === 'loss') cov.losses++
          else if (g.outcome === 'draw') cov.draws++
          if (!cov.lastPlayed || g.playedAt! > cov.lastPlayed) cov.lastPlayed = g.playedAt
          break
        }
      }
    }

    const results: RepertoireCoverageLine[] = []
    for (const [, cov] of coverage) {
      cov.winRate = cov.gamesPlayed > 0 ? Math.round((cov.wins / cov.gamesPlayed) * 100) : 0
      cov.coveragePct = cov.gamesPlayed > 0 ? Math.min(100, Math.round((cov.gamesPlayed / Math.max(games.length, 1)) * 100)) : 0

      if (cov.gamesPlayed === 0) {
        cov.status = 'untouched'
      } else if (cov.winRate < WEAK_WIN_RATE) {
        cov.status = 'weak'
      } else if (cov.lastPlayed != null && cov.lastPlayed < forgottenThreshold) {
        cov.status = 'forgotten'
      } else {
        cov.status = 'covered'
      }
      results.push(cov)
    }

    results.sort((a, b) => {
      const statusOrder: Record<string, number> = { weak: 0, forgotten: 1, untouched: 2, covered: 3 }
      return (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3)
    })
    return results
  }

  summary(filters: GameFilters = {}): RepertoireSummary {
    const coverage = this.computeCoverage(filters)
    const byColor: Record<string, { total: number; covered: number }> = { w: { total: 0, covered: 0 }, b: { total: 0, covered: 0 } }
    let weak = 0, forgotten = 0, untouched = 0, covered = 0
    for (const c of coverage) {
      const by = byColor[c.color]
      if (by) { by.total++; if (c.status === 'covered') by.covered++ }
      if (c.status === 'weak') weak++
      else if (c.status === 'forgotten') forgotten++
      else if (c.status === 'untouched') untouched++
      else if (c.status === 'covered') covered++
    }
    const total = coverage.length
    return {
      totalLines: total,
      coveredLines: covered,
      weakLines: weak,
      forgottenLines: forgotten,
      untouchedLines: untouched,
      overallCoverage: total > 0 ? Math.round((covered / total) * 100) : 0,
      coverageByColor: byColor
    }
  }

  generateStudyPlan(filters: GameFilters = {}): Array<RepertoireCoverageLine & { reason: string }> {
    const coverage = this.computeCoverage(filters)
    return coverage
      .filter((c) => c.status !== 'covered')
      .map((c) => {
        let reason = ''
        if (c.status === 'weak') reason = `Low win rate (${c.winRate}%) — needs study`
        else if (c.status === 'forgotten') reason = `Not played in ${FORGOTTEN_MONTHS} months — review needed`
        else if (c.status === 'untouched') reason = 'Never played — learn this line'
        return { ...c, reason }
      })
      .sort((a, b) => {
        const prio: Record<string, number> = { high: 0, medium: 1, low: 2 }
        return (prio[a.priority] ?? 1) - (prio[b.priority] ?? 1)
      })
  }

  private getGameSanPlies(gameId: string): string[] {
    const rows = this.db.prepare(
      'SELECT san FROM game_moves WHERE game_id = ? ORDER BY move_number ASC'
    ).all(gameId) as Array<{ san: string }>
    return rows.map((r) => r.san)
  }

  getLine(id: string): RepertoireLine | null {
    const row = this.db.prepare(
      'SELECT id, color, eco, name, moves, priority, added_at, updated_at FROM repertoire_lines WHERE id = ?'
    ).get(id) as {
      id: string
      color: string
      eco: string | null
      name: string
      moves: string
      priority: string
      added_at: number
      updated_at: number
    } | undefined
    if (!row) return null
    return {
      id: row.id,
      color: row.color as PlayerColor,
      eco: row.eco,
      name: row.name,
      moves: JSON.parse(row.moves),
      priority: row.priority as 'high' | 'medium' | 'low',
      addedAt: row.added_at,
      updatedAt: row.updated_at
    }
  }
}

export const repertoireBuilder = new RepertoireBuilder()
