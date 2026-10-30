import { getDB } from '../database/connection'
import { buildWhere } from '../database/repositories/GameRepository'
import { computeAccuracy } from './calculateAccuracy'
import type { GameFilters } from '@shared/game'

export type WeaknessCategory =
  | 'opening'
  | 'endgame'
  | 'kingSafety'
  | 'timePressure'
  | 'calculation'

export type CategoryRating = {
  category: WeaknessCategory
  stars: number
  score: number
  label: string
  signal: string
  moves: number
  errors: number
}

export type WeaknessProfile = {
  categories: CategoryRating[]
  gamesAnalyzed: number
  dateRange: { from: string | null; to: string | null }
  trend: 'improving' | 'declining' | 'stable'
  topWeakness: WeaknessCategory | null
  topStrength: WeaknessCategory | null
}

type RawGame = {
  id: string
  played_at: number | null
  player_color: string | null
  outcome: string | null
  result: string
}

type RawPly = {
  ply: number
  classification: string | null
  centipawn_loss: number | null
}

type RawTactic = {
  ply: number
  tactic_type: string
  label: string
  side: string | null
}

const ERROR_CLASSIFICATIONS = new Set(['inaccuracy', 'mistake', 'blunder'])
const BLUNDER_CLASSIFICATIONS = new Set(['mistake', 'blunder'])
const CATEGORY_SIGNAL: Record<WeaknessCategory, string> = {
  opening: 'Early-game accuracy + opening win %',
  endgame: 'Late-game accuracy + conversion',
  kingSafety: 'King-adjacent blunders + eval swings',
  timePressure: 'Accuracy drop late in the game',
  calculation: 'Missed tactics + evaluation drops'
}

function labelFromStars(stars: number): string {
  switch (stars) {
    case 5: return 'Strength'
    case 4: return 'Strong'
    case 3: return 'Average'
    case 2: return 'Weak'
    default: return 'Critical'
  }
}

export class WeaknessEngine {
  private get db() {
    return getDB()
  }

  private fetchGames(filters: GameFilters = {}): RawGame[] {
    const { where, params } = buildWhere(filters)
    const rows = this.db.prepare(
      `SELECT id, played_at, player_color, outcome, result FROM games ${where} ORDER BY played_at ASC`
    ).all(params) as RawGame[]
    return rows
  }

  private fetchPlys(gameId: string): RawPly[] {
    const rows = this.db.prepare(
      'SELECT ply, classification, centipawn_loss FROM engine_analysis WHERE game_id = ? ORDER BY ply ASC'
    ).all(gameId) as RawPly[]
    return rows
  }

  private fetchTactics(gameId: string): RawTactic[] {
    const rows = this.db.prepare(
      'SELECT ply, tactic_type, label, side FROM game_tactics WHERE game_id = ? ORDER BY ply ASC'
    ).all(gameId) as RawTactic[]
    return rows
  }

  private playerPlies(playerColor: string | null, maxPly: number): Set<number> {
    const plies = new Set<number>()
    if (!playerColor) return plies
    for (let ply = 1; ply <= maxPly; ply++) {
      if ((playerColor === 'w' && ply % 2 === 1) || (playerColor === 'b' && ply % 2 === 0)) {
        plies.add(ply)
      }
    }
    return plies
  }

  private categoryScoreForGame(
    game: RawGame,
    plys: RawPly[],
    tactics: RawTactic[]
  ): {
    opening: { moves: number; errors: number; blunders: number; winRate: number }
    endgame: { moves: number; errors: number; accuracy: number }
    kingSafety: { bigBlunders: number }
    timePressure: { earlyAcc: number | null; lateAcc: number | null }
    calculation: { missedTactics: number; evalDrops: number }
  } {
    const playerColor = game.player_color
    const maxPly = Math.max(...plys.map((p) => p.ply), 0)
    const ownPlySet = this.playerPlies(playerColor, maxPly)
    const ownPlys = plys.filter((p) => ownPlySet.has(p.ply))

    const openingPlys = ownPlys.filter((p) => p.ply <= 15)
    const endgamePlys = ownPlys.filter((p) => p.ply > 40)
    const quarter = Math.floor(maxPly / 4)
    const earlyPlys = ownPlys.filter((p) => p.ply <= quarter)
    const latePlys = ownPlys.filter((p) => p.ply > maxPly - quarter)

    const openingErrors = openingPlys.filter((p) => ERROR_CLASSIFICATIONS.has(p.classification ?? '')).length
    const openingBlunders = openingPlys.filter((p) => BLUNDER_CLASSIFICATIONS.has(p.classification ?? '')).length

    const endgameErrors = endgamePlys.filter((p) => ERROR_CLASSIFICATIONS.has(p.classification ?? '')).length
    const endgameAccuracy = computeAccuracy(endgamePlys.map((p) => ({
      classification: p.classification,
      centipawnLoss: p.centipawn_loss
    })))

    const kingSafetyBigBlunders = ownPlys.filter((p) => BLUNDER_CLASSIFICATIONS.has(p.classification ?? '') && (p.centipawn_loss ?? 0) > 300).length

    const earlyAcc = earlyPlys.length > 0 ? computeAccuracy(earlyPlys.map((p) => ({
      classification: p.classification,
      centipawnLoss: p.centipawn_loss
    }))) : null
    const lateAcc = latePlys.length > 0 ? computeAccuracy(latePlys.map((p) => ({
      classification: p.classification,
      centipawnLoss: p.centipawn_loss
    }))) : null

    const playerTactics = tactics.filter((t) => t.side === playerColor || t.side === null)
    const missedTactics = playerTactics.filter((t) => t.label === 'missed').length
    const evalDrops = ownPlys.filter((p) => (p.centipawn_loss ?? 0) > 200).length

    const totalGames = 1
    const wins = game.outcome === 'win' ? 1 : 0
    const winRate = totalGames > 0 ? (wins / totalGames) * 100 : 0

    return {
      opening: { moves: openingPlys.length, errors: openingErrors, blunders: openingBlunders, winRate },
      endgame: { moves: endgamePlys.length, errors: endgameErrors, accuracy: endgameAccuracy },
      kingSafety: { bigBlunders: kingSafetyBigBlunders },
      timePressure: { earlyAcc, lateAcc },
      calculation: { missedTactics, evalDrops }
    }
  }

  private starsFromScore(score: number): number {
    // score is 0-100, higher = stronger (fewer errors). Map to stars.
    if (score >= 85) return 5
    if (score >= 70) return 4
    if (score >= 55) return 3
    if (score >= 40) return 2
    return 1
  }

  profile(filters: GameFilters = {}): WeaknessProfile {
    const games = this.fetchGames(filters)
    if (games.length === 0) {
      return {
        categories: ALL_CATEGORIES.map((c) => ({
          category: c,
          stars: 0,
          score: 0,
          label: 'No data',
          signal: CATEGORY_SIGNAL[c],
          moves: 0,
          errors: 0
        })),
        gamesAnalyzed: 0,
        dateRange: { from: null, to: null },
        trend: 'stable',
        topWeakness: null,
        topStrength: null
      }
    }

    const agg: Record<WeaknessCategory, { moves: number; errors: number; scoreSum: number; count: number }> = {
      opening: { moves: 0, errors: 0, scoreSum: 0, count: 0 },
      endgame: { moves: 0, errors: 0, scoreSum: 0, count: 0 },
      kingSafety: { moves: 0, errors: 0, scoreSum: 0, count: 0 },
      timePressure: { moves: 0, errors: 0, scoreSum: 0, count: 0 },
      calculation: { moves: 0, errors: 0, scoreSum: 0, count: 0 }
    }

    let firstDate: number | null = null
    let lastDate: number | null = null

    for (const game of games) {
      const plys = this.fetchPlys(game.id)
      const tactics = this.fetchTactics(game.id)
      if (game.played_at != null) {
        if (firstDate === null || game.played_at < firstDate) firstDate = game.played_at
        if (lastDate === null || game.played_at > lastDate) lastDate = game.played_at
      }

      const s = this.categoryScoreForGame(game, plys, tactics)

      // Opening score: accuracy + win rate, penalized by errors
      const openingAcc = s.opening.moves > 0 ? 100 - (s.opening.errors / s.opening.moves) * 100 : 50
      const openingScore = Math.max(0, Math.min(100, (openingAcc * 0.7 + s.opening.winRate * 0.3)))
      agg.opening.moves += s.opening.moves
      agg.opening.errors += s.opening.errors
      agg.opening.scoreSum += openingScore
      agg.opening.count++

      // Endgame score: accuracy
      const endgameScore = s.endgame.moves > 0 ? s.endgame.accuracy : 50
      agg.endgame.moves += s.endgame.moves
      agg.endgame.errors += s.endgame.errors
      agg.endgame.scoreSum += endgameScore
      agg.endgame.count++

      // King safety score: penalized by big blunders
      const kingSafetyScore = Math.max(0, 100 - s.kingSafety.bigBlunders * 20)
      agg.kingSafety.errors += s.kingSafety.bigBlunders
      agg.kingSafety.scoreSum += kingSafetyScore
      agg.kingSafety.count++

      // Time pressure score: accuracy drop late vs early
      let timePressureScore = 50
      if (s.timePressure.earlyAcc != null && s.timePressure.lateAcc != null) {
        const drop = s.timePressure.earlyAcc - s.timePressure.lateAcc
        timePressureScore = Math.max(0, Math.min(100, 100 - drop))
      }
      agg.timePressure.scoreSum += timePressureScore
      agg.timePressure.count++

      // Calculation score: penalized by missed tactics + eval drops
      const calcPenalty = (s.calculation.missedTactics * 10) + (s.calculation.evalDrops * 5)
      const calculationScore = Math.max(0, Math.min(100, 100 - calcPenalty))
      agg.calculation.errors += s.calculation.missedTactics + s.calculation.evalDrops
      agg.calculation.scoreSum += calculationScore
      agg.calculation.count++
    }

    const categories: CategoryRating[] = ALL_CATEGORIES.map((c) => {
      const a = agg[c]
      const score = a.count > 0 ? Math.round((a.scoreSum / a.count) * 10) / 10 : 0
      const stars = this.starsFromScore(score)
      return {
        category: c,
        stars,
        score,
        label: labelFromStars(stars),
        signal: CATEGORY_SIGNAL[c],
        moves: a.moves,
        errors: a.errors
      }
    })

    const sorted = [...categories].sort((a, b) => a.stars - b.stars)
    const topWeakness = sorted[0]?.category ?? null
    const topStrength = [...sorted].reverse()[0]?.category ?? null

    // Trend: compare older half vs newer half by average score
    let trend: 'improving' | 'declining' | 'stable' = 'stable'
    if (games.length >= 4) {
      const mid = Math.floor(games.length / 2)
      const older = games.slice(0, mid)
      const newer = games.slice(mid)
      const avgScore = (gs: RawGame[]) => {
        let sum = 0
        let n = 0
        for (const g of gs) {
          const plys = this.fetchPlys(g.id)
          const playerColor = g.player_color
          const maxPly = Math.max(...plys.map((p) => p.ply), 0)
          const ownPlySet = this.playerPlies(playerColor, maxPly)
          const ownPlys = plys.filter((p) => ownPlySet.has(p.ply))
          const acc = computeAccuracy(ownPlys.map((p) => ({
            classification: p.classification,
            centipawnLoss: p.centipawn_loss
          })))
          if (ownPlys.length > 0) {
            sum += acc
            n++
          }
        }
        return n > 0 ? sum / n : 50
      }
      const olderAvg = avgScore(older)
      const newerAvg = avgScore(newer)
      const diff = newerAvg - olderAvg
      if (diff > 3) trend = 'improving'
      else if (diff < -3) trend = 'declining'
    }

    return {
      categories,
      gamesAnalyzed: games.length,
      dateRange: {
        from: firstDate != null ? new Date(firstDate).toISOString().slice(0, 10) : null,
        to: lastDate != null ? new Date(lastDate).toISOString().slice(0, 10) : null
      },
      trend,
      topWeakness,
      topStrength
    }
  }
}

const ALL_CATEGORIES: WeaknessCategory[] = [
  'opening', 'endgame', 'kingSafety', 'timePressure', 'calculation'
]

export const weaknessEngine = new WeaknessEngine()
