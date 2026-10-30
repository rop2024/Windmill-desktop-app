import { create } from 'zustand'
import { type GameFilters } from '@shared/game'

export type StatsView = 'overview' | 'rating' | 'color' | 'openings' | 'opponents' | 'timeControls' | 'streaks' | 'calendar'

type StatsState = {
  filters: GameFilters
  view: StatsView
  year: number | null
  loading: boolean
  setFilters: (filters: Partial<GameFilters>) => void
  setFilter: (key: keyof GameFilters, value: string | undefined) => void
  setView: (view: StatsView) => void
  setYear: (year: number | null) => void
  setLoading: (loading: boolean) => void
  resetFilters: () => void
}

const DEFAULT_FILTERS: GameFilters = {}

export const useStatsStore = create<StatsState>((set) => ({
  filters: DEFAULT_FILTERS,
  view: 'overview',
  year: null,
  loading: false,
  setFilters: (filters: Partial<GameFilters>) => set((state) => ({ filters: { ...state.filters, ...filters } })),
  setFilter: (key: keyof GameFilters, value: string | undefined) => set((state) => {
    const newFilters = { ...state.filters }
    if (value === undefined || value === '') {
      const newFiltersCopy = { ...newFilters }
      delete (newFiltersCopy as Record<string, unknown>)[key]
      return { filters: newFiltersCopy as GameFilters }
    }
    ;(newFilters as Record<keyof GameFilters, string | number | undefined>)[key] = value
    return { filters: newFilters }
  }),
  setView: (view: StatsView) => set({ view }),
  setYear: (year: number | null) => set({ year }),
  setLoading: (loading: boolean) => set({ loading }),
  resetFilters: () => set({ filters: DEFAULT_FILTERS })
}))
