import { statisticsService } from '../statistics/StatisticsService'
import { analysisRepository } from './AnalysisRepository'
import { computeAccuracy, type AccuracyInput } from './calculateAccuracy'
import type { GameFilters, GameOutcome } from '@shared/game'

export type BoardGame = {
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
  timeClass: string | null
}

export type BoardMove = {
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

export type BoardUpset = BoardGame & {
  ratingDiff: number
}

export type BoardSacrifice = BoardMove & {
  evalSwing: number
}

export type BoardSummary = {
  bestGames: BoardGame[]
  bestMoves: BoardMove[]
  mostAccurateGames: BoardGame[]
  upsets: BoardUpset[]
  sacrifices: BoardSacrifice[]
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

export class BoardOfFame {
  summary(filters: GameFilters = {}, limit = 20): BoardSummary {
    const games = statisticsService.fetchGames(filters)

    const boardGames: BoardGame[] = []
    const allMoves: BoardMove[] = []

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

      boardGames.push({
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
        timeClass: g.timeClass
      })

      for (const p of plies) {
        if (!p.classification || (p.classification !== 'best' && p.classification !== 'excellent')) continue
        const acc = p.centipawn_loss !== null
          ? computeAccuracy([{ classification: p.classification, centipawnLoss: p.centipawn_loss }])
          : 100
        allMoves.push({
          id: `${g.id}-${p.ply}`,
          gameId: g.id,
          ply: p.ply,
          san: '',
          classification: p.classification,
          centipawnLoss: p.centipawn_loss,
          scoreCp: p.score_cp,
          scoreMate: p.score_mate,
          accuracy: acc,
          gameResult: g.result,
          gameOutcome: g.outcome,
          playedAt: g.playedAt,
          opponentRating: g.opponentRating
        })
      }
    }

    const byAccuracy = [...boardGames].sort((a, b) => b.accuracy - a.accuracy)
    const mostAccurateGames = byAccuracy.slice(0, limit)
    const bestGames = byAccuracy.slice(0, limit)

    const bestMoves = allMoves
      .sort((a, b) => {
        const ac = a.accuracy ?? 0
        const bc = b.accuracy ?? 0
        if (bc !== ac) return bc - ac
        const al = a.centipawnLoss ?? 0
        const bl = b.centipawnLoss ?? 0
        return bl - al
      })
      .slice(0, limit)

    // Upsets: wins where opponent rating exceeds player rating by >= 200
    const upsets: BoardUpset[] = boardGames
      .filter((g) => g.outcome === 'win' && g.playerRating != null && g.opponentRating != null && g.opponentRating! - g.playerRating! >= 200)
      .map((g) => ({ ...g, ratingDiff: (g.opponentRating! - g.playerRating!) }))
      .sort((a, b) => b.ratingDiff - a.ratingDiff)
      .slice(0, limit)

    // Sacrifices: best/excellent moves where eval improved significantly for us (centipawn_loss < 0)
    const sacrifices: BoardSacrifice[] = allMoves
      .filter((m) => m.centipawnLoss != null && m.centipawnLoss < -50)
      .map((m) => ({ ...m, evalSwing: Math.abs(m.centipawnLoss!) }))
      .sort((a, b) => b.evalSwing - a.evalSwing)
      .slice(0, limit)

    return { bestGames, bestMoves, mostAccurateGames, upsets, sacrifices }
  }
}

export const boardOfFame = new BoardOfFame()
