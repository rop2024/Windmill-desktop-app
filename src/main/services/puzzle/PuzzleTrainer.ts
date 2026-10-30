import { getDB } from '../database/connection'
import { buildWhere } from '../database/repositories/GameRepository'
import type { GameFilters } from '@shared/game'
import type { Puzzle } from './PuzzleGenerator'

export type PuzzleSolve = {
  id: string
  puzzleId: string
  correct: boolean
  timeMs: number
  solvedAt: number
}

export type PuzzleSchedule = {
  puzzleId: string
  nextReview: number
  intervalDays: number
  easeFactor: number
  repetitions: number
  updatedAt: number
}

export type TrainerStats = {
  totalSolves: number
  correctSolves: number
  incorrectSolves: number
  solveRate: number
  avgTimeMs: number
  currentStreak: number
  bestStreak: number
  puzzlesSolved: number
}

export type TrainerSelectResult = {
  puzzle: Puzzle | null
  mode: 'daily' | 'weakness' | 'spaced'
  reason: string
}

function now(): number {
  return Date.now()
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

// SM-2 spaced repetition
function sm2(correct: boolean, schedule: PuzzleSchedule | null): PuzzleSchedule {
  const nowMs = now()
  let repetitions = schedule?.repetitions ?? 0
  let intervalDays = schedule?.intervalDays ?? 1
  let easeFactor = schedule?.easeFactor ?? 2.5

  if (correct) {
    if (repetitions === 0) intervalDays = 1
    else if (repetitions === 1) intervalDays = 6
    else intervalDays = Math.round(intervalDays * easeFactor)
    repetitions++
  } else {
    repetitions = 0
    intervalDays = 1
    easeFactor = Math.max(1.3, easeFactor - 0.2)
  }

  const nextReview = nowMs + intervalDays * 86400000
  return {
    puzzleId: schedule?.puzzleId ?? '',
    nextReview,
    intervalDays,
    easeFactor,
    repetitions,
    updatedAt: nowMs
  }
}

export class PuzzleTrainer {
  private get db() {
    return getDB()
  }

  private ensureSchedule(puzzleId: string): PuzzleSchedule {
    const row = this.db.prepare(
      'SELECT puzzle_id, next_review, interval_days, ease_factor, repetitions, updated_at FROM puzzle_schedule WHERE puzzle_id = ?'
    ).get(puzzleId) as PuzzleSchedule | undefined
    if (row) return row
    const schedule: PuzzleSchedule = {
      puzzleId,
      nextReview: now(),
      intervalDays: 1,
      easeFactor: 2.5,
      repetitions: 0,
      updatedAt: now()
    }
    this.db.prepare(
      'INSERT INTO puzzle_schedule (puzzle_id, next_review, interval_days, ease_factor, repetitions, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(schedule.puzzleId, schedule.nextReview, schedule.intervalDays, schedule.easeFactor, schedule.repetitions, schedule.updatedAt)
    return schedule
  }

  private saveSchedule(schedule: PuzzleSchedule): void {
    this.db.prepare(
      'INSERT INTO puzzle_schedule (puzzle_id, next_review, interval_days, ease_factor, repetitions, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(puzzle_id) DO UPDATE SET next_review = excluded.next_review, interval_days = excluded.interval_days, ease_factor = excluded.ease_factor, repetitions = excluded.repetitions, updated_at = excluded.updated_at'
    ).run(schedule.puzzleId, schedule.nextReview, schedule.intervalDays, schedule.easeFactor, schedule.repetitions, schedule.updatedAt)
  }

  private recordSolve(puzzleId: string, correct: boolean, timeMs: number): void {
    const id = crypto.randomUUID()
    this.db.prepare(
      'INSERT INTO puzzle_solves (id, puzzle_id, correct, time_ms, solved_at) VALUES (?, ?, ?, ?, ?)'
    ).run(id, puzzleId, correct ? 1 : 0, timeMs, now())
  }

  private getPuzzle(id: string): Puzzle | null {
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
      difficulty: Puzzle['difficulty']
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

  select(mode: 'daily' | 'weakness' | 'spaced' = 'daily', filters: GameFilters = {}): TrainerSelectResult {
    const { where, params } = buildWhere(filters)

    if (mode === 'daily') {
      const row = this.db.prepare(
        `SELECT p.id FROM puzzles p
         JOIN games g ON g.id = p.game_id
         ${where}
         ORDER BY p.created_at DESC
         LIMIT 1`
      ).all(params) as Array<{ id: string }>
      if (row.length > 0) {
        const puzzle = this.getPuzzle(row[0].id)
        return { puzzle, mode: 'daily', reason: 'Daily puzzle' }
      }
      return { puzzle: null, mode: 'daily', reason: 'No puzzles available' }
    }

    if (mode === 'spaced') {
      const due = this.db.prepare(
        `SELECT p.id FROM puzzles p
         JOIN puzzle_schedule s ON s.puzzle_id = p.id
         JOIN games g ON g.id = p.game_id
         ${where}
         AND s.next_review <= ?
         ORDER BY s.next_review ASC
         LIMIT 1`
      ).all([...params, now()]) as Array<{ id: string }>
      if (due.length > 0) {
        const puzzle = this.getPuzzle(due[0].id)
        return { puzzle, mode: 'spaced', reason: 'Due for review' }
      }
      return { puzzle: null, mode: 'spaced', reason: 'No puzzles due for review' }
    }

    // weakness mode - target puzzles matching weak categories via tactic type
    const rows = this.db.prepare(
      `SELECT p.id FROM puzzles p
       JOIN games g ON g.id = p.game_id
       ${where}
       AND p.tactic_type IS NOT NULL
       ORDER BY p.created_at DESC
       LIMIT 1`
    ).all(params) as Array<{ id: string }>
    const puzzleId = rows[0]?.id
    const p = puzzleId ? this.getPuzzle(puzzleId) : null
    return { puzzle: p, mode: 'weakness', reason: p ? 'Weakness-targeted puzzle' : 'No weakness-targeted puzzles' }
  }

  solve(puzzleId: string, correct: boolean, timeMs: number): { ok: boolean; schedule: PuzzleSchedule } {
    const schedule = this.ensureSchedule(puzzleId)
    this.recordSolve(puzzleId, correct, timeMs)
    const updated = sm2(correct, schedule)
    this.saveSchedule(updated)
    return { ok: true, schedule: updated }
  }

  stats(): TrainerStats {
    const rows = this.db.prepare(
      'SELECT correct, time_ms FROM puzzle_solves'
    ).all() as Array<{ correct: number; time_ms: number }>

    let total = 0
    let correct = 0
    let totalTime = 0
    for (const r of rows) {
      total++
      if (r.correct === 1) correct++
      totalTime += r.time_ms
    }
    const solveRate = total > 0 ? Math.round((correct / total) * 100) : 0
    const avgTimeMs = total > 0 ? Math.round(totalTime / total) : 0

    // Streaks: consecutive days with at least one correct solve
    const solveDays = this.db.prepare(
      `SELECT DISTINCT date(solved_at, 'unixepoch') as day FROM puzzle_solves WHERE correct = 1 ORDER BY day DESC`
    ).all() as Array<{ day: string }>
    let currentStreak = 0
    let bestStreak = 0
    let streak = 0
    let prevDay: string | null = null
    const today = todayKey()
    for (const d of solveDays) {
      if (prevDay === null) {
        // Most recent day
        if (d.day === today) {
          streak = 1
          currentStreak = 1
        } else {
          streak = 0
          currentStreak = 0
        }
      } else {
        const prevDate = new Date(prevDay)
        const currDate = new Date(d.day)
        const diffDays = Math.round((prevDate.getTime() - currDate.getTime()) / 86400000)
        if (diffDays === 1) {
          streak++
        } else {
          streak = 0
        }
      }
      if (streak > bestStreak) bestStreak = streak
      prevDay = d.day
    }
    if (prevDay !== null && prevDay !== today) currentStreak = 0

    const puzzlesSolved = this.db.prepare(
      'SELECT COUNT(DISTINCT puzzle_id) as c FROM puzzle_solves WHERE correct = 1'
    ).get() as { c: number }

    return {
      totalSolves: total,
      correctSolves: correct,
      incorrectSolves: total - correct,
      solveRate,
      avgTimeMs,
      currentStreak,
      bestStreak,
      puzzlesSolved: puzzlesSolved.c
    }
  }

  recentSolves(limit = 10): PuzzleSolve[] {
    const rows = this.db.prepare(
      `SELECT id, puzzle_id, correct, time_ms, solved_at FROM puzzle_solves ORDER BY solved_at DESC LIMIT ?`
    ).all([limit]) as Array<{
      id: string
      puzzle_id: string
      correct: number
      time_ms: number
      solved_at: number
    }>
    return rows.map((r) => ({
      id: r.id,
      puzzleId: r.puzzle_id,
      correct: r.correct === 1,
      timeMs: r.time_ms,
      solvedAt: r.solved_at
    }))
  }

  getSchedule(puzzleId: string): PuzzleSchedule | null {
    return this.ensureSchedule(puzzleId)
  }
}

export const puzzleTrainer = new PuzzleTrainer()
