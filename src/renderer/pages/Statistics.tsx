import { useEffect, useState, useCallback } from 'react'
import { useStatsStore, type StatsView } from '@stats/store'
import { FilterChip } from '../components/ui/FilterChip'
import { Panel } from '../components/ui/Panel'
import { KpiCard } from '../components/ui/KpiCard'
import { ProgressBar } from '../components/ui/ProgressBar'

const VIEW_TABS: { key: StatsView; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'openings', label: 'Openings' },
  { key: 'opponents', label: 'Opponents' },
  { key: 'timeControls', label: 'Time controls' },
  { key: 'calendar', label: 'Calendar' }
]

type OverviewStats = {
  totalGames: number
  wins: number
  losses: number
  draws: number
  winRate: number
  currentRating: number | null
  bestRating: number | null
}

type Streaks = {
  currentWin: number
  longestWin: number
  currentLoss: number
  longestLoss: number
  currentUnbeaten: number
  longestUnbeaten: number
}

type OpeningStat = {
  opening: string
  games: number
  wins: number
  losses: number
  draws: number
  winRate: number
}

type OpponentStat = {
  opponent: string
  games: number
  wins: number
  losses: number
  draws: number
  winRate: number
}

type TimeControlStat = {
  timeClass: string
  games: number
  wins: number
  losses: number
  draws: number
  winRate: number
}

type CalendarDay = {
  date: string
  count: number
}

export default function Statistics() {
  const { filters, view, setView, year, setYear } = useStatsStore()

  const [loading, setLoading] = useState(true)
  const [overview, setOverview] = useState<OverviewStats | null>(null)
  const [streaks, setStreaks] = useState<Streaks | null>(null)
  const [openings, setOpenings] = useState<OpeningStat[]>([])
  const [opponents, setOpponents] = useState<OpponentStat[]>([])
  const [timeControls, setTimeControls] = useState<TimeControlStat[]>([])
  const [calendar, setCalendar] = useState<CalendarDay[]>([])

  const loadStats = useCallback(async () => {
    setLoading(true)
    try {
      const results = await Promise.allSettled([
        window.api.statistics.overview(filters),
        window.api.statistics.streaks(filters),
        window.api.statistics.openings(filters),
        window.api.statistics.opponents(filters),
        window.api.statistics.timeControls(filters),
        window.api.statistics.calendar({ ...filters, year: year ?? undefined })
      ])

      const [ov, sk, op, opp, tc, cal] = results

      if (ov.status === 'fulfilled' && ov.value.ok) setOverview(ov.value.data)
      if (sk.status === 'fulfilled' && sk.value.ok) setStreaks(sk.value.data)
      if (op.status === 'fulfilled' && op.value.ok) setOpenings(op.value.data)
      if (opp.status === 'fulfilled' && opp.value.ok) setOpponents(opp.value.data)
      if (tc.status === 'fulfilled' && tc.value.ok) setTimeControls(tc.value.data)
      if (cal.status === 'fulfilled' && cal.value.ok) setCalendar(cal.value.data)
    } catch {
      // Ignore errors — individual failures are handled above
    } finally {
      setLoading(false)
    }
  }, [filters, year])

  useEffect(() => {
    loadStats()
  }, [loadStats])

  const currentYear = year ?? new Date().getFullYear()

  const statAccent = (key: string): 'cyan' | 'yellow' | 'green' | 'magenta' | 'pink' | 'orange' => {
    switch (key) {
      case 'openings': return 'magenta'
      case 'opponents': return 'orange'
      case 'timeControls': return 'cyan'
      case 'calendar': return 'green'
      default: return 'cyan'
    }
  }

  return (
    <div className="bg-background min-h-screen space-y-4">
      {loading ? (
        <div className="flex min-h-screen items-center justify-center text-text-muted font-mono text-sm">
          Loading statistics…
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
              <span className="font-mono text-filter uppercase text-cyan">// statistics</span>
              <h1 className="text-page-title font-sans font-bold uppercase text-text-primary">
                Statistics
              </h1>
            </div>
            <div className="flex flex-wrap gap-2">
              {VIEW_TABS.map(({ key, label }) => (
                <FilterChip
                  key={key}
                  selected={view === key}
                  onClick={() => setView(key)}
                >
                  {label}
                </FilterChip>
              ))}
            </div>
          </div>

          {overview && (
            <div className="wm-grid-4 grid grid-cols-1 md:grid-cols-4 gap-3">
              <KpiCard accent="cyan" value={overview.totalGames.toLocaleString()} label="Games" />
              <KpiCard accent="green" value={overview.winRate.toFixed(1)} label="Win rate" sub={`${overview.wins}W · ${overview.losses}L · ${overview.draws}D`} />
              <KpiCard accent="magenta" value={overview.currentRating != null ? overview.currentRating.toLocaleString() : '—'} label="Rating" sub={`Best ${overview.bestRating != null ? overview.bestRating.toLocaleString() : '—'}`} />
              <KpiCard accent="yellow" value={streaks?.longestWin ?? 0} label="Best streak" sub="Longest win run" />
            </div>
          )}

          {view === 'overview' && streaks && (
            <Panel accent="green" label="Streaks">
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted font-mono uppercase text-xs">Current win</span>
                  <span className="text-text-primary font-sans font-bold">{streaks.currentWin}</span>
                  <span className="text-text-dim text-xs font-mono">Longest {streaks.longestWin}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted font-mono uppercase text-xs">Current loss</span>
                  <span className="text-text-primary font-sans font-bold">{streaks.currentLoss}</span>
                  <span className="text-text-dim text-xs font-mono">Longest {streaks.longestLoss}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted font-mono uppercase text-xs">Unbeaten</span>
                  <span className="text-text-primary font-sans font-bold">{streaks.currentUnbeaten}</span>
                  <span className="text-text-dim text-xs font-mono">Longest {streaks.longestUnbeaten}</span>
                </div>
              </div>
            </Panel>
          )}

          {view === 'openings' && (
            <Panel accent={statAccent('openings')} label="Openings">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left border-collapse divide-y divide-border/50">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted">Opening</th>
                      <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted text-right">Games</th>
                      <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted text-right">Win %</th>
                      <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted text-right">W</th>
                      <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted text-right">L</th>
                      <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted text-right">D</th>
                    </tr>
                  </thead>
                  <tbody>
                    {openings.map((o) => (
                      <tr key={o.opening} className="hover:bg-white/5 last:border-0">
                        <td className="px-3 py-2 text-xs font-sans font-bold text-text-primary">{o.opening}</td>
                        <td className="px-3 py-2 text-xs font-mono text-text-muted text-right">{o.games}</td>
                        <td className="px-3 py-2 text-right">
                          <div className="w-24">
                            <ProgressBar value={o.winRate} accent="orange" />
                          </div>
                          <span className="text-xs font-mono text-text-muted mt-0.5 block">{o.winRate.toFixed(1)}%</span>
                        </td>
                        <td className="px-3 py-2 text-xs font-mono text-green text-right">{o.wins}</td>
                        <td className="px-3 py-2 text-xs font-mono text-pink text-right">{o.losses}</td>
                        <td className="px-3 py-2 text-xs font-mono text-yellow text-right">{o.draws}</td>
                      </tr>
                    ))}
                    {openings.length === 0 && (
                      <tr>
                        <td className="px-3 py-4 text-center text-text-muted text-xs font-mono" colSpan={6}>
                          No opening data
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}

          {view === 'opponents' && (
            <Panel accent={statAccent('opponents')} label="Opponents">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left border-collapse divide-y divide-border/50">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted">Opponent</th>
                      <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted text-right">Games</th>
                      <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted text-right">Win %</th>
                      <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted text-right">W</th>
                      <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted text-right">L</th>
                      <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted text-right">D</th>
                    </tr>
                  </thead>
                  <tbody>
                    {opponents.map((o) => (
                      <tr key={o.opponent} className="hover:bg-white/5 last:border-0">
                        <td className="px-3 py-2 text-xs font-sans font-bold text-text-primary">{o.opponent}</td>
                        <td className="px-3 py-2 text-xs font-mono text-text-muted text-right">{o.games}</td>
                        <td className="px-3 py-2 text-right">
                          <div className="w-24">
                            <ProgressBar value={o.winRate} accent="orange" />
                          </div>
                          <span className="text-xs font-mono text-text-muted mt-0.5 block">{o.winRate.toFixed(1)}%</span>
                        </td>
                        <td className="px-3 py-2 text-xs font-mono text-green text-right">{o.wins}</td>
                        <td className="px-3 py-2 text-xs font-mono text-pink text-right">{o.losses}</td>
                        <td className="px-3 py-2 text-xs font-mono text-yellow text-right">{o.draws}</td>
                      </tr>
                    ))}
                    {opponents.length === 0 && (
                      <tr>
                        <td className="px-3 py-4 text-center text-text-muted text-xs font-mono" colSpan={6}>
                          No opponent data
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}

          {view === 'timeControls' && (
            <Panel accent={statAccent('timeControls')} label="Time controls">
              <div className="space-y-2">
                {timeControls.map((t) => (
                  <div key={t.timeClass} className="flex justify-between items-center px-2 py-1.5 border-b border-border/50 last:border-0">
                    <span className="text-xs font-mono text-text-muted uppercase">{t.timeClass.charAt(0).toUpperCase() + t.timeClass.slice(1)}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-text-primary">{t.games}</span>
                      <div className="w-24">
                        <ProgressBar value={t.winRate} accent="cyan" />
                      </div>
                      <span className="text-xs font-mono text-text-muted mt-0.5 block text-right">{t.winRate.toFixed(1)}%</span>
                    </div>
                  </div>
                ))}
                {timeControls.length === 0 && (
                  <div className="text-text-muted text-xs font-mono py-2">No time control data</div>
                )}
              </div>
            </Panel>
          )}

          {view === 'calendar' && (
            <Panel accent={statAccent('calendar')} label="Calendar">
              <div className="flex items-center gap-3 mb-3">
                <span className="font-mono text-filter uppercase text-text-dim text-xs">Year</span>
                <select
                  value={currentYear}
                  onChange={(e) => setYear(Number(e.target.value))}
                  className="bg-panel border border-border rounded-none px-3 py-2 text-xs font-mono text-text-primary focus:border-cyan focus:outline-none focus:ring-0"
                >
                  {[2020, 2021, 2022, 2023, 2024, 2025, 2026].map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              <CalendarHeatmap year={currentYear} data={calendar} />
            </Panel>
          )}
        </div>
      )}
    </div>
  )
}

type CalendarHeatmapProps = {
  year: number
  data: { date: string; count: number }[]
}

function CalendarHeatmap({ year, data }: CalendarHeatmapProps) {
  const countMap = new Map(data.map((d) => [d.date, d.count]))

  const dates: string[] = []
  const start = new Date(year, 0, 1)
  const end = new Date(year + 1, 0, 1)
  for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().slice(0, 10))
  }

  const weeks: string[][] = []
  let currentWeek: string[] = []
  dates.forEach((date) => {
    const day = new Date(date)
    if (day.getDay() === 0 && currentWeek.length > 0) {
      weeks.push(currentWeek)
      currentWeek = []
    }
    currentWeek.push(date)
  })
  if (currentWeek.length > 0) weeks.push(currentWeek)

  const intensity = (count: number): string => {
    if (count === 0) return '#14141C'
    if (count <= 2) return '#1a3a24'
    return '#5DFF6A'
  }

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-1 mb-2">
        {['', '', '', '', '', '', ''].map((_, i) => (
          <div key={i} className="w-6 text-[10px] text-text-dim text-center font-mono uppercase">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][i]}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex gap-1">
            {week.map((date) => {
              const count = countMap.get(date) ?? 0
              return (
                <div
                  key={date}
                  className="w-5 h-5 rounded-none"
                  style={{ backgroundColor: intensity(count) }}
                  title={`${date}: ${count} game${count !== 1 ? 's' : ''}`}
                />
              )
            })}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 text-[10px] text-text-dim font-mono uppercase mt-2">
        <div className="w-5 h-5 rounded-none" style={{ backgroundColor: '#14141C' }}></div>
        <span>0</span>
        <div className="w-5 h-5 rounded-none" style={{ backgroundColor: '#1a3a24' }}></div>
        <span>1-2</span>
        <div className="w-5 h-5 rounded-none" style={{ backgroundColor: '#5DFF6A' }}></div>
        <span>3+</span>
      </div>
    </div>
  )
}
