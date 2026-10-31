import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useGameStore } from '@renderer/store/gameStore'
import { PrimaryButton } from '../components/ui/PrimaryButton'
import { FilterChip } from '../components/ui/FilterChip'
import { Panel } from '../components/ui/Panel'
import { StatusLabel } from '../components/ui/StatusLabel'

const RESULT_OPTIONS = ['win', 'loss', 'draw'] as const
const SOURCE_OPTIONS = ['local', 'online', 'engine'] as const

export default function Games() {
  const navigate = useNavigate()
  const {
    games,
    total,
    filters,
    page,
    pageSize,
    loading,
    importing,
    importProgress,
    setGames,
    setFilters,
    setPage,
    setPageSize,
    setLoading,
    setImporting,
    setImportProgress,
    setImportReport,
    resetImport,
  } = useGameStore()

  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null)
  const tableRef = useRef<HTMLDivElement>(null)
  const rowRefs = useRef<HTMLTableRowElement[]>([])
  const progressUnsubscribe = useRef<(() => void) | null>(null)
  const [error, setError] = useState<string | null>(null)

  const offset = (page - 1) * pageSize

  useEffect(() => {
    if (progressUnsubscribe.current) progressUnsubscribe.current()
    progressUnsubscribe.current = window.api.onImportProgress((progress: unknown) => {
      const p = progress as { processed: number; total: number; imported: number; duplicates: number; invalid: number }
      setImportProgress({
        processed: p.processed,
        total: p.total,
        imported: p.imported,
        duplicates: p.duplicates,
        invalid: p.invalid,
      })
    })
    return () => {
      if (progressUnsubscribe.current) progressUnsubscribe.current()
    }
  }, [setImportProgress])

  const fetchGames = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await window.api.games.query(filters, pageSize, offset)
      if (result.ok) {
        setGames(result.data.games, result.data.total)
      } else {
        setError(result.error?.message ?? 'Failed to load games')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [filters, pageSize, offset, setGames, setLoading])

  useEffect(() => {
    fetchGames()
  }, [fetchGames])

  const handleSearch = useCallback((value: string) => {
    if (debounceTimer) clearTimeout(debounceTimer)
    const timer = setTimeout(() => {
      setFilters({ search: value || undefined })
    }, 300)
    setDebounceTimer(timer)
  }, [debounceTimer, setFilters])

  useEffect(() => () => { if (debounceTimer) clearTimeout(debounceTimer) }, [debounceTimer])

  const handleImport = async () => {
    setImporting(true)
    resetImport()
    setImportProgress({ processed: 0, total: 0, imported: 0, duplicates: 0, invalid: 0 })
    try {
      const pick = await window.api.pgn.importPick()
      if (!pick.ok || !pick.data?.path) return
      const report = await window.api.pgn.import(pick.data.path)
      if (report.ok) {
        setImportReport(report.data)
        setImportProgress({
          processed: report.data.found,
          total: report.data.found,
          imported: report.data.imported,
          duplicates: report.data.duplicates,
          invalid: report.data.invalid,
        })
        const result = await window.api.games.query(filters, pageSize, offset)
        if (result.ok) setGames(result.data.games, result.data.total)
      } else {
        setImportProgress({
          processed: 0,
          total: 0,
          imported: 0,
          duplicates: 0,
          invalid: 0,
        })
      }
    } finally {
      setImporting(false)
    }
  }

  const rowVirtualizer = useVirtualizer({
    count: games.length,
    getScrollElement: () => tableRef.current!,
    estimateSize: () => 52,
    overscan: 10,
  })

  const handleRowClick = (game: { id: string }) => {
    navigate(`/explorer/${game.id}`)
  }

  const resultAccent = (outcome: string): 'green' | 'pink' | 'orange' | 'cyan' => {
    switch (outcome.toLowerCase()) {
      case 'win': return 'green'
      case 'loss': return 'pink'
      case 'draw': return 'orange'
      default: return 'cyan'
    }
  }

  const pages = Math.ceil(total / pageSize) || 1

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-filter uppercase text-cyan">// games</span>
          <h1 className="text-page-title font-sans font-bold uppercase text-text-primary">
            Games
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <PrimaryButton onClick={handleImport} disabled={importing}>
            Import PGN
          </PrimaryButton>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <span className="font-mono text-filter uppercase text-text-dim">Result</span>
        {RESULT_OPTIONS.map((r) => (
          <FilterChip
            key={r}
            selected={filters.outcome === r}
            onClick={() => setFilters({ outcome: filters.outcome === r ? undefined : r })}
          >
            {r.charAt(0).toUpperCase() + r.slice(1)}
          </FilterChip>
        ))}
        <span className="font-mono text-filter uppercase text-text-dim">Source</span>
        {SOURCE_OPTIONS.map((s) => (
          <FilterChip
            key={s}
            selected={filters.source === s}
            onClick={() => setFilters({ source: filters.source === s ? undefined : s })}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </FilterChip>
        ))}
      </div>

      {error && (
        <Panel accent="pink">
          <span className="text-xs font-mono text-pink">{error}</span>
        </Panel>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="font-mono text-filter uppercase text-text-dim text-xs">Search</label>
          <input
            className="bg-panel border border-border rounded-none px-3 py-2 text-sm font-mono text-text-primary focus:border-cyan focus:outline-none focus:ring-0"
            value={filters.search ?? ''}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Player name..."
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-mono text-filter uppercase text-text-dim text-xs">Export</label>
          <button
            onClick={() => window.api.pgn.export(undefined, true).catch(() => {})}
            className="bg-transparent border border-border rounded-none px-3 py-2 text-sm font-mono text-cyan uppercase hover:border-cyan focus-visible:outline-2 focus-visible:outline-cyan focus-visible:outline-offset-1"
          >
            Export all
          </button>
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-mono text-filter uppercase text-text-dim text-xs">Page size</label>
          <select
            value={String(pageSize)}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="bg-panel border border-border rounded-none px-3 py-2 text-sm font-mono text-text-primary focus:border-cyan focus:outline-none focus:ring-0"
          >
            {[25, 50, 100].map((size) => (
              <option key={size} value={String(size)}>
                {size}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Panel accent="cyan" label="Games">
        <div className="overflow-x-auto" ref={tableRef} style={{ height: 400, position: 'relative' }}>
          <table className="min-w-full text-left border-collapse">
            <thead className="border-b border-border">
              <tr>
                <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted w-20">White</th>
                <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted w-20">Black</th>
                <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted w-16">Result</th>
                <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted w-16">Source</th>
                <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted w-32">Updated</th>
                <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted">Opening</th>
                <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted text-right w-20">Action</th>
              </tr>
            </thead>
            <tbody>
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const game = games[virtualRow.index]
                return (
                  <tr
                    key={game.id}
                    className="cursor-pointer hover:bg-white/5 transition-colors border-b border-border/50 last:border-0"
                    onClick={() => handleRowClick(game)}
                    ref={(el) => {
                      if (el) rowRefs.current[virtualRow.index] = el
                    }}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: virtualRow.size,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <td className="px-3 py-2 text-sm text-text-primary">{game.whitePlayer}</td>
                    <td className="px-3 py-2 text-sm text-text-primary">{game.blackPlayer}</td>
                    <td className="px-3 py-2 text-sm">
                      <StatusLabel accent={resultAccent(game.outcome ?? 'draw')}>
                        {(game.outcome ?? 'draw').charAt(0).toUpperCase() + (game.outcome ?? 'draw').slice(1)}
                      </StatusLabel>
                    </td>
                    <td className="px-3 py-2 text-sm text-text-muted font-mono">{game.source}</td>
                    <td className="px-3 py-2 text-sm text-text-muted font-mono">
                      {new Date(game.updatedAt).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2 text-sm font-sans font-bold text-text-primary truncate max-w-[120px]">
                      {game.pgn.slice(0, 40)}...
                    </td>
                    <td className="px-3 py-2 text-sm text-right">
                      <Link
                        to={`/explorer/${game.id}`}
                        className="text-cyan font-mono uppercase text-xs hover:text-yellow transition-colors"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                )
              })}
              {games.length === 0 && (
                <tr>
                  <td className="px-3 py-8 text-center text-text-muted text-xs font-mono" colSpan={7}>
                    No games found. Import a PGN file to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div
            className="absolute bottom-0 left-0 w-full h-[2px]"
            style={{
              height: rowVirtualizer.getTotalSize(),
              width: '100%',
              position: 'absolute',
              top: 0,
              left: 0,
            }}
          />
        </div>
      </Panel>

      <div className="flex items-center justify-between px-3 py-3 text-xs font-mono uppercase text-text-muted">
        <div>
          Page {page} of {pages} ({total} total)
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1 || loading}
            className="bg-transparent border border-border rounded-none px-3 py-2 text-xs font-mono text-cyan uppercase disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-cyan hover:border-cyan transition-colors"
          >
            Prev
          </button>
          <button
            onClick={() => setPage(Math.min(pages, page + 1))}
            disabled={page >= pages || loading}
            className="bg-transparent border border-border rounded-none px-3 py-2 text-xs font-mono text-cyan uppercase disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-cyan hover:border-cyan transition-colors"
          >
            Next
          </button>
        </div>
      </div>

      {importing && importProgress && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <Panel accent="yellow" className="p-4 w-full max-w-sm">
            <span className="font-mono text-filter uppercase text-yellow block mb-2">Importing games</span>
            <div className="mb-2">
              <StatusLabel accent="green">
                {importProgress.imported} imported · {importProgress.duplicates} duplicates · {importProgress.invalid} invalid
              </StatusLabel>
            </div>
            <div className="bg-track h-1.5 rounded-none overflow-hidden mb-2 relative">
              <div
                className="h-full bg-yellow relative"
                style={{
                  width: `${(importProgress.processed / Math.max(1, importProgress.total)) * 100}%`,
                  boxShadow: '0 0 12px #FCEE09',
                }}
              />
            </div>
            <div className="text-xs font-mono text-text-muted">
              {importProgress.processed} / {importProgress.total}
            </div>
          </Panel>
        </div>
      )}
    </div>
  )
}
