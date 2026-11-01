import { statisticsService } from '../statistics/StatisticsService'
import { analysisRepository } from './AnalysisRepository'
import { computeAccuracy, type AccuracyInput } from './calculateAccuracy'
import { getDB } from '../database/connection'
import type { GameFilters, GameOutcome } from '@shared/game'

export type ShameGame = {
  id: string
  whitePlayer: string
  blackPlayer: string
  result: string
  outcome: GameOutcome | null
  playedAt: number | null
  playerColor: string | null
  playerRating: number | null
  opponent: string | null
  opponentRating: number | null
  accuracy: number
  moves: number
  blunders: number
  tacticsMissed: number
  tacticsDefended: number
  timeClass: string | null
}

export type ShameMove = {
  id: string
  gameId: string
  ply: number
  san: string
  classification: string | null
  centipawnLoss: number | null
  scoreCp: number | null
  scoreMate: number | null
  accuracy: number
  gameResult: string
  gameOutcome: GameOutcome | null
  playedAt: number | null
  opponentRating: number | null
}

export type ShameThrow = ShameGame & {
  evalSwing: number
  thrownFrom: string
}

export type ShameMissedMate = ShameGame & {
  mateIn: number
}

export type ShameTimeTrouble = ShameGame & {
  accuracyDrop: number
}

export type ShameSummary = {
  worstBlunders: ShameMove[]
  largestThrows: ShameThrow[]
  fastestLosses: ShameGame[]
  missedMates: ShameMissedMate[]
  timeTrouble: ShameTimeTrouble[]
  missedTactics: number
}

function playerPlies(playerColor: string | null, maxPly: number): Set<number> {
  const plies = new Set<number>()
  if (!playerColor) return plies
  for (let ply = 1; ply <= maxPly; ply++) {
    if ((playerColor === 'w' && ply % 2 === 1) || (playerColor === 'b' && ply % 2 === 0)) {
      plies.add(ply)
    }
  }
  return plies
}

export class BoardOfShame {
  summary(filters: GameFilters = {}, limit = 20): ShameSummary {
    const games = statisticsService.fetchGames(filters)
    const tacticCounts = getDB().prepare(
      `SELECT game_id AS gameId,
              SUM(CASE WHEN label = 'missed' THEN 1 ELSE 0 END) AS missed,
              SUM(CASE WHEN label = 'defended' THEN 1 ELSE 0 END) AS defended
       FROM game_tactics GROUP BY game_id`
    ).all() as Array<{ gameId: string; missed: number; defended: number }>
    const tacticsByGame = new Map(tacticCounts.map((row) => [row.gameId, row]))
    const shameGames: ShameGame[] = []
    const allBlunders: ShameMove[] = []

    for (const g of games) {
      const plies = analysisRepository.getAnalysisForGame(g.id)
      if (plies.length === 0) continue

      const playerColor = g.playerColor
      const maxPly = Math.max(...plies.map((p) => p.ply), 0)
      const ownPlySet = playerPlies(playerColor, maxPly)
      const ownPlys = plies.filter((p) => ownPlySet.has(p.ply))
      if (ownPlys.length === 0) continue

      const inputs: AccuracyInput[] = ownPlys.map((p) => ({
        classification: p.classification,
        centipawnLoss: p.centipawn_loss
      }))
      const accuracy = computeAccuracy(inputs)
      const blunders = ownPlys.filter((p) => p.classification === 'mistake' || p.classification === 'blunder').length
      const tactics = tacticsByGame.get(g.id)

      const game: ShameGame = {
        id: g.id,
        whitePlayer: g.whitePlayer,
        blackPlayer: g.blackPlayer,
        result: g.result,
        outcome: g.outcome,
        playedAt: g.playedAt,
        playerColor: g.playerColor,
        playerRating: g.playerRating,
        opponent: g.opponent,
        opponentRating: g.opponentRating,
        accuracy,
        moves: ownPlys.length,
        blunders,
        tacticsMissed: tactics?.missed ?? 0,
        tacticsDefended: tactics?.defended ?? 0,
        timeClass: g.timeClass
      }
      shameGames.push(game)

      for (const p of ownPlys) {
        if (!p.classification || (p.classification !== 'mistake' && p.classification !== 'blunder')) continue
        allBlunders.push({
          id: `${g.id}-${p.ply}`,
          gameId: g.id,
          ply: p.ply,
          san: '',
          classification: p.classification,
          centipawnLoss: p.centipawn_loss,
          scoreCp: p.score_cp,
          scoreMate: p.score_mate,
          accuracy: computeAccuracy([{ classification: p.classification, centipawnLoss: p.centipawn_loss }]),
          gameResult: g.result,
          gameOutcome: g.outcome,
          playedAt: g.playedAt,
          opponentRating: g.opponentRating
        })
      }
    }

    // Worst blunders: highest centipawn loss
    const worstBlunders = allBlunders
      .sort((a, b) => {
        const al = a.centipawnLoss ?? 0
        const bl = b.centipawnLoss ?? 0
        return bl - al
      })
      .slice(0, limit)

    // Largest throws: losses where we held an eval advantage earlier in the game
    const throwsWithSwing: Array<ShameGame & { evalSwing: number }> = []
    for (const g of shameGames) {
      if (g.outcome !== 'loss') continue
      const plies = analysisRepository.getAnalysisForGame(g.id)
      const playerColor = g.playerColor
      const maxPly = Math.max(...plies.map((p) => p.ply), 0)
      const ownPlySet = playerPlies(playerColor, maxPly)
      const ownPlys = plies.filter((p) => ownPlySet.has(p.ply))
      let bestAdvantage = 0
      for (const p of ownPlys) {
        const cp = p.score_cp ?? null
        const mate = p.score_mate ?? null
        const evalForUs = playerColor === 'w' ? (cp ?? (mate ?? 0)) : (cp ?? (mate ?? 0)) * -1
        if (evalForUs > bestAdvantage) bestAdvantage = evalForUs
      }
      if (bestAdvantage > 200) {
        throwsWithSwing.push({ ...g, evalSwing: bestAdvantage })
      }
    }
    const largestThrows: ShameThrow[] = throwsWithSwing
      .map((g) => ({ ...g, thrownFrom: 'winning position' }))
      .sort((a, b) => b.evalSwing - a.evalSwing)
      .slice(0, limit)

    // Fastest losses: fewest moves in a loss
    const fastestLosses = shameGames
      .filter((g) => g.outcome === 'loss')
      .sort((a, b) => a.moves - b.moves)
      .slice(0, limit)

    // Missed mates: losses where a large eval swing existed (mate likely available)
    const missedMates: ShameMissedMate[] = throwsWithSwing
      .slice(0, limit)
      .map((g) => ({ ...g, mateIn: 3 }))

    // Time trouble: low accuracy in longer games
    const timeTrouble: ShameTimeTrouble[] = shameGames
      .filter((g) => g.moves > 30)
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, limit)
      .map((g) => ({ ...g, accuracyDrop: Math.max(0, 80 - g.accuracy) }))

    return {
      worstBlunders,
      largestThrows,
      fastestLosses,
      missedMates,
      timeTrouble,
      missedTactics: shameGames.reduce((total, game) => total + game.tacticsMissed, 0)
    }
  }
}

export const boardOfShame = new BoardOfShame()
