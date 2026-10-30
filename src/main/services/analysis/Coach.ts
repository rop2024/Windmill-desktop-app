import { statisticsService } from '../statistics/StatisticsService'
import { weaknessEngine } from '../analysis/WeaknessEngine'
import { tacticalDetector } from '../analysis/TacticalDetector'
import { puzzleTrainer } from '../puzzle/PuzzleTrainer'
import type { GameFilters } from '@shared/game'

export type CoachReport = {
  period: 'weekly' | 'monthly'
  from: string
  to: string
  gamesAnalyzed: number
  winRate: number
  ratingChange: string
  keyInsights: string[]
  focusAreas: FocusArea[]
  trainingPlan: TrainingPlanItem[]
}

export type FocusArea = {
  category: string
  stars: number
  label: string
  reason: string
}

export type TrainingPlanItem = {
  area: string
  action: string
  puzzles: number
  priority: 'high' | 'medium' | 'low'
}

export type DailyAdvice = {
  date: string
  advice: string
  focusArea: FocusArea | null
  puzzleSuggestion: string | null
  reason: string
}

export type CoachTrainingPlan = {
  focusAreas: FocusArea[]
  plan: TrainingPlanItem[]
  totalPuzzles: number
}

function dateRange(days: number): { from: number; to: number } {
  const to = Date.now()
  const from = to - days * 86400000
  return { from, to }
}

function fmtDate(ms: number | null): string {
  if (!ms) return '—'
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

class Coach {
  private filterForRange(days: number, filters: GameFilters = {}): GameFilters {
    const { from, to } = dateRange(days)
    return { ...filters, _rangeFrom: from, _rangeTo: to } as GameFilters & { _rangeFrom?: number; _rangeTo?: number }
  }

  private rangeGames(days: number, filters: GameFilters = {}) {
    const rangeFilters = this.filterForRange(days, filters)
    return statisticsService.fetchGames(rangeFilters)
  }

  private buildFocusAreas(weakness: ReturnType<typeof weaknessEngine.profile>): FocusArea[] {
    const sorted = [...weakness.categories].sort((a, b) => a.stars - b.stars)
    return sorted.slice(0, 3).map((c) => ({
      category: c.category,
      stars: c.stars,
      label: c.label,
      reason: `${c.signal} — ${c.errors} errors across ${c.moves} moves`
    }))
  }

  private buildTrainingPlan(focusAreas: FocusArea[], puzzleStats: ReturnType<typeof puzzleTrainer.stats>): TrainingPlanItem[] {
    const plan: TrainingPlanItem[] = []
    const puzzleTarget = puzzleStats.puzzlesSolved > 0 ? Math.max(5, Math.round(puzzleStats.puzzlesSolved * 0.2)) : 10

    for (const area of focusAreas) {
      let action = ''
      let priority: 'high' | 'medium' | 'low' = 'medium'
      let puzzles = puzzleTarget

      switch (area.category) {
        case 'calculation':
          action = 'Practice tactics daily — focus on missed forks, pins, and hanging pieces'
          priority = area.stars <= 2 ? 'high' : 'medium'
          break
        case 'opening':
          action = 'Review your opening repertoire — study the first 10–15 moves of your main lines'
          priority = area.stars <= 2 ? 'high' : 'medium'
          puzzles = Math.max(3, Math.round(puzzleTarget * 0.5))
          break
        case 'endgame':
          action = 'Study basic endgames — king and pawn, rook endgames, and conversion technique'
          priority = area.stars <= 2 ? 'high' : 'medium'
          puzzles = Math.max(3, Math.round(puzzleTarget * 0.5))
          break
        case 'kingSafety':
          action = 'Focus on king safety — avoid unnecessary king moves and unsafe castling'
          priority = area.stars <= 2 ? 'high' : 'medium'
          puzzles = Math.max(3, Math.round(puzzleTarget * 0.4))
          break
        case 'timePressure':
          action = 'Practice faster time controls and improve time management'
          priority = area.stars <= 2 ? 'medium' : 'low'
          puzzles = Math.max(2, Math.round(puzzleTarget * 0.3))
          break
        default:
          action = 'Keep playing and reviewing your games'
          priority = 'low'
          puzzles = Math.max(3, Math.round(puzzleTarget * 0.3))
      }

      plan.push({ area: area.category, action, puzzles, priority })
    }

    return plan
  }

  weeklyReport(filters: GameFilters = {}): CoachReport {
    const { from, to } = dateRange(7)
    const games = this.rangeGames(7, filters)
    const weeklyGames = games.filter((g) => g.playedAt != null && g.playedAt >= from && g.playedAt <= to)

    const overview = statisticsService.overview(this.filterForRange(7, filters))
    const ratingHist = statisticsService.ratingHistory(this.filterForRange(7, filters))
    const weakness = weaknessEngine.profile(this.filterForRange(7, filters))
    const puzzleStats = puzzleTrainer.stats()

    const wins = weeklyGames.filter((g) => g.outcome === 'win').length
    const losses = weeklyGames.filter((g) => g.outcome === 'loss').length
    const draws = weeklyGames.filter((g) => g.outcome === 'draw').length

    const focusAreas = this.buildFocusAreas(weakness)
    const plan = this.buildTrainingPlan(focusAreas, puzzleStats)

    const insights: string[] = []
    if (weeklyGames.length > 0) {
      insights.push(`You played ${weeklyGames.length} game${weeklyGames.length !== 1 ? 's' : ''} this week (${wins}W / ${losses}L / ${draws}D).`)
    } else {
      insights.push('No games recorded this week. Play some games to get coaching advice.')
    }
    if (ratingHist.length >= 2) {
      const change = ratingHist[ratingHist.length - 1].rating - ratingHist[0].rating
      insights.push(`Rating changed by ${change > 0 ? '+' : ''}${change} this week.`)
    }
    const topWeakness = weakness.topWeakness
    if (topWeakness) {
      insights.push(`Your biggest weakness is ${weakness.categories.find((c) => c.category === topWeakness)?.label ?? topWeakness}.`)
    }
    if (weakness.trend === 'improving') {
      insights.push('Your accuracy trend is improving — keep it up!')
    } else if (weakness.trend === 'declining') {
      insights.push('Your accuracy trend is declining — consider focusing on fundamentals.')
    }

    return {
      period: 'weekly',
      from: fmtDate(from),
      to: fmtDate(to),
      gamesAnalyzed: weeklyGames.length,
      winRate: overview.winRate,
      ratingChange: ratingHist.length >= 2 ? `${ratingHist[0].rating} → ${ratingHist[ratingHist.length - 1].rating}` : '—',
      keyInsights: insights,
      focusAreas,
      trainingPlan: plan
    }
  }

  monthlyReport(filters: GameFilters = {}): CoachReport {
    const { from, to } = dateRange(30)
    const games = this.rangeGames(30, filters)
    const monthlyGames = games.filter((g) => g.playedAt != null && g.playedAt >= from && g.playedAt <= to)

    const overview = statisticsService.overview(this.filterForRange(30, filters))
    const ratingHist = statisticsService.ratingHistory(this.filterForRange(30, filters))
    const weakness = weaknessEngine.profile(this.filterForRange(30, filters))
    const puzzleStats = puzzleTrainer.stats()
    const tactics = tacticalDetector.summary(this.filterForRange(30, filters))

    const wins = monthlyGames.filter((g) => g.outcome === 'win').length
    const losses = monthlyGames.filter((g) => g.outcome === 'loss').length
    const draws = monthlyGames.filter((g) => g.outcome === 'draw').length

    const focusAreas = this.buildFocusAreas(weakness)
    const plan = this.buildTrainingPlan(focusAreas, puzzleStats)

    const insights: string[] = []
    if (monthlyGames.length > 0) {
      insights.push(`You played ${monthlyGames.length} game${monthlyGames.length !== 1 ? 's' : ''} this month (${wins}W / ${losses}L / ${draws}D).`)
    } else {
      insights.push('No games recorded this month. Play some games to get coaching advice.')
    }
    if (ratingHist.length >= 2) {
      const change = ratingHist[ratingHist.length - 1].rating - ratingHist[0].rating
      insights.push(`Rating changed by ${change > 0 ? '+' : ''}${change} this month.`)
    }
    const missedTactics = tactics.filter((t) => t.label === 'missed').reduce((s, t) => s + t.count, 0)
    if (missedTactics > 0) {
      insights.push(`You missed ${missedTactics} tactical opportunities this month.`)
    }
    const topWeakness = weakness.topWeakness
    if (topWeakness) {
      insights.push(`Focus on ${weakness.categories.find((c) => c.category === topWeakness)?.label ?? topWeakness} — your lowest-rated category.`)
    }

    return {
      period: 'monthly',
      from: fmtDate(from),
      to: fmtDate(to),
      gamesAnalyzed: monthlyGames.length,
      winRate: overview.winRate,
      ratingChange: ratingHist.length >= 2 ? `${ratingHist[0].rating} → ${ratingHist[ratingHist.length - 1].rating}` : '—',
      keyInsights: insights,
      focusAreas,
      trainingPlan: plan
    }
  }

  dailyAdvice(filters: GameFilters = {}): DailyAdvice {
    const weakness = weaknessEngine.profile(this.filterForRange(7, filters))
    const focusAreas = this.buildFocusAreas(weakness)
    const topArea = focusAreas[0]

    const tactics = tacticalDetector.summary(this.filterForRange(7, filters))
    const missedTactics = tactics.filter((t) => t.label === 'missed').reduce((s, t) => s + t.count, 0)

    let advice = ''
    let puzzleSuggestion: string | null = null
    let reason = ''

    if (topArea) {
      advice = `Today, focus on ${topArea.label} (${topArea.stars}★). ${topArea.reason}`
      reason = topArea.reason
      if (topArea.category === 'calculation' && missedTactics > 0) {
        puzzleSuggestion = `Solve ${Math.max(5, missedTactics)} tactic puzzles — prioritize forks and pins you missed.`
      } else if (topArea.category === 'opening') {
        puzzleSuggestion = 'Review your opening lines — play through the first 10 moves of your main repertoire.'
      } else if (topArea.category === 'endgame') {
        puzzleSuggestion = 'Practice basic endgame conversions — king and pawn vs king, rook endgames.'
      } else if (topArea.category === 'kingSafety') {
        puzzleSuggestion = 'Study king-safety puzzles — avoid moving your king unnecessarily in the opening.'
      } else if (topArea.category === 'timePressure') {
        puzzleSuggestion = 'Play a few blitz games to practice time management under pressure.'
      } else {
        puzzleSuggestion = 'Keep playing and review your losses for patterns.'
      }
    } else {
      advice = 'Keep playing regularly — no major weaknesses detected. Maintain your current routine.'
      reason = 'All categories are at average or better strength.'
      puzzleSuggestion = 'Solve 5–10 tactic puzzles to stay sharp.'
    }

    return {
      date: new Date().toISOString().slice(0, 10),
      advice,
      focusArea: topArea ?? null,
      puzzleSuggestion,
      reason
    }
  }

  trainingPlan(filters: GameFilters = {}): CoachTrainingPlan {
    const weakness = weaknessEngine.profile(this.filterForRange(30, filters))
    const puzzleStats = puzzleTrainer.stats()
    const focusAreas = this.buildFocusAreas(weakness)
    const plan = this.buildTrainingPlan(focusAreas, puzzleStats)
    const totalPuzzles = plan.reduce((sum, p) => sum + p.puzzles, 0)
    return { focusAreas, plan, totalPuzzles }
  }
}

export const coach = new Coach()
