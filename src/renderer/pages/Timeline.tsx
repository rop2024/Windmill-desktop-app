import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip
} from 'recharts'
import { Panel } from '../components/ui/Panel'
import { KpiCard } from '../components/ui/KpiCard'

type RatingPoint = {
  date: string
  rating: number
}

type Milestone = {
  rating: number
  date: string | null
  achieved: boolean
}

type TimelineData = {
  ratingProgression: RatingPoint[]
  milestones: Milestone[]
  firstRating: number | null
  currentRating: number | null
  ratingGain: number | null
  totalRatedGames: number
}

function intensity(count: number): string {
  if (count === 0) return '#14141C'
  if (count <= 2) return '#1a3a24'
  if (count <= 4) return '#2d6a24'
  return '#5DFF6A'
}

export default function Timeline() {
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<TimelineData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadSummary = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await window.api.timeline.summary()
      if (res.ok) setSummary(res.data)
      else setError(res.error?.message ?? 'Failed to load timeline')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSummary()
  }, [loadSummary])

  if (loading || !summary) {
    return (
      <div className="flex min-h-screen items-center justify-center text-text-muted font-mono text-sm">
        Loading timeline…
      </div>
    )
  }

  const s = summary
  const countMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of s.ratingProgression) {
      map.set(p.date, (map.get(p.date) ?? 0) + 1)
    }
    return map
  }, [s.ratingProgression])

  const ratingChartData = useMemo(
    () => s.ratingProgression.map((p) => ({ date: p.date, rating: p.rating })),
    [s.ratingProgression]
  )

  const achievedMilestones = s.milestones.filter((m) => m.achieved)

  return (
    <div className="bg-background min-h-screen space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-filter uppercase text-cyan">// timeline</span>
          <h1 className="text-page-title font-sans font-bold uppercase text-text-primary">
            Timeline
          </h1>
        </div>
      </div>

      <div className="wm-grid-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <KpiCard accent="cyan" value={s.ratingProgression.length > 0 ? s.ratingProgression[0].date : '—'} label="First rated game" />
        <KpiCard accent="green" value={s.currentRating != null ? s.currentRating.toLocaleString() : '—'} label="Current rating" />
        <KpiCard
          accent={s.ratingGain != null && s.ratingGain > 0 ? 'green' : s.ratingGain != null && s.ratingGain < 0 ? 'pink' : 'cyan'}
          value={s.ratingGain != null ? (s.ratingGain > 0 ? '+' : '') + s.ratingGain.toLocaleString() : '—'}
          label="Rating gain"
        />
        <KpiCard accent="magenta" value={s.totalRatedGames.toLocaleString()} label="Rated games" />
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 w-full lg:w-2/3">
          <Panel accent="cyan" label="Rating progression">
            <div className="h-[300px] w-full">
              {ratingChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={ratingChartData}>
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
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-text-muted text-xs font-mono">
                  No rating data available
                </div>
              )}
            </div>
          </Panel>

          <Panel accent="magenta" label="Milestone markers">
            <div className="space-y-2">
              {achievedMilestones.length > 0 ? (
                achievedMilestones.map((m) => (
                  <div key={m.rating} className="flex justify-between items-center px-2 py-1.5 border-b border-border/50 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-text-primary">{m.rating}</span>
                      <span className="text-[10px] font-mono text-green">Achieved</span>
                    </div>
                    <span className="text-xs font-mono text-text-muted text-right">{m.date}</span>
                  </div>
                ))
              ) : (
                <div className="text-text-muted text-xs font-mono py-2 text-center">No milestones achieved yet.</div>
              )}
            </div>
          </Panel>
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
              {s.milestones.filter((m) => !m.achieved).length > 0 ? (
                s.milestones
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

      {error && (
        <div className="fixed bottom-4 right-4 bg-pink/10 border border-pink/30 text-pink text-xs font-mono px-3 py-2 rounded-none">
          {error}
        </div>
      )}
    </div>
  )
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
