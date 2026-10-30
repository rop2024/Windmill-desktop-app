import { getDB } from '../database/connection'
import { buildWhere } from '../database/repositories/GameRepository'
import { computeAccuracy } from '../analysis/calculateAccuracy'
import type { GameFilters, GameOutcome, PlayerColor } from '@shared/game'

export type OpeningStat = {
  opening: string
  eco: string | null
  games: number
  wins: number
  losses: number
  draws: number
  winRate: number
  accuracy: number | null
  mistakes: number
  recommendation: 'play' | 'avoid' | 'consider'
}

export type OpeningGame = {
  id: string
  whitePlayer: string
  blackPlayer: string
  result: string
  outcome: GameOutcome | null
  playerColor: PlayerColor | null
  playedAt: number | null
  eco: string | null
  opening: string
  accuracy: number | null
}

export type PositionStat = {
  fen: string
  san: string
  moveNumber: number
  ply: number
  timesPlayed: number
  games: number
  winRate: number
}

export type Recommendation = {
  type: 'play' | 'avoid' | 'consider'
  opening: string
  eco: string | null
  winRate: number
  accuracy: number | null
  games: number
  reason: string
}

export type OpeningDrilldown = {
  opening: string
  eco: string | null
  summary: OpeningStat
  games: OpeningGame[]
  positions: PositionStat[]
  recommendations: Recommendation[]
}

type RawGame = {
  id: string
  white_player: string
  black_player: string
  result: string
  pgn: string
  player_color: string | null
  player_rating: number | null
  opponent: string | null
  opponent_rating: number | null
  outcome: string | null
  time_class: string | null
  played_at: number | null
}

type StoredAnalysisPly = {
  game_id: string
  ply: number
  classification: string | null
  centipawn_loss: number | null
}

const OPENING_HEADER = /\[Opening "(.*?)"/
const ECO_HEADER = /\[ECO "(.*?)"/
const MISTAKE_CLASSIFICATIONS = new Set(['inaccuracy', 'mistake', 'blunder'])

function extractTag(pgn: string, re: RegExp): string | null {
  const match = pgn.match(re)
  return match ? match[1] : null
}

function playerPlies(playerColor: PlayerColor | null, maxPly: number): number[] {
  const plies: number[] = []
  for (let ply = 1; ply <= maxPly; ply++) {
    if (playerColor === 'w' && ply % 2 === 1) plies.push(ply)
    else if (playerColor === 'b' && ply % 2 === 0) plies.push(ply)
    else if (playerColor === null) plies.push(ply)
  }
  return plies
}

function recommendationFor(stat: OpeningStat): OpeningStat {
  const { winRate, games, accuracy } = stat
  let type: 'play' | 'avoid' | 'consider' = 'consider'
  if (winRate >= 60 && games >= 3 && (accuracy == null || accuracy >= 70)) type = 'play'
  else if (winRate <= 40 || (accuracy != null && accuracy <= 55)) type = 'avoid'
  return { ...stat, recommendation: type }
}

export class OpeningExplorerService {
  private get db() {
    return getDB()
  }

  private fetchGames(filters: GameFilters = {}): RawGame[] {
    const { where, params } = buildWhere(filters)
    const rows = this.db.prepare(
      `SELECT id, white_player, black_player, result, pgn, player_color, player_rating, opponent, opponent_rating, outcome, time_class, played_at FROM games ${where} ORDER BY played_at ASC`
    ).all(params) as RawGame[]
    return rows
  }

  private positionColumn(): string {
    const cols = this.db.prepare("PRAGMA table_info(game_moves)").all() as Array<{ name: string }>
    const names = cols.map((c) => c.name)
    if (names.includes('fen_before')) return 'fen_before'
    if (names.includes('fen_after')) return 'fen_after'
    return 'fen'
  }

  list(filters: GameFilters = {}): OpeningStat[] {
    const games = this.fetchGames(filters)
    const byOpening = new Map<string, { games: RawGame[]; ecoCounts: Map<string, number> }>()
    for (const g of games) {
      const opening = extractTag(g.pgn, OPENING_HEADER)
      if (!opening) continue
      let entry = byOpening.get(opening)
      if (!entry) {
        entry = { games: [], ecoCounts: new Map() }
        byOpening.set(opening, entry)
      }
      entry.games.push(g)
      const eco = extractTag(g.pgn, ECO_HEADER)
      if (eco) entry.ecoCounts.set(eco, (entry.ecoCounts.get(eco) ?? 0) + 1)
    }

    const allGameIds = [...byOpening.values()].flatMap((e) => e.games.map((g) => g.id))
    const analysisByGame = new Map<string, StoredAnalysisPly[]>()
    if (allGameIds.length > 0) {
      const placeholders = allGameIds.map(() => '?').join(',')
      const rows = this.db
        .prepare(
          `SELECT game_id, ply, classification, centipawn_loss FROM engine_analysis WHERE game_id IN (${placeholders})`
        )
        .all(allGameIds) as StoredAnalysisPly[]
      for (const row of rows) {
        const arr = analysisByGame.get(row.game_id) ?? []
        arr.push(row)
        analysisByGame.set(row.game_id, arr)
      }
    }

    const stats: OpeningStat[] = []
    for (const [opening, entry] of byOpening) {
      const games = entry.games
      const total = games.length
      let wins = 0
      let losses = 0
      let draws = 0
      let accuracySum = 0
      let accuracyCount = 0
      let mistakes = 0
      for (const g of games) {
        if (g.outcome === 'win') wins++
        else if (g.outcome === 'loss') losses++
        else if (g.outcome === 'draw') draws++
        const plies = analysisByGame.get(g.id) ?? []
        const playerPlySet = new Set(playerPlies(g.player_color as PlayerColor | null, Math.max(...plies.map((p) => p.ply), 0)))
        const inputs = plies
          .filter((p) => playerPlySet.has(p.ply))
          .map((p) => ({ classification: p.classification, centipawnLoss: p.centipawn_loss }))
        if (inputs.length > 0) {
          accuracySum += computeAccuracy(inputs)
          accuracyCount++
        }
        for (const p of plies) {
          if (!playerPlySet.has(p.ply)) continue
          if (p.classification && MISTAKE_CLASSIFICATIONS.has(p.classification)) mistakes++
        }
      }
      const winRate = total > 0 ? Math.round((wins / total) * 1000) / 10 : 0
      const accuracy = accuracyCount > 0 ? Math.round((accuracySum / accuracyCount) * 10) / 10 : null
      const ecoCounts = entry.ecoCounts
      let eco: string | null = null
      let topEcoCount = 0
      for (const [e, count] of ecoCounts) {
        if (count > topEcoCount) {
          topEcoCount = count
          eco = e
        }
      }
      stats.push(recommendationFor({ opening, eco, games: total, wins, losses, draws, winRate, accuracy, mistakes, recommendation: 'consider' }))
    }

    return stats.sort((a, b) => b.games - a.games)
  }

  games(opening: string, filters: GameFilters = {}, limit = 50, offset = 0): { games: OpeningGame[]; total: number } {
    const all = this.fetchGames(filters).filter((g) => extractTag(g.pgn, OPENING_HEADER) === opening)
    const total = all.length
    const page = all.slice(offset, offset + limit)
    return {
      total,
      games: page.map((g) => ({
        id: g.id,
        whitePlayer: g.white_player,
        blackPlayer: g.black_player,
        result: g.result,
        outcome: (g.outcome as GameOutcome | null) ?? null,
        playerColor: (g.player_color as PlayerColor | null) ?? null,
        playedAt: g.played_at,
        eco: extractTag(g.pgn, ECO_HEADER),
        opening,
        accuracy: null
      }))
    }
  }

  drilldown(opening: string, filters: GameFilters = {}): OpeningDrilldown {
    const allGames = this.fetchGames(filters).filter((g) => extractTag(g.pgn, OPENING_HEADER) === opening)
    const total = allGames.length
    const wins = allGames.filter((g) => g.outcome === 'win').length
    const losses = allGames.filter((g) => g.outcome === 'loss').length
    const draws = allGames.filter((g) => g.outcome === 'draw').length
    const winRate = total > 0 ? Math.round((wins / total) * 1000) / 10 : 0

    const ecoCounts = new Map<string, number>()
    for (const g of allGames) {
      const eco = extractTag(g.pgn, ECO_HEADER)
      if (eco) ecoCounts.set(eco, (ecoCounts.get(eco) ?? 0) + 1)
    }
    let eco: string | null = null
    let topEcoCount = 0
    for (const [e, count] of ecoCounts) {
      if (count > topEcoCount) {
        topEcoCount = count
        eco = e
      }
    }

    const gameIds = allGames.map((g) => g.id)
    const analysisByGame = new Map<string, StoredAnalysisPly[]>()
    if (gameIds.length > 0) {
      const placeholders = gameIds.map(() => '?').join(',')
      const rows = this.db
        .prepare(
          `SELECT game_id, ply, classification, centipawn_loss FROM engine_analysis WHERE game_id IN (${placeholders})`
        )
        .all(gameIds) as StoredAnalysisPly[]
      for (const row of rows) {
        const arr = analysisByGame.get(row.game_id) ?? []
        arr.push(row)
        analysisByGame.set(row.game_id, arr)
      }
    }

    const games: OpeningGame[] = []
    let accuracySum = 0
    let accuracyCount = 0
    let mistakes = 0
    const gameOutcomeById = new Map<string, GameOutcome | null>()
    for (const g of allGames) {
      const plies = analysisByGame.get(g.id) ?? []
      const maxPly = Math.max(...plies.map((p) => p.ply), 0)
      const playerPlySet = new Set(playerPlies(g.player_color as PlayerColor | null, maxPly))
      const inputs = plies
        .filter((p) => playerPlySet.has(p.ply))
        .map((p) => ({ classification: p.classification, centipawnLoss: p.centipawn_loss }))
      let accuracy: number | null = null
      if (inputs.length > 0) {
        accuracy = computeAccuracy(inputs)
        accuracySum += accuracy
        accuracyCount++
      }
      for (const p of plies) {
        if (!playerPlySet.has(p.ply)) continue
        if (p.classification && MISTAKE_CLASSIFICATIONS.has(p.classification)) mistakes++
      }
      gameOutcomeById.set(g.id, (g.outcome as GameOutcome | null) ?? null)
      games.push({
        id: g.id,
        whitePlayer: g.white_player,
        blackPlayer: g.black_player,
        result: g.result,
        outcome: (g.outcome as GameOutcome | null) ?? null,
        playerColor: (g.player_color as PlayerColor | null) ?? null,
        playedAt: g.played_at,
        eco: extractTag(g.pgn, ECO_HEADER),
        opening,
        accuracy
      })
    }

    const accuracy = accuracyCount > 0 ? Math.round((accuracySum / accuracyCount) * 10) / 10 : null

    const summary: OpeningStat = {
      opening,
      eco,
      games: total,
      wins,
      losses,
      draws,
      winRate,
      accuracy,
      mistakes,
      recommendation: 'consider'
    }

    const positions = this.positionsFor(gameIds, gameOutcomeById)
    const allStats = this.list(filters)
    const currentStat = allStats.find((s) => s.opening === opening) ?? summary
    const recommendations = this.recommendations(allStats)

    return {
      opening,
      eco,
      summary: recommendationFor(currentStat),
      games,
      positions,
      recommendations
    }
  }

  private positionsFor(gameIds: string[], gameOutcomeById: Map<string, GameOutcome | null>): PositionStat[] {
    const column = this.positionColumn()
    if (gameIds.length === 0) return []
    const placeholders = gameIds.map(() => '?').join(',')
    const rows = this.db
      .prepare(
        `SELECT game_id, ${column} AS fen, san, move_number AS moveNumber, ply FROM game_moves WHERE game_id IN (${placeholders}) ORDER BY ply ASC`
      )
      .all(gameIds) as Array<{ game_id: string; fen: string; san: string; moveNumber: number; ply: number }>

    const byFen = new Map<string, { san: string; moveNumber: number; ply: number; gameIds: Set<string>; count: number; wins: number }>()
    for (const row of rows) {
      const outcome = gameOutcomeById.get(row.game_id)
      let entry = byFen.get(row.fen)
      if (!entry) {
        entry = { san: row.san, moveNumber: row.moveNumber, ply: row.ply, gameIds: new Set(), count: 0, wins: 0 }
        byFen.set(row.fen, entry)
      }
      if (entry.gameIds.add(row.game_id).size === entry.count + 1) {
        entry.count++
        if (outcome === 'win') entry.wins++
      }
    }

    const positions: PositionStat[] = []
    for (const [fen, entry] of byFen) {
      positions.push({
        fen,
        san: entry.san,
        moveNumber: entry.moveNumber,
        ply: entry.ply,
        timesPlayed: entry.count,
        games: entry.gameIds.size,
        winRate: entry.gameIds.size > 0 ? Math.round((entry.wins / entry.gameIds.size) * 1000) / 10 : 0
      })
    }
    return positions.sort((a, b) => b.timesPlayed - a.timesPlayed)
  }

  private recommendations(allStats: OpeningStat[]): Recommendation[] {
    const play = allStats
      .filter((s) => s.recommendation === 'play')
      .sort((a, b) => b.winRate - a.winRate)
      .slice(0, 3)
      .map((s) => ({
        type: 'play' as const,
        opening: s.opening,
        eco: s.eco,
        winRate: s.winRate,
        accuracy: s.accuracy,
        games: s.games,
        reason: `${s.winRate.toFixed(1)}% win rate over ${s.games} games — strong repertoire choice`
      }))
    const avoid = allStats
      .filter((s) => s.recommendation === 'avoid')
      .sort((a, b) => a.winRate - b.winRate)
      .slice(0, 3)
      .map((s) => ({
        type: 'avoid' as const,
        opening: s.opening,
        eco: s.eco,
        winRate: s.winRate,
        accuracy: s.accuracy,
        games: s.games,
        reason: `${s.winRate.toFixed(1)}% win rate — consider avoiding`
      }))
    return [...play, ...avoid]
  }
}

export const openingExplorerService = new OpeningExplorerService()
