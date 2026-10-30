import { useCallback, useState } from 'react'
import { Panel } from '../components/ui/Panel'
import { KpiCard } from '../components/ui/KpiCard'

type CoachReport = {
  period: 'weekly' | 'monthly'
  from: string
  to: string
  gamesAnalyzed: number
  winRate: number
  ratingChange: string
  keyInsights: string[]
  focusAreas: Array<{ category: string; stars: number; label: string; reason: string }>
  trainingPlan: Array<{ area: string; action: string; puzzles: number; priority: 'high' | 'medium' | 'low' }>
}

type DailyAdvice = {
  date: string
  advice: string
  focusArea: { category: string; stars: number; label: string; reason: string } | null
  puzzleSuggestion: string | null
  reason: string
}

type CoachTrainingPlan = {
  focusAreas: Array<{ category: string; stars: number; label: string; reason: string }>
  plan: Array<{ area: string; action: string; puzzles: number; priority: 'high' | 'medium' | 'low' }>
  totalPuzzles: number
}

const PRIORITY_LABEL: Record<string, 'cyan' | 'yellow' | 'green' | 'magenta' | 'pink' | 'orange'> = {
  high: 'pink',
  medium: 'orange',
  low: 'green'
}

export default function Coach() {
  const [loading, setLoading] = useState(false)
  const [weekly, setWeekly] = useState<CoachReport | null>(null)
  const [monthly, setMonthly] = useState<CoachReport | null>(null)
  const [daily, setDaily] = useState<DailyAdvice | null>(null)
  const [plan, setPlan] = useState<CoachTrainingPlan | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadReport = useCallback(async (period: 'weekly' | 'monthly') => {
    setLoading(true)
    setError(null)
    try {
      const res = await window.api.coach[period === 'weekly' ? 'weeklyReport' : 'monthlyReport']()
      if (res.ok) {
        if (period === 'weekly') setWeekly(res.data)
        else setMonthly(res.data)
      } else {
        setError(res.error?.message ?? 'Failed to load report')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  const loadDaily = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await window.api.coach.dailyAdvice()
      if (res.ok) setDaily(res.data)
      else setError(res.error?.message ?? 'Failed to load daily advice')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  const loadPlan = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await window.api.coach.trainingPlan()
      if (res.ok) setPlan(res.data)
      else setError(res.error?.message ?? 'Failed to load training plan')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-text-muted font-mono text-sm">
        Loading coach…
      </div>
    )
  }

  return (
    <div className="bg-background min-h-screen space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-filter uppercase text-cyan">// coach</span>
          <h1 className="text-page-title font-sans font-bold uppercase text-text-primary">
            Coach
          </h1>
        </div>
      </div>

      <div className="wm-grid-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <KpiCard accent="cyan" value={weekly?.gamesAnalyzed ?? 0} label="Games (week)" />
        <KpiCard accent="green" value={weekly?.winRate ?? 0} label="Win rate" sub="%" />
        <KpiCard accent="yellow" value={daily?.focusArea ? daily.focusArea.stars : 0} label="Top focus" sub="★" />
        <KpiCard accent="orange" value={plan?.totalPuzzles ?? 0} label="Puzzles / week" />
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 w-full lg:w-2/3">
          <Panel accent="magenta" label="Weekly report">
            <div className="space-y-3">
              {weekly ? (
                <>
                  <div className="flex justify-between items-center px-2 py-1.5 border-b border-border/50">
                    <span className="text-xs font-mono text-text-muted">Period</span>
                    <span className="text-xs font-mono text-text-primary">{weekly.from} → {weekly.to}</span>
                  </div>
                  <div className="flex justify-between items-center px-2 py-1.5 border-b border-border/50">
                    <span className="text-xs font-mono text-text-muted">Win rate</span>
                    <span className="text-xs font-mono text-text-primary">{weekly.winRate.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between items-center px-2 py-1.5 border-b border-border/50">
                    <span className="text-xs font-mono text-text-muted">Rating change</span>
                    <span className="text-xs font-mono text-text-primary">{weekly.ratingChange}</span>
                  </div>
                  <div className="flex justify-between items-center px-2 py-1.5">
                    <span className="text-xs font-mono text-text-muted">Games analyzed</span>
                    <span className="text-xs font-mono text-text-primary">{weekly.gamesAnalyzed}</span>
                  </div>
                  <div className="mt-3 text-xs font-mono text-text-muted">
                    <b>Key insights</b>
                    <ul className="list-disc list-inside space-y-1 mt-1">
                      {weekly.keyInsights.map((i, idx) => (
                        <li key={idx}>{i}</li>
                      ))}
                    </ul>
                  </div>
                </>
              ) : (
                <button
                  onClick={() => loadReport('weekly')}
                  className="bg-transparent border border-cyan text-cyan font-mono text-xs uppercase px-3 py-2 rounded-none hover:bg-cyan/10 transition-colors"
                >
                  Load weekly report
                </button>
              )}
            </div>
          </Panel>

          <Panel accent="cyan" label="Daily advice">
            <div className="space-y-3">
              {daily ? (
                <>
                  <div className="flex items-start gap-3 px-2 py-2 border-b border-border/50">
                    <span className="text-[10px] font-mono text-cyan uppercase flex-shrink-0">Today</span>
                    <div className="flex-1">
                      <div className="text-xs font-sans font-bold text-text-primary">{daily.advice}</div>
                      <div className="text-[10px] font-mono text-text-muted mt-1">{daily.reason}</div>
                    </div>
                  </div>
                  {daily.puzzleSuggestion && (
                    <div className="px-2 py-2 border-b border-border/50 bg-white/5">
                      <div className="text-[10px] font-mono text-text-muted uppercase">Puzzle suggestion</div>
                      <div className="text-xs font-mono text-text-primary">{daily.puzzleSuggestion}</div>
                    </div>
                  )}
                  {daily.focusArea && (
                    <div className="px-2 py-2 border-b border-border/50">
                      <div className="text-[10px] font-mono text-text-muted uppercase">Focus area</div>
                      <div className="text-xs font-mono text-text-primary">{daily.focusArea.label} ({daily.focusArea.stars}★)</div>
                    </div>
                  )}
                </>
              ) : (
                <button
                  onClick={loadDaily}
                  className="bg-transparent border border-cyan text-cyan font-mono text-xs uppercase px-3 py-2 rounded-none hover:bg-cyan/10 transition-colors"
                >
                  Load daily advice
                </button>
              )}
            </div>
          </Panel>

          <Panel accent="orange" label="Monthly report">
            <div className="space-y-3">
              {monthly ? (
                <>
                  <div className="flex justify-between items-center px-2 py-1.5 border-b border-border/50">
                    <span className="text-xs font-mono text-text-muted">Period</span>
                    <span className="text-xs font-mono text-text-primary">{monthly.from} → {monthly.to}</span>
                  </div>
                  <div className="flex justify-between items-center px-2 py-1.5 border-b border-border/50">
                    <span className="text-xs font-mono text-text-muted">Win rate</span>
                    <span className="text-xs font-mono text-text-primary">{monthly.winRate.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between items-center px-2 py-1.5 border-b border-border/50">
                    <span className="text-xs font-mono text-text-muted">Rating change</span>
                    <span className="text-xs font-mono text-text-primary">{monthly.ratingChange}</span>
                  </div>
                  <div className="flex justify-between items-center px-2 py-1.5">
                    <span className="text-xs font-mono text-text-muted">Games analyzed</span>
                    <span className="text-xs font-mono text-text-primary">{monthly.gamesAnalyzed}</span>
                  </div>
                  <div className="mt-3 text-xs font-mono text-text-muted">
                    <b>Key insights</b>
                    <ul className="list-disc list-inside space-y-1 mt-1">
                      {monthly.keyInsights.map((i, idx) => (
                        <li key={idx}>{i}</li>
                      ))}
                    </ul>
                  </div>
                </>
              ) : (
                <button
                  onClick={() => loadReport('monthly')}
                  className="bg-transparent border border-cyan text-cyan font-mono text-xs uppercase px-3 py-2 rounded-none hover:bg-cyan/10 transition-colors"
                >
                  Load monthly report
                </button>
              )}
            </div>
          </Panel>
        </div>

        <div className="flex-none lg:w-1/3">
          <Panel accent="green" label="Focus areas">
            <div className="space-y-2">
              {plan?.focusAreas.map((a) => (
                <div key={a.category} className="flex justify-between items-center px-2 py-1.5 border-b border-border/50 last:border-0">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-mono font-bold text-text-primary">{a.label}</span>
                    <span className={`text-[10px] font-mono ${PRIORITY_LABEL[a.stars <= 2 ? 'high' : a.stars === 3 ? 'medium' : 'low']}`}>
                      {a.stars}★
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-text-muted truncate max-w-xs">{a.reason}</span>
                </div>
              ))}
              {plan?.focusAreas.length === 0 && (
                <div className="text-text-muted text-xs font-mono py-2 text-center">No focus areas detected.</div>
              )}
            </div>
          </Panel>

          <Panel accent="cyan" label="Training plan">
            <div className="space-y-2">
              {plan?.plan.map((p) => (
                <div key={p.area} className="flex flex-col gap-1 px-2 py-1.5 border-b border-border/50 last:border-0">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-mono font-bold text-text-primary">{p.area.charAt(0).toUpperCase() + p.area.slice(1)}</span>
                    <span className={`text-[10px] font-mono uppercase ${PRIORITY_LABEL[p.priority]}`}>{p.priority}</span>
                  </div>
                  <div className="text-[10px] font-mono text-text-muted">{p.action}</div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-mono text-text-muted">Puzzles / week</span>
                    <span className="text-xs font-mono text-text-primary">{p.puzzles}</span>
                  </div>
                </div>
              ))}
              {plan?.plan.length === 0 && (
                <div className="text-text-muted text-xs font-mono py-2 text-center">No training plan yet.</div>
              )}
              {plan && (
                <div className="pt-2 border-t border-border/50">
                  <div className="flex justify-between items-center px-2 py-1.5">
                    <span className="text-xs font-mono text-text-muted">Total puzzles / week</span>
                    <span className="text-xs font-mono text-text-primary">{plan.totalPuzzles}</span>
                  </div>
                </div>
              )}
            </div>
          </Panel>

          <div className="flex justify-end mt-2">
            <button
              onClick={loadPlan}
              className="bg-transparent border border-cyan text-cyan font-mono text-xs uppercase px-3 py-2 rounded-none hover:bg-cyan/10 transition-colors"
            >
              Refresh training plan
            </button>
          </div>
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
