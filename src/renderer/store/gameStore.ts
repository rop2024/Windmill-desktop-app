import { create } from 'zustand'
import { type Game, type GameFilters } from '@shared/game'

type GameState = {
  games: Game[]
  total: number
  filters: GameFilters
  page: number
  pageSize: number
  sort: { field: 'updated_at' | 'created_at' | 'result'; dir: 'asc' | 'desc' }
  loading: boolean
  importing: boolean
  importProgress: {
    processed: number
    total: number
    imported: number
    duplicates: number
    invalid: number
  } | null
  importReport: {
    found: number
    imported: number
    duplicates: number
    invalid: number
    errors: Array<{ gameIndex: number; message: string }>
  } | null
  setGames: (games: Game[], total: number) => void
  setFilters: (filters: Partial<GameFilters>) => void
  setPage: (page: number) => void
  setPageSize: (pageSize: number) => void
  setSort: (sort: { field: 'updated_at' | 'created_at' | 'result'; dir: 'asc' | 'desc' }) => void
  setLoading: (loading: boolean) => void
  setImporting: (importing: boolean) => void
  setImportProgress: (progress: { processed: number; total: number; imported: number; duplicates: number; invalid: number } | null) => void
  setImportReport: (report: { found: number; imported: number; duplicates: number; invalid: number; errors: Array<{ gameIndex: number; message: string }> } | null) => void
  resetImport: () => void
}

const DEFAULT_FILTERS: GameFilters = {}

export const useGameStore = create<GameState>((set) => ({
  games: [],
  total: 0,
  filters: DEFAULT_FILTERS,
  page: 1,
  pageSize: 50,
  sort: { field: 'updated_at', dir: 'desc' },
  loading: false,
  importing: false,
  importProgress: null,
  importReport: null,
  setGames: (games, total) => set({ games, total }),
  setFilters: (filters) => set((state) => ({ filters: { ...state.filters, ...filters }, page: 1 })),
  setPage: (page) => set({ page }),
  setPageSize: (pageSize) => set({ pageSize }),
  setSort: (sort) => set({ sort }),
  setLoading: (loading) => set({ loading }),
  setImporting: (importing) => set({ importing }),
  setImportProgress: (progress) => set({ importProgress: progress }),
  setImportReport: (report) => set({ importReport: report }),
  resetImport: () => set({ importProgress: null, importReport: null, importing: false })
}))
