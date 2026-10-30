import { Chess, type Square } from 'chess.js'
import { getDB } from '../database/connection'
import { DEFAULT_FEN } from '@pgn/types'
import type { GameFilters } from '@shared/game'

export type Color = 'w' | 'b'

export type TacticType =
  | 'fork'
  | 'pin'
  | 'skewer'
  | 'hanging'
  | 'double_attack'
  | 'discovered_attack'
  | 'clearance'
  | 'deflection'

export type TacticLabel = 'created' | 'missed' | 'defended' | 'none'

export type DetectedTactic = {
  id: string
  gameId: string
  ply: number
  san: string
  tacticType: TacticType
  label: TacticLabel
  side: Color
  description: string
  piece: string | null
  targetSquare: string | null
  targets: string[]
  value: number
  fenBefore: string
  fenAfter: string
}

export type TacticTally = {
  created: Record<TacticType, number>
  missed: Record<TacticType, number>
  defended: Record<TacticType, number>
}

export type GameTactics = {
  gameId: string
  totalPly: number
  white: TacticTally
  black: TacticTally
  tactics: DetectedTactic[]
}

export type TacticSummaryRow = {
  tacticType: TacticType
  side: Color
  label: TacticLabel
  count: number
}

const PIECE_VALUE: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 10000 }
const ALL_TYPES: TacticType[] = [
  'fork', 'pin', 'skewer', 'hanging', 'double_attack', 'discovered_attack', 'clearance', 'deflection'
]
const LINE_TYPES: string[] = ['r', 'b', 'q']
const DIRECTIONS: [number, number][] = [
  [0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]
]

function opponent(color: Color): Color {
  return color === 'w' ? 'b' : 'w'
}

function pieceValue(type: string): number {
  return PIECE_VALUE[type] ?? 0
}

function canMoveDirection(type: string, dx: number, dy: number): boolean {
  const orthogonal = dx === 0 || dy === 0
  const diagonal = Math.abs(dx) === Math.abs(dy)
  if (type === 'r') return orthogonal
  if (type === 'b') return diagonal
  if (type === 'q') return orthogonal || diagonal
  return false
}

function squareOffset(sq: Square, dx: number, dy: number): Square | null {
  const file = sq.charCodeAt(0) - 97
  const rank = Number(sq[1]) - 1
  const nf = file + dx
  const nr = rank + dy
  if (nf < 0 || nf > 7 || nr < 0 || nr > 7) return null
  return String.fromCharCode(97 + nf) + (nr + 1) as Square
}

function tacticKey(t: { tacticType: TacticType; targetSquare: string | null }): string {
  return `${t.tacticType}|${t.targetSquare ?? ''}`
}

function emptyTally(): TacticTally {
  const created: Record<TacticType, number> = {} as Record<TacticType, number>
  const missed: Record<TacticType, number> = {} as Record<TacticType, number>
  const defended: Record<TacticType, number> = {} as Record<TacticType, number>
  for (const t of ALL_TYPES) {
    created[t] = 0
    missed[t] = 0
    defended[t] = 0
  }
  return { created, missed, defended }
}

function detectPositionTactics(board: Chess, side: Color): DetectedTactic[] {
  const enemy = opponent(side)
  const tactics: DetectedTactic[] = []

  // Hanging: enemy pieces attacked by side and not adequately defended
  for (const t of ['p', 'n', 'b', 'r', 'q', 'k'] as const) {
    for (const sq of board.findPiece({ type: t, color: enemy })) {
      const attackers = board.attackers(sq, side)
      const defenders = board.attackers(sq, enemy)
      if (attackers.length === 0) continue
      const attackerValue = attackers.reduce((sum, a) => sum + pieceValue(board.get(a)!.type), 0)
      const defenderValue = defenders.reduce((sum, d) => sum + pieceValue(board.get(d)!.type), 0)
      if (defenders.length === 0 || attackerValue > defenderValue) {
        tactics.push({
          id: '',
          gameId: '',
          ply: 0,
          san: '',
          tacticType: 'hanging',
          label: 'none',
          side,
          description: `${t} on ${sq} en prise`,
          piece: t,
          targetSquare: sq,
          targets: attackers,
          value: pieceValue(board.get(sq)!.type),
          fenBefore: '',
          fenAfter: ''
        })
      }
    }
  }

  // Forks: a side piece attacking 2+ enemy pieces
  for (const t of ['p', 'n', 'b', 'r', 'q', 'k'] as const) {
    for (const sq of board.findPiece({ type: t, color: side })) {
      const moves = board.moves({ verbose: true, square: sq })
      const targets: string[] = []
      for (const m of moves) {
        const p = board.get(m.to)
        if (p && p.color === enemy) targets.push(m.to)
      }
      const uniq = [...new Set(targets)]
      if (uniq.length >= 2) {
        tactics.push({
          id: '',
          gameId: '',
          ply: 0,
          san: '',
          tacticType: 'fork',
          label: 'none',
          side,
          description: `${t} on ${sq} forks ${uniq.length} enemy pieces`,
          piece: t,
          targetSquare: sq,
          targets: uniq,
          value: uniq.reduce((sum, ts) => sum + pieceValue(board.get(ts as Square)!.type), 0),
          fenBefore: '',
          fenAfter: ''
        })
      }
    }
  }

  // Pins & skewers via ray scan from side line pieces
    for (const lt of LINE_TYPES) {
    for (const lsq of board.findPiece({ type: lt as 'r' | 'b' | 'q', color: side })) {
      for (const [dx, dy] of DIRECTIONS) {
        if (!canMoveDirection(lt, dx, dy)) continue
        let cur: Square | null = squareOffset(lsq, dx, dy)
        let firstEnemy: { sq: Square; type: string } | null = null
        while (cur) {
          const p = board.get(cur)
          if (p) {
            if (p.color === enemy) {
              if (!firstEnemy) {
                firstEnemy = { sq: cur, type: p.type }
              } else {
                const second = { sq: cur, type: p.type }
                if (second.type === 'k') {
                  tactics.push({
                    id: '', gameId: '', ply: 0, san: '', tacticType: 'pin', label: 'none', side,
                    description: `${firstEnemy.type} on ${firstEnemy.sq} pinned to king`,
                    piece: firstEnemy.type, targetSquare: firstEnemy.sq, targets: [cur],
                    value: pieceValue(firstEnemy.type), fenBefore: '', fenAfter: ''
                  })
                } else if (pieceValue(second.type) > pieceValue(firstEnemy.type)) {
                  tactics.push({
                    id: '', gameId: '', ply: 0, san: '', tacticType: 'pin', label: 'none', side,
                    description: `${firstEnemy.type} on ${firstEnemy.sq} pinned to ${second.type}`,
                    piece: firstEnemy.type, targetSquare: firstEnemy.sq, targets: [cur],
                    value: pieceValue(firstEnemy.type), fenBefore: '', fenAfter: ''
                  })
                } else if (pieceValue(firstEnemy.type) > pieceValue(second.type)) {
                  tactics.push({
                    id: '', gameId: '', ply: 0, san: '', tacticType: 'skewer', label: 'none', side,
                    description: `${firstEnemy.type} on ${firstEnemy.sq} skewered, exposing ${second.type}`,
                    piece: firstEnemy.type, targetSquare: firstEnemy.sq, targets: [cur],
                    value: pieceValue(firstEnemy.type), fenBefore: '', fenAfter: ''
                  })
                }
                break
              }
            } else {
              break
            }
          }
          cur = squareOffset(cur, dx, dy)
        }
      }
    }
  }

  return tactics
}

function detectMoveSpecific(
  boardBefore: Chess,
  boardAfter: Chess,
  move: { from: Square; to: Square; san: string } | null,
  side: Color
): DetectedTactic[] {
  const enemy = opponent(side)
  const tactics: DetectedTactic[] = []
  if (!move) return tactics

  const { from, to, san } = move

  // Double attack: move gives check and the moving piece attacks a valuable enemy piece
  if (boardAfter.inCheck()) {
    const movesFromTo = boardAfter.moves({ verbose: true, square: to })
    const valuableTargets: Square[] = []
    for (const m of movesFromTo) {
      const p = boardAfter.get(m.to)
      if (p && p.color === enemy && pieceValue(p.type) >= 500) valuableTargets.push(m.to)
    }
    if (valuableTargets.length > 0) {
      tactics.push({
        id: '', gameId: '', ply: 0, san, tacticType: 'double_attack', label: 'none', side,
        description: `check + attack on ${valuableTargets.length} valuable piece(s)`,
        piece: boardAfter.get(to)?.type ?? null, targetSquare: to, targets: valuableTargets,
        value: valuableTargets.reduce((sum, ts) => sum + pieceValue(boardAfter.get(ts)!.type), 0),
        fenBefore: '', fenAfter: ''
      })
    }
  }

  // Discovered attack: moving piece unmasked a side line piece that now attacks an enemy piece
  for (const [dx, dy] of DIRECTIONS) {
    const behind = squareOffset(from, -dx, -dy)
    if (!behind) continue
    const pBehind = boardBefore.get(behind)
    if (!pBehind || pBehind.color !== side || !LINE_TYPES.includes(pBehind.type)) continue
    if (!canMoveDirection(pBehind.type, dx, dy)) continue
    let cur: Square | null = squareOffset(from, dx, dy)
    while (cur) {
      const p = boardAfter.get(cur)
      if (p) {
        if (p.color === enemy) {
          tactics.push({
            id: '', gameId: '', ply: 0, san, tacticType: 'discovered_attack', label: 'none', side,
            description: `${pBehind.type} on ${behind} discovered attack on ${p.type} at ${cur}`,
            piece: pBehind.type, targetSquare: cur, targets: [cur],
            value: pieceValue(p.type), fenBefore: '', fenAfter: ''
          })
        }
        break
      }
      cur = squareOffset(cur, dx, dy)
    }
  }

  // Clearance: moving piece vacated `from`, opening a line for another side piece to attack an enemy piece
  for (const [dx, dy] of DIRECTIONS) {
    const behind = squareOffset(from, -dx, -dy)
    if (!behind) continue
    const pBehind = boardBefore.get(behind)
    if (!pBehind || pBehind.color !== side || !LINE_TYPES.includes(pBehind.type)) continue
    if (!canMoveDirection(pBehind.type, dx, dy)) continue
    let cur: Square | null = squareOffset(from, dx, dy)
    let hitEnemy: Square | null = null
    while (cur) {
      const p = boardAfter.get(cur)
      if (p) {
        if (p.color === enemy) hitEnemy = cur
        break
      }
      cur = squareOffset(cur, dx, dy)
    }
    if (hitEnemy && pBehind.type !== boardAfter.get(to)?.type) {
      tactics.push({
        id: '', gameId: '', ply: 0, san, tacticType: 'clearance', label: 'none', side,
        description: `cleared ${from} for ${pBehind.type} on ${behind}`,
        piece: pBehind.type, targetSquare: hitEnemy, targets: [hitEnemy],
        value: pieceValue(boardAfter.get(hitEnemy)!.type), fenBefore: '', fenAfter: ''
      })
    }
  }

  // Deflection: side captured an enemy defender of an enemy piece, leaving it hanging
  const captured = boardBefore.get(to)
  if (captured && captured.color === enemy) {
    for (const t of ['p', 'n', 'b', 'r', 'q'] as const) {
      for (const sq of boardAfter.findPiece({ type: t, color: enemy })) {
        if (sq === to) continue
        const defendersAfter = boardAfter.attackers(sq, enemy)
        const defendersBefore = boardBefore.attackers(sq, enemy)
        if (defendersBefore.length > 0 && defendersAfter.length === 0) {
          const attackers = boardAfter.attackers(sq, side)
          if (attackers.length > 0) {
            tactics.push({
              id: '', gameId: '', ply: 0, san, tacticType: 'deflection', label: 'none', side,
              description: `deflected defender, ${t} on ${sq} now hanging`,
              piece: t, targetSquare: sq, targets: attackers,
              value: pieceValue(t), fenBefore: '', fenAfter: ''
            })
          }
        }
      }
    }
  }

  return tactics
}

function buildWhere(filters: GameFilters): { where: string; params: unknown[] } {
  const conditions: string[] = []
  const params: unknown[] = []
  if (filters.source) { conditions.push('g.source = ?'); params.push(filters.source) }
  if (filters.result) { conditions.push('g.result = ?'); params.push(filters.result) }
  if (filters.outcome) { conditions.push('g.outcome = ?'); params.push(filters.outcome) }
  if (filters.timeClass) { conditions.push('g.time_class = ?'); params.push(filters.timeClass) }
  if (filters.search) {
    conditions.push('(g.white_player LIKE ? OR g.black_player LIKE ?)')
    const like = `%${filters.search}%`
    params.push(like, like)
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  return { where, params }
}

export class TacticalDetector {
  private get db() {
    return getDB()
  }

  private getGameMoves(gameId: string) {
    const rows = this.db.prepare(
      'SELECT ply, san, fen FROM game_moves WHERE game_id = ? ORDER BY move_number ASC'
    ).all(gameId) as Array<{ ply: number; san: string; fen: string }>
    return rows
  }

  private getAnalysisClassification(gameId: string): Map<number, string | null> {
    const rows = this.db.prepare(
      'SELECT ply, classification FROM engine_analysis WHERE game_id = ?'
    ).all(gameId) as Array<{ ply: number; classification: string | null }>
    const map = new Map<number, string | null>()
    for (const r of rows) map.set(r.ply, r.classification)
    return map
  }

  private clearTactics(gameId: string): void {
    this.db.prepare('DELETE FROM game_tactics WHERE game_id = ?').run(gameId)
  }

  private storeTactics(gameId: string, tactics: DetectedTactic[]): void {
    const tx = this.db.transaction(() => {
      const insert = this.db.prepare(
        `INSERT INTO game_tactics (game_id, ply, san, tactic_type, label, side, description, fen_before, fen_after, target_square)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      for (const t of tactics) {
        insert.run(gameId, t.ply, t.san, t.tacticType, t.label, t.side, t.description, t.fenBefore, t.fenAfter, t.targetSquare)
      }
    })
    tx()
  }

  private readStoredTactics(gameId: string): DetectedTactic[] | null {
    const rows = this.db.prepare(
      `SELECT ply, san, tactic_type, label, side, description, fen_before, fen_after, target_square
       FROM game_tactics WHERE game_id = ? ORDER BY ply ASC`
    ).all(gameId) as Array<{
      ply: number; san: string; tactic_type: TacticType; label: TacticLabel; side: Color;
      description: string; fen_before: string; fen_after: string; target_square: string | null
    }>
    if (rows.length === 0) return null
    return rows.map((r, i) => ({
      id: `stored-${i}`,
      gameId,
      ply: r.ply,
      san: r.san,
      tacticType: r.tactic_type,
      label: r.label,
      side: r.side,
      description: r.description,
      piece: null,
      targetSquare: r.target_square,
      targets: [],
      value: 0,
      fenBefore: r.fen_before,
      fenAfter: r.fen_after
    }))
  }

  analyzeGame(gameId: string): GameTactics {
    const stored = this.readStoredTactics(gameId)
    if (stored) {
      return this.buildGameTactics(gameId, stored)
    }

    const moves = this.getGameMoves(gameId)
    const classifications = this.getAnalysisClassification(gameId)
    const board = new Chess(DEFAULT_FEN)
    const allTactics: DetectedTactic[] = []

    for (let i = 0; i < moves.length; i++) {
      const m = moves[i]
      const side = board.turn() as Color
      const fenBefore = board.fen()

      const beforeTactics = detectPositionTactics(board, side)

      let moveObj: { from: Square; to: Square; san: string } | null = null
      try {
        const result = board.move(m.san)
        if (result) moveObj = { from: result.from as Square, to: result.to as Square, san: m.san }
      } catch {
        // ignore illegal move, continue with unchanged board
      }
      const fenAfter = board.fen()

      const afterTactics = detectPositionTactics(board, side)
      const moveSpecific = detectMoveSpecific(new Chess(fenBefore), board, moveObj, side)

      const beforeKeys = new Set(beforeTactics.map(tacticKey))
      const afterKeys = new Set(afterTactics.map(tacticKey))

      const created: DetectedTactic[] = []
      for (const t of afterTactics) {
        if (!beforeKeys.has(tacticKey(t))) {
          created.push({ ...t, label: 'created' })
        }
      }
      for (const t of moveSpecific) {
        created.push({ ...t, label: 'created' })
      }

      const missed: DetectedTactic[] = []
      if (created.length === 0) {
        for (const t of beforeTactics) {
          if (afterKeys.has(tacticKey(t))) {
            const cls = classifications.get(m.ply)
            if (cls === 'mistake' || cls === 'blunder' || !classifications.has(m.ply)) {
              missed.push({ ...t, label: 'missed' })
            }
          }
        }
      }

      const oppBefore = detectPositionTactics(new Chess(fenBefore), opponent(side))
      const oppAfter = detectPositionTactics(board, opponent(side))
      const oppAfterKeys = new Set(oppAfter.map(tacticKey))
      const defended: DetectedTactic[] = []
      for (const t of oppBefore) {
        if (!oppAfterKeys.has(tacticKey(t))) {
          defended.push({ ...t, label: 'defended', side })
        }
      }

      const plyTactics = [...created, ...missed, ...defended].map((t, idx) => ({
        ...t,
        id: `${gameId}-${m.ply}-${idx}`,
        gameId,
        ply: m.ply,
        san: m.san,
        fenBefore,
        fenAfter
      }))
      allTactics.push(...plyTactics)
    }

    this.clearTactics(gameId)
    this.storeTactics(gameId, allTactics)

    return this.buildGameTactics(gameId, allTactics)
  }

  getForGame(gameId: string): GameTactics {
    const stored = this.readStoredTactics(gameId)
    if (stored) return this.buildGameTactics(gameId, stored)
    return this.analyzeGame(gameId)
  }

  private buildGameTactics(gameId: string, tactics: DetectedTactic[]): GameTactics {
    const white = emptyTally()
    const black = emptyTally()
    for (const t of tactics) {
      const tally = t.side === 'w' ? white : black
      if (t.label === 'created') tally.created[t.tacticType]++
      else if (t.label === 'missed') tally.missed[t.tacticType]++
      else if (t.label === 'defended') tally.defended[t.tacticType]++
    }
    return { gameId, totalPly: tactics.length, white, black, tactics }
  }

  summary(filters: GameFilters = {}): TacticSummaryRow[] {
    const { where, params } = buildWhere(filters)
    const rows = this.db.prepare(
      `SELECT gt.tactic_type AS tacticType, gt.side AS side, gt.label AS label, COUNT(*) AS count
       FROM game_tactics gt
       JOIN games g ON g.id = gt.game_id
       ${where}
       GROUP BY gt.tactic_type, gt.side, gt.label
       ORDER BY count DESC`
    ).all(params) as Array<{
      tacticType: TacticType
      side: Color
      label: TacticLabel
      count: number
    }>
    return rows
  }
}

export const tacticalDetector = new TacticalDetector()
