import { weaknessEngine } from '../analysis/WeaknessEngine'
import type { GameFilters } from '@shared/game'

export type PlanItem = {
  area: string
  label: string
  action: string
  puzzles: number
  puzzleType: string | null
  priority: 'high' | 'medium' | 'low'
  completed: boolean
}

export type DailyPlan = {
  date: string
  summary: string
  items: PlanItem[]
  totalPuzzles: number
  weaknessSource: 'weakness-engine' | 'none'
}

const CATEGORY_LABEL: Record<string, string> = {
  opening: 'Opening',
  endgame: 'Endgame',
  kingSafety: 'King Safety',
  timePressure: 'Time Pressure',
  calculation: 'Calculation'
}

const CATEGORY_ACTION: Record<string, string> = {
  opening: 'Review your opening repertoire — study the first 10–15 moves of your main lines',
  endgame: 'Study basic endgames — king and pawn, rook endgames, and conversion technique',
  kingSafety: 'Focus on king safety — avoid unnecessary king moves and unsafe castling',
  timePressure: 'Practice faster time controls and improve time management',
  calculation: 'Practice tactics daily — focus on missed forks, pins, and hanging pieces'
}

const CATEGORY_PUZZLE_TYPE: Record<string, string | null> = {
  opening: null,
  endgame: 'endgame',
  kingSafety: 'king-safety',
  timePressure: null,
  calculation: 'tactics'
}

function puzzleCountFor(stars: number, base: number): number {
  if (stars <= 2) return Math.max(10, base)
  if (stars === 3) return Math.max(5, Math.round(base * 0.6))
  if (stars === 4) return Math.max(3, Math.round(base * 0.4))
  return 0
}

export class TrainingPlanner {
  dailyPlan(filters: GameFilters = {}): DailyPlan {
    const date = new Date().toISOString().slice(0, 10)
    const weakness = weaknessEngine.profile(filters)

    if (weakness.gamesAnalyzed === 0) {
      return {
        date,
        summary: "Today's Plan — run engine analysis on your games first to generate a training plan.",
        items: [],
        totalPuzzles: 0,
        weaknessSource: 'none'
      }
    }

    const focusAreas = [...weakness.categories].sort((a, b) => a.stars - b.stars).slice(0, 3)

    const items: PlanItem[] = []
    let totalPuzzles = 0

    for (const area of focusAreas) {
      const label = CATEGORY_LABEL[area.category] ?? area.category
      const action = CATEGORY_ACTION[area.category] ?? 'Keep playing and reviewing your games'
      const puzzleType = CATEGORY_PUZZLE_TYPE[area.category] ?? null
      const basePuzzles = area.category === 'timePressure' ? 5 : 10
      const puzzles = puzzleCountFor(area.stars, basePuzzles)
      const priority = area.stars <= 2 ? 'high' : area.stars === 3 ? 'medium' : 'low'

      items.push({
        area: area.category,
        label,
        action,
        puzzles,
        puzzleType,
        priority,
        completed: false
      })
      totalPuzzles += puzzles
    }

    if (items.length === 0) {
      items.push({
        area: 'general',
        label: 'General',
        action: 'Keep playing regularly — no major weaknesses detected. Solve a few tactic puzzles to stay sharp.',
        puzzles: 5,
        puzzleType: 'tactics',
        priority: 'low',
        completed: false
      })
      totalPuzzles = 5
    }

    const summary = this.buildSummary(items)

    return {
      date,
      summary,
      items,
      totalPuzzles,
      weaknessSource: weakness.gamesAnalyzed > 0 ? 'weakness-engine' : 'none'
    }
  }

  completeItem(): { ok: boolean } {
    // Completion tracking is stateless in this implementation; the UI re-fetches the plan each day.
    return { ok: true }
  }

  private buildSummary(items: PlanItem[]): string {
    const parts: string[] = []
    for (const item of items) {
      if (item.puzzles > 0) {
        parts.push(`${item.puzzles} ${item.label.toLowerCase()}`)
      } else {
        parts.push(`study ${item.label.toLowerCase()}`)
      }
    }
    if (parts.length === 0) {
      return "Today's Plan — keep playing and reviewing your games."
    }
    return `Today's Plan — ${parts.join(', ')}.`
  }
}

export const trainingPlanner = new TrainingPlanner()
