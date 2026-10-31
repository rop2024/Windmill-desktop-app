import { useEffect, useState, useCallback } from 'react'
import { useStatsStore } from '@stats/store'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts'
import { Panel } from '../components/ui/Panel'
import { KpiCard } from '../components/ui/KpiCard'
import { PrimaryButton } from '../components/ui/PrimaryButton'
import { FilterChip } from '../components/ui/FilterChip'
import { ProgressBar } from '../components/ui/ProgressBar'

const TIME_CLASSES = ['bullet', 'blitz', 'rapid', 'classical', 'daily'] as const

type RatingPoint = { date: string; rating: number }

function ChartDot({ cx, cy }: { cx: number; cy: number }) {
  return (
    <circle cx={cx} cy={cy} r={3.5} fill="#FCEE09" stroke="#0B0B10" strokeWidth={1} />
  )
}

export default function Dashboard() {
  const { filters, setFilter, setLoading, loading } = useStatsStore()

  const [appVersion, setAppVersion] = useState<string>('')
  const [overview, setOverview] = useState<{
    totalGames: number
    wins: number
    losses: number
    draws: number
    winRate: number
    currentRating: number | null
    bestRating: number | null
  } | null>(null)
  const [ratingHistory, setRatingHistory] = useState<RatingPoint[]>([])
  const [colorResult, setColorResult] = useState<{
    white: { games: number; wins: number; losses: number; draws: number; winRate: number }
    black: { games: number; wins: number; losses: number; draws: number; winRate: number }
  } | null>(null)
  const [openings, setOpenings] = useState<{
    opening: string
    games: number
    wins: number
    losses: number
    draws: number
    winRate: number
  }[]>([])
  const [streaks, setStreaks] = useState<{
    currentWin: number
    longestWin: number
    currentLoss: number
    longestLoss: number
    currentUnbeaten: number
    longestUnbeaten: number
  } | null>(null)

  useEffect(() => {
    window.api.getVersion().then((result) => {
      if (result.ok) setAppVersion(result.data)
    })
  }, [])

  const loadStats = useCallback(async () => {
    setLoading(true)
    try {
      const [ov, rh, cr, op, st] = await Promise.all([
        window.api.statistics.overview(filters),
        window.api.statistics.rating(filters),
        window.api.statistics.resultsByColor(filters),
        window.api.statistics.openings(filters),
        window.api.statistics.streaks(filters),
      ])
      if (ov.ok) setOverview(ov.data)
      if (rh.ok) setRatingHistory(rh.data)
      if (cr.ok) setColorResult(cr.data)
      if (op.ok) setOpenings(op.data)
      if (st.ok) setStreaks(st.data)
    } finally {
      setLoading(false)
    }
  }, [filters, setLoading])

  useEffect(() => {
    loadStats()
  }, [loadStats])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-text-muted font-mono text-sm">
        Loading statistics…
      </div>
    )
  }

  const latest = ratingHistory[ratingHistory.length - 1]

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-filter uppercase text-cyan">// dashboard</span>
          <h1 className="text-page-title font-sans font-bold uppercase text-text-primary">
            Performance
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <PrimaryButton onClick={() => window.api.pgn.import().catch(() => {})}>
            SYNC NOW
          </PrimaryButton>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <span className="font-mono text-filter uppercase text-text-dim">Time control</span>
        {TIME_CLASSES.map((tc) => (
          <FilterChip
            key={tc}
            selected={filters.timeClass === tc}
            onClick={() =>
              setFilter('timeClass', filters.timeClass === tc ? undefined : tc)
            }
          >
            {tc.charAt(0).toUpperCase() + tc.slice(1)}
          </FilterChip>
        ))}
      </div>

      {overview && (
        <div className="wm-grid-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard accent="cyan" value={overview.totalGames.toLocaleString()} label="Games" />
          <KpiCard
            accent="green"
            value={overview.wins.toLocaleString()}
            label="Results"
            sub={`${overview.wins}W · ${overview.losses}L · ${overview.draws}D`}
          />
          <KpiCard
            accent="yellow"
            value={overview.winRate.toFixed(1)}
            label="Win rate"
            sub={`${overview.wins}W · ${overview.losses}L · ${overview.draws}D`}
          />
          <KpiCard
            accent="magenta"
            value={overview.currentRating != null ? overview.currentRating.toLocaleString() : '—'}
            label="Rating"
            sub={`Best ${overview.bestRating != null ? overview.bestRating.toLocaleString() : '—'}`}
          />
        </div>
      )}

      <div className="wm-grid-2 grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Panel accent="cyan" label="Rating history">
          <div className="h-[220px] w-full">
            {ratingHistory.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={ratingHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2A2A36" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: '#5D5D6A', fontFamily: 'JetBrains Mono' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#5D5D6A', fontFamily: 'JetBrains Mono' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="rating"
                    stroke="#00F0FF"
                    strokeWidth={2}
                    dot={ChartDot}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-text-muted text-xs font-mono">
                No rating data available
              </div>
            )}
          </div>
        </Panel>

        <Panel accent="green" label="Streaks">
          {streaks ? (
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-text-muted font-mono uppercase text-xs">Current win</span>
                <span className="text-text-primary font-sans font-bold">{streaks.currentWin}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-muted font-mono uppercase text-xs">Longest win</span>
                <span className="text-text-primary font-sans font-bold">{streaks.longestWin}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-muted font-mono uppercase text-xs">Unbeaten</span>
                <span className="text-text-primary font-sans font-bold">{streaks.currentUnbeaten}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-muted font-mono uppercase text-xs">Best unbeaten</span>
                <span className="text-text-primary font-sans font-bold">{streaks.longestUnbeaten}</span>
              </div>
              {latest && (
                <div className="mt-2 pt-2 border-t border-border">
                  <span className="text-text-dim text-xs font-mono block">Current</span>
                  <span className="text-kpi-value font-sans font-bold text-cyan mt-0.5">
                    {latest.rating}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-text-muted text-xs font-mono">No streak data</div>
          )}
        </Panel>
      </div>

      <Panel accent="orange" label="Color performance">
        <div className="space-y-3">
          {colorResult ? (
            <>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-mono uppercase text-text-muted">White</span>
                  <span className="font-mono text-text-primary">{colorResult.white.winRate.toFixed(1)}%</span>
                </div>
                <ProgressBar value={colorResult.white.winRate} accent="cyan" />
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-mono uppercase text-text-muted">Black</span>
                  <span className="font-mono text-text-primary">{colorResult.black.winRate.toFixed(1)}%</span>
                </div>
                <ProgressBar value={colorResult.black.winRate} accent="magenta" />
              </div>
            </>
          ) : (
            <div className="text-text-muted text-xs font-mono">No color data</div>
          )}
        </div>
      </Panel>

      <Panel accent="magenta" label="Opening performance">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted">ECO</th>
                <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted">Opening</th>
                <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted text-right">Games</th>
                <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted text-right">Win %</th>
              </tr>
            </thead>
            <tbody>
              {openings.slice(0, 8).map((o) => (
                <tr key={o.opening} className="border-b border-border/50 hover:bg-white/5 last:border-0">
                  <td className="px-3 py-2 text-xs font-mono text-yellow">{o.opening}</td>
                  <td className="px-3 py-2 text-xs font-sans font-bold text-text-primary">{o.opening}</td>
                  <td className="px-3 py-2 text-xs font-mono text-text-muted text-right">{o.games}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="w-24">
                      <ProgressBar value={o.winRate} accent="orange" />
                    </div>
                    <span className="text-xs font-mono text-text-muted mt-0.5 block">
                      {o.winRate.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
              {openings.length === 0 && (
                <tr>
                  <td className="px-3 py-4 text-center text-text-muted text-xs font-mono" colSpan={4}>
                    No opening data
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="mt-4 text-text-dim text-xs font-mono">
        <p>App version: {appVersion || 'n/a'}</p>
        <p>Environment: Electron</p>
      </div>
    </div>
  )
}
