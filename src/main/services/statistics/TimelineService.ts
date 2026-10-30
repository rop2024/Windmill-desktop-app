import { statisticsService } from './StatisticsService'
import type { GameFilters } from '@shared/game'

export type RatingPoint = {
  date: string
  rating: number
}

export type Milestone = {
  rating: number
  date: string | null
  achieved: boolean
}

export type TimelineData = {
  ratingProgression: RatingPoint[]
  milestones: Milestone[]
  firstRating: number | null
  currentRating: number | null
  ratingGain: number | null
  totalRatedGames: number
}

const MILESTONE_RATINGS = [1000, 1200, 1400, 1600, 1800, 2000, 2200]

function intensity(count: number): string {
  if (count === 0) return '#14141C'
  if (count <= 2) return '#1a3a24'
  if (count <= 4) return '#2d6a24'
  return '#5DFF6A'
}

export class TimelineService {
  private get activityByDate(): Map<string, number> {
    const map = new Map<string, number>()
    const progression = statisticsService.ratingHistory({})
    for (const p of progression) {
      map.set(p.date, (map.get(p.date) ?? 0) + 1)
    }
    return map
  }

  ratingProgression(filters: GameFilters = {}): RatingPoint[] {
    return statisticsService.ratingHistory(filters)
  }

  milestones(filters: GameFilters = {}): Milestone[] {
    const progression = statisticsService.ratingHistory(filters)
    const milestones: Milestone[] = []
    for (const target of MILESTONE_RATINGS) {
      let achievedDate: string | null = null
      for (const p of progression) {
        if (p.rating >= target) {
          achievedDate = p.date
          break
        }
      }
      milestones.push({ rating: target, date: achievedDate, achieved: achievedDate != null })
    }
    return milestones
  }

  summary(filters: GameFilters = {}): TimelineData {
    const progression = statisticsService.ratingHistory(filters)
    const ms = this.milestones(filters)
    const firstRating = progression.length > 0 ? progression[0].rating : null
    const currentRating = progression.length > 0 ? progression[progression.length - 1].rating : null
    const ratingGain = firstRating != null && currentRating != null ? currentRating - firstRating : null

    return {
      ratingProgression: progression,
      milestones: ms,
      firstRating,
      currentRating,
      ratingGain,
      totalRatedGames: progression.length
    }
  }
}

export const timelineService = new TimelineService()

export { intensity }
