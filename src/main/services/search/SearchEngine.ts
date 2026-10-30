import { getDB } from '../database/connection'
import { statisticsService } from '../statistics/StatisticsService'
import type { GameFilters, GameOutcome, GameResult, PlayerColor, TimeClass } from '@shared/game'

export type SearchResult = {
  id: string
  whitePlayer: string
  blackPlayer: string
  result: string
  outcome: GameOutcome | null
  playedAt: number | null
  playerColor: PlayerColor | null
  playerRating: number | null
  opponent: string | null
  opponentRating: number | null
  timeClass: TimeClass | null
  matchReasons: string[]
}

export type SearchQuery = {
  query: string
  filters: GameFilters & {
    tactic?: string
    endgame?: boolean
    sacrificed?: string
    mateMissed?: boolean
    timeTrouble?: boolean
  }
  limit?: number
  offset?: number
}

type ParsedQuery = {
  text: string
  result?: GameResult
  outcome?: GameOutcome
  tactic?: string
  endgame?: boolean
  sacrificed?: string
  mateMissed?: boolean
  timeTrouble?: boolean
  playerColor?: PlayerColor
  minRating?: number
  maxRating?: number
  minOpponentRating?: number
  maxOpponentRating?: number
  opening?: string
}

const RESULT_KEYWORDS: Record<string, GameResult> = {
  win: 'win', won: 'win', victory: 'win', victories: 'win',
  loss: 'loss', lost: 'loss', defeat: 'loss', defeats: 'loss',
  draw: 'draw', drawn: 'draw', tie: 'draw'
}

const OUTCOME_KEYWORDS: Record<string, GameOutcome> = {
  win: 'win', won: 'win', victory: 'win', victories: 'win',
  loss: 'loss', lost: 'loss', defeat: 'loss', defeats: 'loss',
  draw: 'draw', drawn: 'draw', tie: 'draw'
}

const TACTIC_KEYWORDS: Record<string, string> = {
  fork: 'fork', forks: 'fork',
  pin: 'pin', pins: 'pin',
  skewer: 'skewer', skewers: 'skewer',
  hanging: 'hanging', enprise: 'hanging',
  double: 'double_attack', 'double attack': 'double_attack',
  discovered: 'discovered_attack',
  clearance: 'clearance', deflection: 'deflection',
  sacrifice: 'sacrifice'
}

const PIECE_KEYWORDS: Record<string, string> = {
  rook: 'rook', rooks: 'rook',
  queen: 'queen', queens: 'queen',
  bishop: 'bishop', bishops: 'bishop',
  knight: 'knight', knights: 'knight',
  pawn: 'pawn', pawns: 'pawn'
}

const COLOR_KEYWORDS: Record<string, PlayerColor> = {
  white: 'w', black: 'b'
}

function parseQuery(query: string): ParsedQuery {
  const lower = query.toLowerCase().trim()
  const parsed: ParsedQuery = { text: query }

  // Result keywords
  for (const [kw, result] of Object.entries(RESULT_KEYWORDS)) {
    if (lower.includes(kw)) {
      parsed.result = result
      break
    }
  }

  // Outcome keywords
  for (const [kw, outcome] of Object.entries(OUTCOME_KEYWORDS)) {
    if (lower.includes(kw)) {
      parsed.outcome = outcome
      break
    }
  }

  // Tactic keywords
  for (const [kw, tactic] of Object.entries(TACTIC_KEYWORDS)) {
    if (lower.includes(kw)) {
      parsed.tactic = tactic
      break
    }
  }

  // Sacrificed piece detection: "sacrificed a rook", "queen sacrifice", etc.
  for (const [piece, pieceName] of Object.entries(PIECE_KEYWORDS)) {
    if (lower.includes(`sacrificed ${piece}`) || lower.includes(`sacrifice ${piece}`) || lower.includes(`${piece} sacrifice`)) {
      parsed.sacrificed = pieceName
      break
    }
  }

  // Endgame detection
  if (lower.includes('endgame') || lower.includes('end game') || lower.includes('rook endgame')) {
    parsed.endgame = true
  }

  // Missed mate detection
  if (lower.includes('missed mate') || lower.includes('mate in') || lower.includes('checkmate')) {
    parsed.mateMissed = true
  }

  // Time trouble detection
  if (lower.includes('time trouble') || lower.includes('time pressure') || lower.includes('time control')) {
    parsed.timeTrouble = true
  }

  // Color keywords
  for (const [kw, color] of Object.entries(COLOR_KEYWORDS)) {
    if (lower.includes(`as ${kw}`) || lower.includes(`playing ${kw}`) || lower.includes(`with ${kw}`)) {
      parsed.playerColor = color
      break
    }
  }

  // Rating ranges: "rated 1500+" or "opponent 1800+"
  const ratingMatch = lower.match(/(\d{3,4})\s*[+-]/)
  if (ratingMatch) {
    parsed.minRating = parseInt(ratingMatch[1], 10)
  }

  // Opening keyword search
  const openingKeywords = ['sicilian', 'french', 'caro', 'ruy', 'spanish', 'italian', 'queen', 'king', 'english', 'reti', 'dutch', 'nimzo', 'grunfeld', 'king indian', 'dragon', 'scandinavian', 'alekhine']
  for (const kw of openingKeywords) {
    if (lower.includes(kw)) {
      parsed.opening = kw
      break
    }
  }

  return parsed
}

export class SearchEngine {
  private get db() {
    return getDB()
  }

  search(query: string, limit = 50, offset = 0): { results: SearchResult[]; total: number; filters: SearchQuery['filters'] } {
    const parsed = parseQuery(query)

    // Build base filters
    const filters: GameFilters = {}
    if (parsed.result) filters.result = parsed.result
    if (parsed.outcome) filters.outcome = parsed.outcome

    const searchFilters: SearchQuery['filters'] = {
      ...filters,
      tactic: parsed.tactic,
      endgame: parsed.endgame,
      sacrificed: parsed.sacrificed,
      mateMissed: parsed.mateMissed,
      timeTrouble: parsed.timeTrouble
    }

    // Get all candidate games via base SQL filters
    const baseGames = statisticsService.fetchGames(filters)

    // If there's a text search, filter games by PGN/player name
    let candidateGames = baseGames
    if (parsed.text) {
      candidateGames = candidateGames.filter((g: ReturnType<typeof statisticsService.fetchGames>[number]) =>
        (g.whitePlayer ?? '').toLowerCase().includes(parsed.text.toLowerCase()) ||
        (g.blackPlayer ?? '').toLowerCase().includes(parsed.text.toLowerCase()) ||
        (g.pgn ?? '').toLowerCase().includes(parsed.text.toLowerCase())
      )
    }

    // Apply tactical/endgame/rating/sacrifice filters via per-game analysis
    const results: SearchResult[] = []
    for (const g of candidateGames) {
      const reasons: string[] = []

      // Text match reason
      if (parsed.text) {
        const pgnLower = (g.pgn ?? '').toLowerCase()
        if (pgnLower.includes(parsed.text.toLowerCase()) || (g.whitePlayer ?? '').toLowerCase().includes(parsed.text.toLowerCase()) || (g.blackPlayer ?? '').toLowerCase().includes(parsed.text.toLowerCase())) {
          reasons.push(`Matches "${parsed.text}"`)
        }
      }

      // Tactic filter: check game_tactics
      if (parsed.tactic) {
        const tactics = this.getGameTactics(g.id)
        const matchingTactics = tactics.filter((t) => t.tacticType === parsed.tactic)
        if (matchingTactics.length > 0) {
          reasons.push(`${parsed.tactic} detected (${matchingTactics.length}x)`)
        } else {
          continue // filter out
        }
      }

      // Sacrificed piece: check for eval swings in own moves
      if (parsed.sacrificed) {
        const plies = this.getGameAnalysisPlys(g.id)
        const ownColor = g.playerColor
        const ownPlies = plies.filter((p) => {
          if (!ownColor) return true
          return (ownColor === 'w' && p.ply % 2 === 1) || (ownColor === 'b' && p.ply % 2 === 0)
        })
        const hasSacrifice = ownPlies.some((p) => {
          const cpl = p.centipawnLoss ?? 0
          // Large negative CPL means we gained eval (sacrifice led to advantage)
          return cpl < -300
        })
        if (hasSacrifice) {
          reasons.push(`${parsed.sacrificed} sacrifice detected`)
        } else {
          continue
        }
      }

      // Endgame filter: blunder in late game (ply > 40)
      if (parsed.endgame) {
        const plies = this.getGameAnalysisPlys(g.id)
        const latePlies = plies.filter((p) => p.ply > 40)
        const hasEndgameBlunder = latePlies.some((p) => p.classification === 'mistake' || p.classification === 'blunder')
        if (hasEndgameBlunder) {
          reasons.push('Blunder in endgame (ply > 40)')
        } else {
          continue
        }
      }

      // Missed mate: large eval swing suggesting missed mate
      if (parsed.mateMissed) {
        const plies = this.getGameAnalysisPlys(g.id)
        const hasMateSwing = plies.some((p) => {
          const cpl = Math.abs(p.centipawnLoss ?? 0)
          return cpl > 800
        })
        if (hasMateSwing) {
          reasons.push('Possible missed mate (large eval swing)')
        } else {
          continue
        }
      }

      // Time trouble: blunder late in game (last 20% of plies)
      if (parsed.timeTrouble) {
        const plies = this.getGameAnalysisPlys(g.id)
        const maxPly = Math.max(...plies.map((p) => p.ply), 0)
        const latePlies = plies.filter((p) => p.ply > maxPly * 0.8)
        const hasLateBlunder = latePlies.some((p) => p.classification === 'mistake' || p.classification === 'blunder')
        if (hasLateBlunder) {
          reasons.push('Time trouble blunder (late game)')
        } else {
          continue
        }
      }

      // Rating range filters
      if (parsed.minRating != null && g.playerRating != null && g.playerRating < parsed.minRating) continue
      if (parsed.maxRating != null && g.playerRating != null && g.playerRating > parsed.maxRating) continue
      if (parsed.minOpponentRating != null && g.opponentRating != null && g.opponentRating < parsed.minOpponentRating) continue
      if (parsed.maxOpponentRating != null && g.opponentRating != null && g.opponentRating > parsed.maxOpponentRating) continue

      // Opening keyword filter via PGN Opening tag
      if (parsed.opening) {
        const openingMatch = (g.pgn ?? '').match(/\[Opening "([^"]+)"/i)
        if (!openingMatch || !openingMatch[1].toLowerCase().includes(parsed.opening)) continue
        reasons.push(`Opening: ${openingMatch[1]}`)
      }

      results.push({
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
        timeClass: g.timeClass,
        matchReasons: reasons
      })
    }

    // Sort by played_at desc (most recent first)
    results.sort((a, b) => {
      const pa = a.playedAt ?? 0
      const pb = b.playedAt ?? 0
      return pb - pa
    })

    const total = results.length
    const page = results.slice(offset, offset + limit)

    return { results: page, total, filters: searchFilters }
  }

  private getGameTactics(gameId: string): Array<{ tacticType: string; label: string; side: string }> {
    const rows = this.db.prepare(
      'SELECT tactic_type, label, side FROM game_tactics WHERE game_id = ?'
    ).all(gameId) as Array<{ tactic_type: string; label: string; side: string }>
    return rows.map((r) => ({ tacticType: r.tactic_type, label: r.label, side: r.side }))
  }

  private getGameAnalysisPlys(gameId: string): Array<{ ply: number; classification: string | null; centipawnLoss: number | null }> {
    const rows = this.db.prepare(
      'SELECT ply, classification, centipawn_loss FROM engine_analysis WHERE game_id = ? ORDER BY ply ASC'
    ).all(gameId) as Array<{ ply: number; classification: string | null; centipawn_loss: number | null }>
    return rows.map((r) => ({ ply: r.ply, classification: r.classification, centipawnLoss: r.centipawn_loss }))
  }

  parseQuery(query: string): ParsedQuery {
    return parseQuery(query)
  }
}

export const searchEngine = new SearchEngine()
