import { getDB } from '../database/connection'
import { buildWhere } from '../database/repositories/GameRepository'
import { type GameFilters, type GameOutcome, type PlayerColor, type TimeClass } from '@shared/game'

export type StoredGame = {
  id: string
  whitePlayer: string
  blackPlayer: string
  result: string
  pgn: string
  playerColor: PlayerColor | null
  playerRating: number | null
  opponent: string | null
  opponentRating: number | null
  outcome: GameOutcome | null
  timeClass: TimeClass | null
  playedAt: number | null
}

export type OverviewStats = {
  totalGames: number
  wins: number
  losses: number
  draws: number
  winRate: number
  currentRating: number | null
  bestRating: number | null
}

export type RatingPoint = {
  date: string
  rating: number
}

export type ColorResult = {
  games: number
  wins: number
  losses: number
  draws: number
  winRate: number
}

export type ResultsByColor = {
  white: ColorResult
  black: ColorResult
}

export type OpeningStat = {
  opening: string
  games: number
  wins: number
  losses: number
  draws: number
  winRate: number
}

export type OpponentStat = {
  opponent: string
  games: number
  wins: number
  losses: number
  draws: number
  winRate: number
}

export type TimeControlStat = {
  timeClass: TimeClass
  games: number
  wins: number
  losses: number
  draws: number
  winRate: number
}

export type StreakStat = {
  currentWin: number
  longestWin: number
  currentLoss: number
  longestLoss: number
  currentUnbeaten: number
  longestUnbeaten: number
}

export type CalendarDay = {
  date: string
  count: number
}

export class StatisticsService {
  private get db() {
    return getDB()
  }

  fetchGames(filters: GameFilters = {}): StoredGame[] {
    const { where, params } = buildWhere(filters)
    const rows = this.db.prepare(
      `SELECT id, white_player, black_player, result, pgn, player_color, player_rating, opponent, opponent_rating, outcome, time_class, played_at FROM games ${where} ORDER BY played_at ASC`
    ).all(params) as Array<{
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
    }>
    return rows.map((r) => ({
      id: r.id,
      whitePlayer: r.white_player,
      blackPlayer: r.black_player,
      result: r.result,
      pgn: r.pgn,
      playerColor: r.player_color as PlayerColor | null,
      playerRating: r.player_rating,
      opponent: r.opponent,
      opponentRating: r.opponent_rating,
      outcome: r.outcome as GameOutcome | null,
      timeClass: r.time_class as TimeClass | null,
      playedAt: r.played_at
    }))
  }

  overview(filters: GameFilters = {}): OverviewStats {
    const games = this.fetchGames(filters)
    const total = games.length
    const wins = games.filter((g) => g.outcome === 'win').length
    const losses = games.filter((g) => g.outcome === 'loss').length
    const draws = games.filter((g) => g.outcome === 'draw').length
    const winRate = total > 0 ? Math.round((wins / total) * 1000) / 10 : 0

    const ratedGames = games.filter((g) => g.playerRating != null)
    const currentRating = ratedGames.length > 0 ? ratedGames[ratedGames.length - 1].playerRating! : null
    const bestRating = ratedGames.length > 0 ? Math.max(...ratedGames.map((g) => g.playerRating!)) : null

    return { totalGames: total, wins, losses, draws, winRate, currentRating, bestRating }
  }

  ratingHistory(filters: GameFilters = {}, timeClass?: TimeClass): RatingPoint[] {
    const games = this.fetchGames({ ...filters, timeClass })
    return games
      .filter((g) => g.playerRating != null && g.playedAt != null)
      .map((g) => ({ date: new Date(g.playedAt!).toISOString().slice(0, 10), rating: g.playerRating! }))
  }

  resultsByColor(filters: GameFilters = {}): ResultsByColor {
    const compute = (color: PlayerColor): ColorResult => {
      const colorGames = this.fetchGames(filters).filter((g) => g.playerColor === color)
      const games = colorGames.length
      const wins = colorGames.filter((g) => g.outcome === 'win').length
      const losses = colorGames.filter((g) => g.outcome === 'loss').length
      const draws = colorGames.filter((g) => g.outcome === 'draw').length
      const winRate = games > 0 ? Math.round((wins / games) * 1000) / 10 : 0
      return { games, wins, losses, draws, winRate }
    }
    return { white: compute('w'), black: compute('b') }
  }

  openings(filters: GameFilters = {}): OpeningStat[] {
    const games = this.fetchGames(filters)
    const map = new Map<string, { wins: number; losses: number; draws: number }>()
    for (const g of games) {
      const opening = extractOpening(g.pgn)
      if (!opening) continue
      const entry = map.get(opening) ?? { wins: 0, losses: 0, draws: 0 }
      if (g.outcome === 'win') entry.wins++
      else if (g.outcome === 'loss') entry.losses++
      else if (g.outcome === 'draw') entry.draws++
      map.set(opening, entry)
    }
    return [...map.entries()]
      .map(([opening, stats]) => {
        const total = stats.wins + stats.losses + stats.draws
        return {
          opening,
          games: total,
          wins: stats.wins,
          losses: stats.losses,
          draws: stats.draws,
          winRate: total > 0 ? Math.round((stats.wins / total) * 1000) / 10 : 0
        }
      })
      .sort((a, b) => b.games - a.games)
  }

  opponents(filters: GameFilters = {}): OpponentStat[] {
    const games = this.fetchGames(filters).filter((g) => g.opponent)
    const map = new Map<string, { wins: number; losses: number; draws: number }>()
    for (const g of games) {
      const opp = g.opponent!
      const entry = map.get(opp) ?? { wins: 0, losses: 0, draws: 0 }
      if (g.outcome === 'win') entry.wins++
      else if (g.outcome === 'loss') entry.losses++
      else if (g.outcome === 'draw') entry.draws++
      map.set(opp, entry)
    }
    return [...map.entries()]
      .map(([opponent, stats]) => {
        const total = stats.wins + stats.losses + stats.draws
        return {
          opponent,
          games: total,
          wins: stats.wins,
          losses: stats.losses,
          draws: stats.draws,
          winRate: total > 0 ? Math.round((stats.wins / total) * 1000) / 10 : 0
        }
      })
      .sort((a, b) => b.games - a.games)
  }

  timeControls(filters: GameFilters = {}): TimeControlStat[] {
    const games = this.fetchGames(filters).filter((g) => g.timeClass)
    const order: TimeClass[] = ['bullet', 'blitz', 'rapid', 'classical', 'daily']
    const map = new Map<TimeClass, { wins: number; losses: number; draws: number }>()
    for (const tc of order) map.set(tc, { wins: 0, losses: 0, draws: 0 })
    for (const g of games) {
      const tc = g.timeClass!
      const entry = map.get(tc)!
      if (g.outcome === 'win') entry.wins++
      else if (g.outcome === 'loss') entry.losses++
      else if (g.outcome === 'draw') entry.draws++
    }
    return order.map((tc) => {
      const stats = map.get(tc)!
      const total = stats.wins + stats.losses + stats.draws
      return {
        timeClass: tc,
        games: total,
        wins: stats.wins,
        losses: stats.losses,
        draws: stats.draws,
        winRate: total > 0 ? Math.round((stats.wins / total) * 1000) / 10 : 0
      }
    }).filter((t) => t.games > 0)
  }

  streaks(filters: GameFilters = {}): StreakStat {
    const games = this.fetchGames(filters).filter((g) => g.outcome != null)
    const outcomes = games.map((g) => g.outcome!)

    let currentWin = 0
    let longestWin = 0
    let currentLoss = 0
    let longestLoss = 0
    let currentUnbeaten = 0
    let longestUnbeaten = 0

    for (const outcome of outcomes) {
      if (outcome === 'win') {
        currentWin++
        currentUnbeaten++
        currentLoss = 0
        longestWin = Math.max(longestWin, currentWin)
        longestUnbeaten = Math.max(longestUnbeaten, currentUnbeaten)
      } else if (outcome === 'loss') {
        currentLoss++
        currentWin = 0
        currentUnbeaten = 0
        longestLoss = Math.max(longestLoss, currentLoss)
      } else {
        // draw
        currentUnbeaten++
        currentWin = 0
        currentLoss = 0
        longestUnbeaten = Math.max(longestUnbeaten, currentUnbeaten)
      }
    }

    return { currentWin, longestWin, currentLoss, longestLoss, currentUnbeaten, longestUnbeaten }
  }

  calendar(filters: GameFilters = {}, year?: number): CalendarDay[] {
    const games = this.fetchGames(filters).filter((g) => g.playedAt != null)
    const map = new Map<string, number>()
    for (const g of games) {
      if (!g.playedAt) continue
      const date = new Date(g.playedAt).toISOString().slice(0, 10)
      if (year != null && !date.startsWith(String(year))) continue
      map.set(date, (map.get(date) ?? 0) + 1)
    }
    return [...map.entries()].map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date))
  }
}

function extractOpening(pgn: string): string | null {
  const match = pgn.match(/\[Opening "(.*?)"/)
  return match ? match[1] : null
}

export const statisticsService = new StatisticsService()
