import { useCallback } from 'react'
import { useStatsStore } from '@stats/store'
import type { GameFilters } from '@shared/game'

const SOURCE_OPTIONS = ['local', 'online', 'engine'] as const
const RESULT_OPTIONS = ['win', 'loss', 'draw'] as const
const OUTCOME_OPTIONS = ['win', 'loss', 'draw'] as const
const TIME_CLASS_OPTIONS = ['bullet', 'blitz', 'rapid', 'classical', 'daily'] as const

type FilterBarProps = {
  className?: string
  onFilterChange?: (filters: GameFilters) => void
  showSource?: boolean
  showResult?: boolean
  showOutcome?: boolean
  showTimeClass?: boolean
  showSearch?: boolean
}

export function FilterBar({
  className,
  onFilterChange,
  showSource = true,
  showResult = false,
  showOutcome = true,
  showTimeClass = true,
  showSearch = true
}: FilterBarProps) {
  const {
    filters,
    setFilters,
    setFilter
  } = useStatsStore()

  const handleSelect = useCallback((key: keyof GameFilters, value: string) => {
    setFilter(key, value)
    onFilterChange?.({ ...filters, [key]: value })
  }, [filters, setFilter, onFilterChange])

  const handleSearch = useCallback((value: string) => {
    setFilter('search', value || undefined)
    onFilterChange?.({ ...filters, search: value || undefined })
  }, [filters, setFilter, onFilterChange])

  return (
    <div className={`bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-3 ${className ?? ''}`}>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {showSource && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Source</label>
            <select
              value={filters.source ?? ''}
              onChange={(e) => handleSelect('source', e.target.value)}
              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
            >
              <option value="">All</option>
              {SOURCE_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        )}
        {showResult && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Result</label>
            <select
              value={filters.result ?? ''}
              onChange={(e) => handleSelect('result', e.target.value)}
              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
            >
              <option value="">All</option>
              {RESULT_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </option>
              ))}
            </select>
          </div>
        )}
        {showOutcome && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Outcome</label>
            <select
              value={filters.outcome ?? ''}
              onChange={(e) => handleSelect('outcome', e.target.value)}
              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
            >
              <option value="">All</option>
              {OUTCOME_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o.charAt(0).toUpperCase() + o.slice(1)}
                </option>
              ))}
            </select>
          </div>
        )}
        {showTimeClass && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Time Class</label>
            <select
              value={filters.timeClass ?? ''}
              onChange={(e) => handleSelect('timeClass', e.target.value)}
              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
            >
              <option value="">All</option>
              {TIME_CLASS_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
          </div>
        )}
        {showSearch && (
          <div className="flex flex-col">
            <label className="block text-xs font-medium text-gray-500 mb-1">Search</label>
            <input
              value={filters.search ?? ''}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
              placeholder="Player name..."
            />
          </div>
        )}
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        <span className="text-xs text-gray-500">
          {Object.keys(filters).length > 0 ? 'Filters active' : 'No filters'}
        </span>
        <button
          onClick={() => {
            setFilters({})
            onFilterChange?.({})
          }}
          className="text-xs text-blue-600 hover:underline"
          disabled={Object.keys(filters).length === 0}
        >
          Clear filters
        </button>
      </div>
    </div>
  )
}
