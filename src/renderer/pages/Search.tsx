import { useCallback, useEffect, useState } from 'react'
import { Panel } from '../components/ui/Panel'
import { KpiCard } from '../components/ui/KpiCard'
import { FilterChip } from '../components/ui/FilterChip'

type SearchResult = {
  id: string
  whitePlayer: string
  blackPlayer: string
  result: string
  outcome: string | null
  playedAt: number | null
  playerColor: string | null
  playerRating: number | null
  opponent: string | null
  opponentRating: number | null
  timeClass: string | null
  matchReasons: string[]
}

type SearchQueryFilters = {
  source?: string
  result?: string
  outcome?: string
  timeClass?: string
  search?: string
  tactic?: string
  endgame?: boolean
  sacrificed?: string
  mateMissed?: boolean
  timeTrouble?: boolean
}

const OUTCOME_COLOR: Record<string, 'cyan' | 'yellow' | 'green' | 'magenta' | 'pink' | 'orange'> = {
  win: 'green',
  loss: 'pink',
  draw: 'yellow'
}

function fmtDate(ms: number | null): string {
  if (!ms) return '—'
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtRating(r: number | null): string {
  return r != null ? String(r) : '—'
}

export default function Search() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<SearchResult[]>([])
  const [total, setTotal] = useState(0)
  const [filters, setFilters] = useState<SearchQueryFilters>({})
  const [error, setError] = useState<string | null>(null)

  const runSearch = useCallback(async () => {
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await window.api.search.query(query, 50, 0)
      if (res.ok) {
        setResults(res.data.results)
        setTotal(res.data.total)
        setFilters(res.data.filters)
      } else {
        setError(res.error?.message ?? 'Search failed')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [query])

  useEffect(() => {
    runSearch()
  }, [runSearch])

  const exampleQueries = [
    'show games where I sacrificed a rook and won',
    'show games where I blundered in rook endgames',
    'won games with fork tactics',
    'sacrificed queen',
    'missed mate',
    'time trouble blunder'
  ]

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-text-muted font-mono text-sm">
        Searching…
      </div>
    )
  }

  return (
    <div className="bg-background min-h-screen space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-filter uppercase text-cyan">// search</span>
          <h1 className="text-page-title font-sans font-bold uppercase text-text-primary">
            Search Engine
          </h1>
        </div>
      </div>

      <div className="wm-grid-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <KpiCard accent="cyan" value={total.toLocaleString()} label="Results" />
        <KpiCard accent="green" value={filters.tactic ? 'Tactic filter' : '—'} label="Tactic filter" />
        <KpiCard accent="yellow" value={filters.endgame ? 'Endgame' : '—'} label="Endgame filter" />
        <KpiCard accent="magenta" value={filters.sacrificed ? `${filters.sacrificed} sacrifice` : '—'} label="Sacrifice filter" />
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 w-full lg:w-3/4">
          <Panel accent="magenta" label="Search query">
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder='e.g. "show games where I sacrificed a rook and won"'
                  disabled={loading}
                  className="flex-1 bg-panel border border-border font-mono text-text-primary px-3 py-2 rounded-none uppercase"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') runSearch()
                  }}
                />
                <button
                  onClick={runSearch}
                  disabled={loading || !query.trim()}
                  className="bg-transparent border border-cyan text-cyan font-mono text-xs uppercase px-4 py-2.5 rounded-none hover:bg-cyan/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Searching…' : 'Search'}
                </button>
              </div>
              <div className="flex flex-wrap gap-2 text-xs font-mono text-text-muted">
                {exampleQueries.map((eq) => (
                  <FilterChip
                    key={eq}
                    selected={query === eq}
                    onClick={() => {
                      setQuery(eq)
                      runSearch()
                    }}
                  >
                    {eq}
                  </FilterChip>
                ))}
              </div>
              {filters.tactic && (
                <div className="flex items-center gap-2 text-xs font-mono text-green">
                  <span>Tactic:</span>
                  <span>{filters.tactic}</span>
                </div>
              )}
              {filters.endgame && (
                <div className="flex items-center gap-2 text-xs font-mono text-yellow">
                  <span>Endgame:</span>
                  <span>blunder detected</span>
                </div>
              )}
              {filters.sacrificed && (
                <div className="flex items-center gap-2 text-xs font-mono text-magenta">
                  <span>Sacrifice:</span>
                  <span>{filters.sacrificed}</span>
                </div>
              )}
              {filters.mateMissed && (
                <div className="flex items-center gap-2 text-xs font-mono text-orange">
                  <span>Missed mate:</span>
                  <span>large eval swing</span>
                </div>
              )}
              {filters.timeTrouble && (
                <div className="flex items-center gap-2 text-xs font-mono text-pink">
                  <span>Time trouble:</span>
                  <span>late-game blunder</span>
                </div>
              )}
            </div>
          </Panel>

          <Panel accent="cyan" label={`Results (${total})`}>
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="min-w-full text-left border-collapse divide-y divide-border/50">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted">Game</th>
                    <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted text-right">Result</th>
                    <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted text-right">Opponent</th>
                    <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted text-right">Date</th>
                    <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted text-right">Reasons</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => (
                    <tr key={r.id} className="hover:bg-white/5 last:border-0">
                      <td className="px-3 py-2 text-xs font-sans text-text-primary">{r.whitePlayer} vs {r.blackPlayer}</td>
                      <td className="px-3 py-2 text-xs font-mono text-right">
                        <span className={`text-[10px] font-mono uppercase ${OUTCOME_COLOR[r.outcome ?? 'draw']}`}>
                          {r.outcome ?? '*'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs font-mono text-right">{fmtRating(r.opponentRating)}</td>
                      <td className="px-3 py-2 text-xs font-mono text-right">{fmtDate(r.playedAt)}</td>
                      <td className="px-3 py-2 text-xs font-mono text-text-muted">
                        {r.matchReasons.join(' · ')}
                      </td>
                    </tr>
                  ))}
                  {results.length === 0 && (
                    <tr>
                      <td className="px-3 py-4 text-center text-text-muted text-xs font-mono" colSpan={5}>
                        No matching games found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>

        <div className="flex-none lg:w-1/4">
          <Panel accent="orange" label="Example queries">
            <div className="space-y-2">
              {exampleQueries.map((eq) => (
                <button
                  key={eq}
                  onClick={() => {
                    setQuery(eq)
                    runSearch()
                  }}
                  className="text-left px-3 py-2 text-xs font-mono text-text-muted hover:bg-white/5 rounded-none w-full border border-border/50 transition-colors"
                >
                  "{eq}"
                </button>
              ))}
            </div>
          </Panel>

          <Panel accent="green" label="How it works">
            <div className="space-y-2 text-xs font-mono text-text-muted">
              <div className="flex flex-col gap-1">
                <span className="font-bold">Natural language:</span>
                <span>Parse queries like "sacrificed a rook and won"</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-bold">Tactics:</span>
                <span>Fork, pin, skewer, hanging, double attack</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-bold">Endgame:</span>
                <span>Blunders in late-game plies</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-bold">Sacrifices:</span>
                <span>Eval swings indicating material given up</span>
              </div>
            </div>
          </Panel>
        </div>
      </div>

      {error && (
        <div className="fixed bottom-4 right-4 bg-pink/10 border border-pink/30 text-pink text-xs font-mono px-3 py-2 rounded-none">
          {error}
        </div>
      )}
    </div>
  )
}
