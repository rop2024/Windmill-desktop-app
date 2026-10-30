import { useCallback, useEffect, useState } from 'react'
import { Panel } from '../components/ui/Panel'
import { KpiCard } from '../components/ui/KpiCard'

type PlanItem = {
  area: string
  label: string
  action: string
  puzzles: number
  puzzleType: string | null
  priority: 'high' | 'medium' | 'low'
  completed: boolean
}

type DailyPlan = {
  date: string
  summary: string
  items: PlanItem[]
  totalPuzzles: number
  weaknessSource: 'weakness-engine' | 'none'
}

const PRIORITY_LABEL: Record<string, 'cyan' | 'yellow' | 'green' | 'magenta' | 'pink' | 'orange'> = {
  high: 'pink',
  medium: 'orange',
  low: 'green'
}

export default function TrainingPlanner() {
  const [loading, setLoading] = useState(false)
  const [plan, setPlan] = useState<DailyPlan | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadPlan = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await window.api.training.dailyPlan()
      if (res.ok) setPlan(res.data)
      else setError(res.error?.message ?? 'Failed to load training plan')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  const completeItem = useCallback(async (area: string) => {
    if (!plan) return
    try {
      const res = await window.api.training.completeItem()
      if (res.ok) {
        setPlan({
          ...plan,
          items: plan.items.map((i) => (i.area === area ? { ...i, completed: true } : i))
        })
      } else {
        setError(res.error?.message ?? 'Failed to mark complete')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [plan])

  useEffect(() => {
    loadPlan()
  }, [loadPlan])

  if (loading || !plan) {
    return (
      <div className="flex min-h-screen items-center justify-center text-text-muted font-mono text-sm">
        Loading training planner…
      </div>
    )
  }

  const p = plan
  const incompleteItems = p.items.filter((i) => !i.completed)
  const completedCount = p.items.length - incompleteItems.length

  return (
    <div className="bg-background min-h-screen space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-filter uppercase text-cyan">// training planner</span>
          <h1 className="text-page-title font-sans font-bold uppercase text-text-primary">
            Training Planner
          </h1>
        </div>
      </div>

      <div className="wm-grid-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <KpiCard accent="cyan" value={p.date} label="Plan date" />
        <KpiCard accent="green" value={p.totalPuzzles} label="Puzzles today" />
        <KpiCard accent="yellow" value={completedCount} label="Completed" sub={`/${p.items.length} items`} />
        <KpiCard accent={p.weaknessSource === 'weakness-engine' ? 'green' : 'cyan'} value={p.weaknessSource} label="Source" />
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 w-full lg:w-3/4">
          <Panel accent="magenta" label="Today's plan">
            <div className="space-y-2">
              <div className="px-3 py-2 text-xs font-mono font-bold text-text-primary bg-white/5 rounded-none border-b border-border/50">
                {p.summary}
              </div>
              {p.items.map((item) => (
                <div key={item.area} className="flex items-center justify-between px-3 py-2 border-b border-border/50 last:border-0">
                  <div className="flex flex-col gap-0.5">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={item.completed}
                        onChange={() => completeItem(item.area)}
                        className="w-4 h-4 rounded-none accent-cyan"
                      />
                      <span className={`text-xs font-sans ${item.completed ? 'line-through text-text-muted' : 'text-text-primary'}`}>
                        {item.label}
                      </span>
                    </label>
                    <span className="text-[10px] font-mono text-text-muted">{item.action}</span>
                  </div>
                  <div className="flex items-center gap-2 text-right">
                    <span className={`text-[10px] font-mono uppercase ${PRIORITY_LABEL[item.priority]}`}>
                      {item.priority}
                    </span>
                    {item.puzzles > 0 && (
                      <span className="text-xs font-mono text-text-primary">{item.puzzles} puzzles</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <div className="flex-none lg:w-1/4">
          <Panel accent="cyan" label="Plan source">
            <div className="space-y-3">
              <div className="flex justify-between items-center px-2 py-1.5 border-b border-border/50">
                <span className="text-xs font-mono text-text-muted">Weakness data</span>
                <span className={`text-[10px] font-mono ${p.weaknessSource === 'weakness-engine' ? 'text-green' : 'text-yellow'}`}>
                  {p.weaknessSource === 'weakness-engine' ? 'Available' : 'None'}
                </span>
              </div>
              <div className="flex justify-between items-center px-2 py-1.5">
                <span className="text-xs font-mono text-text-muted">Progress</span>
                <span className="text-xs font-mono text-text-primary">{completedCount}/{p.items.length}</span>
              </div>
              <div className="text-[10px] font-mono text-text-muted mt-2">
                Plan regenerated daily based on your Weakness Engine profile.
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
