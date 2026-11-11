import { useCallback, useEffect, useState } from 'react'
import { useStatsStore } from '@stats/store'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { Panel } from '../components/ui/Panel'
import { KpiCard } from '../components/ui/KpiCard'
import { PrimaryButton } from '../components/ui/PrimaryButton'
import { FilterChip } from '../components/ui/FilterChip'
import { ProgressBar } from '../components/ui/ProgressBar'

const TIME_CLASSES = ['bullet', 'blitz', 'rapid', 'classical', 'daily'] as const

type RatingPoint = { date: string; rating: number }

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

type CalendarDay = { date: string; count: number }

type AchievementProgress = {
  achievementId: string
  name: string
  description: string
  status: 'locked' | 'in_progress' | 'unlocked'
  progress: number
  target: number
  xpReward: number
  unlockedAt: number | null
}

type TimelineData = {
  ratingProgression: RatingPoint[]
  milestones: { rating: number; date: string | null; achieved: boolean }[]
  firstRating: number | null
  currentRating: number | null
  ratingGain: number | null
  totalRatedGames: number
}

function fmtDate(ms: number | null): string {
  if (!ms) return '—'
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function intensity(count: number): string {
  if (count === 0) return '#14141C'
  if (count <= 2) return '#1a3a24'
  if (count <= 4) return '#2d6a24'
  return '#5DFF6A'
}

function generateWeeks(): string[][] {
  const today = new Date()
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 364)
  const dates: string[] = []
  for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
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
  return weeks
}

export default function Dashboard() {
  const { filters, setFilter, setLoading, loading } = useStatsStore()

  const [appVersion, setAppVersion] = useState<string>('')
  const [overview, setOverview] = useState<OverviewStats | null>(null)
  const [ratingHistory, setRatingHistory] = useState<RatingPoint[]>([])
  const [colorResult, setColorResult] = useState<{
    white: { games: number; wins: number; losses: number; draws: number; winRate: number }
    black: { games: number; wins: number; losses: number; draws: number; winRate: number }
  } | null>(null)
  const [openings, setOpenings] = useState<OpeningStat[]>([])
  const [streaks, setStreaks] = useState<Streaks | null>(null)

  const [opponents, setOpponents] = useState<OpponentStat[]>([])
  const [timeControls, setTimeControls] = useState<TimeControlStat[]>([])
  const [calendar, setCalendar] = useState<CalendarDay[]>([])
  const [showAllOpenings, setShowAllOpenings] = useState(false)
  const [showAllOpponents, setShowAllOpponents] = useState(false)

const [achievements, setAchievements] = useState<AchievementProgress[]>([])

const [timeline, setTimeline] = useState<TimelineData | null>(null)

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

      const [opp, tc, cal] = await Promise.allSettled([
        window.api.statistics.opponents(filters),
        window.api.statistics.timeControls(filters),
        window.api.statistics.calendar({ ...filters, year: undefined }),
      ])
      if (opp.status === 'fulfilled' && opp.value.ok) setOpponents(opp.value.data)
      if (tc.status === 'fulfilled' && tc.value.ok) setTimeControls(tc.value.data)
      if (cal.status === 'fulfilled' && cal.value.ok) setCalendar(cal.value.data)

      const res = await window.api.achievements.list()
      if (res.ok) setAchievements(res.data)

      const tl = await window.api.timeline.summary()
      if (tl.ok) setTimeline(tl.data)
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
        Loading dashboard…
      </div>
    )
  }

  const latest = ratingHistory[ratingHistory.length - 1]
  const unlockedCount = achievements.filter((a) => a.status === 'unlocked').length
  const inProgressCount = achievements.filter((a) => a.status === 'in_progress').length
  const totalXP = achievements.filter((a) => a.status === 'unlocked').reduce((sum, a) => sum + a.xpReward, 0)

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
          {timeline && (
            <KpiCard
              accent={timeline.ratingGain != null && timeline.ratingGain > 0 ? 'green' : timeline.ratingGain != null && timeline.ratingGain < 0 ? 'pink' : 'cyan'}
              value={timeline.ratingGain != null ? (timeline.ratingGain > 0 ? '+' : '') + timeline.ratingGain.toLocaleString() : '—'}
              label="Rating gain"
            />
          )}
          {timeline && (
            <KpiCard accent="magenta" value={timeline.totalRatedGames.toLocaleString()} label="Rated games" />
          )}
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
                    dot={false}
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
          {openings.length > 8 && (
            <button
              type="button"
              onClick={() => setShowAllOpenings((expanded) => !expanded)}
              className="mt-3 w-full border border-border px-3 py-2 text-xs font-mono uppercase text-cyan hover:border-cyan hover:bg-cyan/10"
            >
              {showAllOpenings ? 'Show less' : `Show all ${openings.length} openings`}
            </button>
          )}
        </div>
      </Panel>

      <Panel accent="magenta" label="Achievements">
        <div className="wm-grid-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <KpiCard accent="green" value={unlockedCount} label="Unlocked" />
          <KpiCard accent="yellow" value={inProgressCount} label="In progress" />
          <KpiCard accent="cyan" value={achievements.length} label="Total" />
          <KpiCard accent="magenta" value={totalXP} label="Total XP" />
        </div>
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 w-full lg:w-2/3">
            <div className="space-y-2">
              {achievements.length > 0 ? (
                achievements.map((a) => (
                  <div
                    key={a.achievementId}
                    className={`flex items-center justify-between px-3 py-2 border-b border-border/50 last:border-0 bg-white/5 rounded-none ${a.status === 'unlocked' ? 'border-l-2 border-l-green' : ''}`}
                  >
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-mono font-bold ${a.status === 'locked' ? 'text-text-muted' : a.status === 'in_progress' ? 'text-yellow' : 'text-green'}`}>
                          {a.name}
                        </span>
                        <span className={`text-[10px] font-mono ${a.status === 'locked' ? 'text-text-muted' : a.status === 'in_progress' ? 'text-yellow' : 'text-green'}`}>
                          {a.status === 'locked' ? 'Locked' : a.status === 'in_progress' ? 'In Progress' : 'Unlocked'}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-text-muted">{a.description}</span>
                    </div>
                    <div className="flex items-center gap-3 text-right">
                      <div className="flex flex-col items-end">
                        <span className="text-xs font-mono text-text-primary">
                          {a.progress} / {a.target}
                        </span>
                        <span className="text-[10px] font-mono text-text-muted">+{a.xpReward} XP</span>
                      </div>
                      <div className="w-24">
                        <div className="w-full bg-white/10 rounded-none h-1.5 overflow-hidden">
                          <div
                            className="h-full"
                            style={{
                              width: `${Math.min((a.progress / a.target) * 100, 100)}%`,
                              backgroundColor:
                                a.status === 'unlocked' ? '#10b981' : a.status === 'in_progress' ? '#fbbf24' : '#94a3b8'
                            }}
                          />
                        </div>
                      </div>
                      {a.unlockedAt && (
                        <span className="text-[10px] font-mono text-text-muted">
                          {fmtDate(a.unlockedAt)}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-text-muted text-xs font-mono py-4 text-center">
                  No achievements defined yet.
                </div>
              )}
            </div>
          </div>

          <div className="flex-none lg:w-1/3">
            <Panel accent="cyan" label="Recent unlocks">
              <div className="space-y-2">
                {achievements
                  .filter((a) => a.status === 'unlocked' && a.unlockedAt)
                  .map((a) => (
                    <div key={a.achievementId} className="flex items-center justify-between px-2 py-1.5 border-b border-border/50 last:border-0">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-mono font-bold text-green">{a.name}</span>
                        <span className="text-[10px] font-mono text-text-muted">+{a.xpReward} XP</span>
                      </div>
                      <span className="text-xs font-mono text-text-primary">🏆</span>
                    </div>
                  ))}
                {achievements.filter((a) => a.status === 'unlocked').length === 0 && (
                  <div className="text-text-muted text-xs font-mono py-2 text-center">No unlocks yet.</div>
                )}
              </div>
            </Panel>

            <Panel accent="orange" label="Progress">
              <div className="space-y-3">
                <div className="flex justify-between items-center px-2 py-1.5 border-b border-border/50">
                  <span className="text-xs font-mono text-text-muted">Unlocked</span>
                  <span className="text-xs font-mono text-green">{unlockedCount}</span>
                </div>
                <div className="flex justify-between items-center px-2 py-1.5 border-b border-border/50">
                  <span className="text-xs font-mono text-text-muted">In progress</span>
                  <span className="text-xs font-mono text-yellow">{inProgressCount}</span>
                </div>
                <div className="flex justify-between items-center px-2 py-1.5 border-b border-border/50">
                  <span className="text-xs font-mono text-text-muted">Total XP</span>
                  <span className="text-xs font-mono text-magenta">{totalXP}</span>
                </div>
                <div className="flex justify-between items-center px-2 py-1.5">
                  <span className="text-xs font-mono text-text-muted">Completion</span>
                  <span className="text-xs font-mono text-text-primary">
                    {achievements.length > 0 ? Math.round((unlockedCount / achievements.length) * 100) : 0}%
                  </span>
                </div>
              </div>
            </Panel>
          </div>
        </div>
      </Panel>

      {timeline && (
        <Panel accent="cyan" label="Timeline">
          <div className="wm-grid-4 grid grid-cols-1 md:grid-cols-4 gap-3">
            <KpiCard accent="cyan" value={timeline.ratingProgression.length > 0 ? timeline.ratingProgression[0].date : '—'} label="First rated game" />
            <KpiCard accent="green" value={timeline.currentRating != null ? timeline.currentRating.toLocaleString() : '—'} label="Current rating" />
            <KpiCard
              accent={timeline.ratingGain != null && timeline.ratingGain > 0 ? 'green' : timeline.ratingGain != null && timeline.ratingGain < 0 ? 'pink' : 'cyan'}
              value={timeline.ratingGain != null ? (timeline.ratingGain > 0 ? '+' : '') + timeline.ratingGain.toLocaleString() : '—'}
              label="Rating gain"
            />
            <KpiCard accent="magenta" value={timeline.totalRatedGames.toLocaleString()} label="Rated games" />
          </div>

          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 w-full lg:w-2/3">
              <div className="space-y-3">
                <div className="h-[300px] w-full">
                  {timeline.ratingProgression.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={timeline.ratingProgression} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorRating" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#00F0FF" stopOpacity={0.8} />
                            <stop offset="95%" stopColor="#00F0FF" stopOpacity={0} />
                          </linearGradient>
                        </defs>
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
                        <Tooltip formatter={(value: number) => `${value}`} />
                        <Area
                          type="monotone"
                          dataKey="rating"
                          stroke="#00F0FF"
                          strokeWidth={2}
                          fillOpacity={1}
                          fill="url(#colorRating)"
                          connectNulls
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-text-muted text-xs font-mono">
                      No rating data available
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  {timeline.milestones.filter((m) => m.achieved).length > 0 ? (
                    <>
                      <span className="text-xs font-mono text-text-muted uppercase block mb-1">Milestone markers</span>
                      {timeline.milestones.filter((m) => m.achieved).map((m) => (
                        <div key={m.rating} className="flex justify-between items-center px-2 py-1.5 border-b border-border/50 last:border-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold text-text-primary">{m.rating}</span>
                            <span className="text-[10px] font-mono text-green">Achieved</span>
                          </div>
                          <span className="text-xs font-mono text-text-muted text-right">{m.date}</span>
                        </div>
                      ))}
                    </>
                  ) : (
                    <div className="text-text-muted text-xs font-mono py-2 text-center">No milestones achieved yet.</div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex-none lg:w-1/3">
              <Panel accent="green" label="Activity heatmap">
                <div className="space-y-2">
                  <div className="flex items-end gap-1 mb-2">
                    {['', '', '', '', '', '', ''].map((_, i) => (
                      <div key={i} className="w-6 text-[10px] text-text-dim text-center font-mono uppercase">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][i]}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1 h-[200px]">
                    {generateWeeks().map((week, wi) => (
                      <div key={wi} className="flex gap-1">
                        {week.map((date) => {
                          const countMap = new Map(calendar.map((d) => [d.date, d.count]))
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
                </div>
              </Panel>

              <Panel accent="orange" label="Unachieved milestones">
                <div className="space-y-2">
                  {timeline.milestones.filter((m) => !m.achieved).length > 0 ? (
                    timeline.milestones
                      .filter((m) => !m.achieved)
                      .map((m) => (
                        <div key={m.rating} className="flex justify-between items-center px-2 py-1.5 border-b border-border/50 last:border-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold text-text-muted">{m.rating}</span>
                            <span className="text-[10px] font-mono text-text-muted">Locked</span>
                          </div>
                        </div>
                      ))
                  ) : (
                    <div className="text-text-muted text-xs font-mono py-2 text-center">All milestones achieved!</div>
                  )}
                </div>
              </Panel>
            </div>
          </div>
        </Panel>
      )}

      <Panel accent="magenta" label="Opponents">
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
              {opponents.slice(0, 8).map((o) => (
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
          {opponents.length > 8 && (
            <button
              type="button"
              onClick={() => setShowAllOpponents((expanded) => !expanded)}
              className="mt-3 w-full border border-border px-3 py-2 text-xs font-mono uppercase text-orange hover:border-orange hover:bg-orange/10"
            >
              {showAllOpponents ? 'Show less' : `Show all ${opponents.length} opponents`}
            </button>
          )}
        </div>
      </Panel>

      <Panel accent="cyan" label="Time controls">
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

      <div className="mt-4 text-text-dim text-xs font-mono">
        <p>App version: {appVersion || 'n/a'}</p>
        <p>Environment: Electron</p>
      </div>
    </div>
  )
}
