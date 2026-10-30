import { getDB } from '../database/connection'
import { buildWhere } from '../database/repositories/GameRepository'
import { engineService } from '../stockfish/EngineService'
import { analysisRepository } from '../analysis/AnalysisRepository'
import type { GameFilters } from '@shared/game'

export type PuzzleDifficulty = 'easy' | 'medium' | 'hard' | 'expert'

export type Puzzle = {
  id: string
  gameId: string
  ply: number
  san: string
  fenBefore: string
  fenAfter: string
  solutionSan: string
  solutionPv: string[]
  scoreCp: number | null
  scoreMate: number | null
  centipawnLoss: number | null
  difficulty: PuzzleDifficulty
  tacticType: string | null
  tacticLabel: string | null
  createdAt: number
}

export type PuzzleGenerateResult = {
  generated: number
  puzzles: Puzzle[]
}

const BLUNDER_CLASSIFICATIONS = new Set(['mistake', 'blunder'])

function rateDifficulty(centipawnLoss: number | null, ply: number, classification: string | null): PuzzleDifficulty {
  const cpl = centipawnLoss ?? 0
  if (cpl >= 800 || (classification === 'blunder' && cpl >= 500)) return 'expert'
  if (cpl >= 400 || (classification === 'blunder' && cpl >= 200)) return 'hard'
  if (cpl >= 150 || classification === 'mistake') return 'medium'
  return 'easy'
}

export class PuzzleGenerator {
  private get db() {
    return getDB()
  }

  private getGameMoves(gameId: string) {
    const rows = this.db.prepare(
      'SELECT ply, san, fen_before AS fenBefore, fen_after AS fenAfter FROM game_moves WHERE game_id = ? ORDER BY move_number ASC'
    ).all(gameId) as Array<{ ply: number; san: string; fenBefore: string; fenAfter: string }>
    return rows
  }

  private getAnalysisForGame(gameId: string) {
    const rows = analysisRepository.getAnalysisForGame(gameId)
    const map = new Map<number, {
      classification: string | null
      centipawnLoss: number | null
      bestmove: string | null
      pv: string[]
      scoreCp: number | null
      scoreMate: number | null
    }>()
    for (const r of rows) {
      map.set(r.ply, {
        classification: r.classification,
        centipawnLoss: r.centipawn_loss,
        bestmove: r.bestmove,
        pv: r.pv ?? [],
        scoreCp: r.score_cp,
        scoreMate: r.score_mate
      })
    }
    return map
  }

  private generatePuzzle(gameId: string, ply: number, san: string, fenBefore: string, fenAfter: string, analysis: {
    classification: string | null
    centipawnLoss: number | null
    bestmove: string | null
    pv: string[]
    scoreCp: number | null
    scoreMate: number | null
  }): Puzzle | null {
    const difficulty = rateDifficulty(analysis.centipawnLoss, ply, analysis.classification)
    const tacticType = analysis.classification === 'blunder' ? 'blunder' : analysis.classification === 'mistake' ? 'mistake' : null
    const tacticLabel = analysis.classification ?? null

    return {
      id: `${gameId}-${ply}`,
      gameId,
      ply,
      san,
      fenBefore,
      fenAfter,
      solutionSan: analysis.bestmove ?? '',
      solutionPv: analysis.pv,
      scoreCp: analysis.scoreCp,
      scoreMate: analysis.scoreMate,
      centipawnLoss: analysis.centipawnLoss,
      difficulty,
      tacticType,
      tacticLabel,
      createdAt: Date.now()
    }
  }

  private storePuzzle(puzzle: Puzzle): void {
    const existing = this.db.prepare('SELECT id FROM puzzles WHERE id = ?').get(puzzle.id)
    if (existing) return
    this.db.prepare(
      `INSERT INTO puzzles (id, game_id, ply, san, fen_before, fen_after, solution_san, solution_pv, score_cp, score_mate, centipawn_loss, difficulty, tactic_type, tactic_label, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      puzzle.id,
      puzzle.gameId,
      puzzle.ply,
      puzzle.san,
      puzzle.fenBefore,
      puzzle.fenAfter,
      puzzle.solutionSan,
      JSON.stringify(puzzle.solutionPv),
      puzzle.scoreCp,
      puzzle.scoreMate,
      puzzle.centipawnLoss,
      puzzle.difficulty,
      puzzle.tacticType,
      puzzle.tacticLabel,
      puzzle.createdAt
    )
  }

  private readPuzzles(filters: GameFilters = {}, limit = 50, offset = 0): { puzzles: Puzzle[]; total: number } {
    const { where, params } = buildWhere(filters)
    const totalRow = this.db.prepare(`SELECT COUNT(*) as c FROM puzzles p JOIN games g ON g.id = p.game_id ${where}`).all(params) as Array<{ c: number }>
    const total = totalRow[0]?.c ?? 0
    const orderDir = 'DESC'
    const rows = this.db.prepare(
      `SELECT p.id, p.game_id, p.ply, p.san, p.fen_before, p.fen_after, p.solution_san, p.solution_pv, p.score_cp, p.score_mate, p.centipawn_loss, p.difficulty, p.tactic_type, p.tactic_label, p.created_at
       FROM puzzles p
       JOIN games g ON g.id = p.game_id
       ${where}
       ORDER BY p.created_at ${orderDir}
       LIMIT ? OFFSET ?`
    ).all([...params, limit, offset]) as Array<{
      id: string
      game_id: string
      ply: number
      san: string
      fen_before: string
      fen_after: string
      solution_san: string
      solution_pv: string | null
      score_cp: number | null
      score_mate: number | null
      centipawn_loss: number | null
      difficulty: PuzzleDifficulty
      tactic_type: string | null
      tactic_label: string | null
      created_at: number
    }>
    return {
      total,
      puzzles: rows.map((r) => ({
        id: r.id,
        gameId: r.game_id,
        ply: r.ply,
        san: r.san,
        fenBefore: r.fen_before,
        fenAfter: r.fen_after,
        solutionSan: r.solution_san,
        solutionPv: r.solution_pv ? JSON.parse(r.solution_pv) : [],
        scoreCp: r.score_cp,
        scoreMate: r.score_mate,
        centipawnLoss: r.centipawn_loss,
        difficulty: r.difficulty,
        tacticType: r.tactic_type,
        tacticLabel: r.tactic_label,
        createdAt: r.created_at
      }))
    }
  }

  private readPuzzle(id: string): Puzzle | null {
    const row = this.db.prepare(
      `SELECT id, game_id, ply, san, fen_before, fen_after, solution_san, solution_pv, score_cp, score_mate, centipawn_loss, difficulty, tactic_type, tactic_label, created_at
       FROM puzzles WHERE id = ?`
    ).get(id) as {
      id: string
      game_id: string
      ply: number
      san: string
      fen_before: string
      fen_after: string
      solution_san: string
      solution_pv: string | null
      score_cp: number | null
      score_mate: number | null
      centipawn_loss: number | null
      difficulty: PuzzleDifficulty
      tactic_type: string | null
      tactic_label: string | null
      created_at: number
    } | undefined
    if (!row) return null
    return {
      id: row.id,
      gameId: row.game_id,
      ply: row.ply,
      san: row.san,
      fenBefore: row.fen_before,
      fenAfter: row.fen_after,
      solutionSan: row.solution_san,
      solutionPv: row.solution_pv ? JSON.parse(row.solution_pv) : [],
      scoreCp: row.score_cp,
      scoreMate: row.score_mate,
      centipawnLoss: row.centipawn_loss,
      difficulty: row.difficulty,
      tacticType: row.tactic_type,
      tacticLabel: row.tactic_label,
      createdAt: row.created_at
    }
  }

  async generate(filters: GameFilters = {}, maxPuzzles = 200): Promise<PuzzleGenerateResult> {
    await engineService.start()
    const games = this.fetchGames(filters)
    const generated: Puzzle[] = []
    let count = 0

    for (const game of games) {
      if (count >= maxPuzzles) break
      const moves = this.getGameMoves(game.id)
      const analysisMap = this.getAnalysisForGame(game.id)
      for (const m of moves) {
        if (count >= maxPuzzles) break
        const analysis = analysisMap.get(m.ply)
        if (!analysis) continue
        if (!BLUNDER_CLASSIFICATIONS.has(analysis.classification ?? '')) continue
        if ((analysis.centipawnLoss ?? 0) < 150) continue

        const puzzle = this.generatePuzzle(game.id, m.ply, m.san, m.fenBefore, m.fenAfter, analysis)
        if (!puzzle) continue

        // Ensure we have a Stockfish-computed solution (bestmove + PV)
        if (!puzzle.solutionSan || puzzle.solutionPv.length === 0) {
          try {
            const result = await engineService.analyzePosition(puzzle.fenBefore, {
              depth: 14,
              movetime: 1000
            })
            puzzle.solutionSan = result.bestmove ?? puzzle.solutionSan
            puzzle.solutionPv = result.pv ?? []
            puzzle.scoreCp = result.score?.type === 'cp' ? result.score.value : null
            puzzle.scoreMate = result.score?.type === 'mate' ? result.score.value : null
          } catch {
            // keep existing analysis-based solution
          }
        }

        this.storePuzzle(puzzle)
        generated.push(puzzle)
        count++
      }
    }

    return { generated: count, puzzles: generated }
  }

  private fetchGames(filters: GameFilters = {}) {
    const { where, params } = buildWhere(filters)
    const rows = this.db.prepare(
      `SELECT id FROM games ${where} ORDER BY played_at DESC`
    ).all(params) as Array<{ id: string }>
    return rows
  }

  list(filters: GameFilters = {}, limit = 50, offset = 0) {
    return this.readPuzzles(filters, limit, offset)
  }

  get(id: string) {
    return this.readPuzzle(id)
  }
}

export const puzzleGenerator = new PuzzleGenerator()
