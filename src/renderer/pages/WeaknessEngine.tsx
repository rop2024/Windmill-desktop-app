import { useCallback, useEffect, useState } from 'react'
import { Panel } from '../components/ui/Panel'
import { KpiCard } from '../components/ui/KpiCard'

type WeaknessCategory =
  | 'opening'
  | 'endgame'
  | 'kingSafety'
  | 'timePressure'
  | 'calculation'

type CategoryRating = {
  category: WeaknessCategory
  stars: number
  score: number
  label: string
  signal: string
  moves: number
  errors: number
}

type WeaknessProfile = {
  categories: CategoryRating[]
  gamesAnalyzed: number
  dateRange: { from: string | null; to: string | null }
  trend: 'improving' | 'declining' | 'stable'
  topWeakness: WeaknessCategory | null
  topStrength: WeaknessCategory | null
}

const CATEGORY_LABEL: Record<WeaknessCategory, string> = {
  opening: 'Opening',
  endgame: 'Endgame',
  kingSafety: 'King Safety',
  timePressure: 'Time Pressure',
  calculation: 'Calculation'
}

function starFill(stars: number) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }, (_: unknown, i: number) => i + 1).map((i: number) => (
        <span key={i} className={`text-[10px] font-mono ${i <= stars ? 'text-yellow' : 'text-text-dim'}`}>
          ★
        </span>
      ))}
    </div>
  )
}

function starsColor(stars: number): 'cyan' | 'yellow' | 'green' | 'magenta' | 'pink' | 'orange' {
  if (stars >= 4) return 'green'
  if (stars === 3) return 'yellow'
  if (stars === 2) return 'orange'
  return 'pink'
}

export default function WeaknessEngine() {
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<WeaknessProfile | null>(null)

  const loadProfile = useCallback(async () => {
    setLoading(true)
    try {
      const result = await window.api.weaknesses.getProfile()
      if (result.ok) setProfile(result.data)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  if (loading || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center text-text-muted font-mono text-sm">
        Loading weakness engine…
      </div>
    )
  }

  const p = profile
  const sorted = [...p.categories].sort((a, b) => a.stars - b.stars)
  const weakest = sorted[0]
  const strongest = [...sorted].reverse()[0]

  return (
    <div className="bg-background min-h-screen space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-filter uppercase text-cyan">// weakness engine</span>
          <h1 className="text-page-title font-sans font-bold uppercase text-text-primary">
            Weakness Engine
          </h1>
        </div>
      </div>

      <div className="wm-grid-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <KpiCard accent="cyan" value={p.gamesAnalyzed.toLocaleString()} label="Games analyzed" />
        <KpiCard
          accent={p.trend === 'improving' ? 'green' : p.trend === 'declining' ? 'pink' : 'cyan'}
          value={p.trend.charAt(0).toUpperCase() + p.trend.slice(1)}
          label="Trend"
          sub={`${p.dateRange.from} → ${p.dateRange.to}`}
        />
        <KpiCard
          accent={weakest ? starsColor(weakest.stars) : 'cyan'}
          value={weakest ? `${weakest.stars}★` : '—'}
          label="Top weakness"
          sub={weakest ? CATEGORY_LABEL[weakest.category] : '—'}
        />
        <KpiCard
          accent={strongest ? starsColor(strongest.stars) : 'cyan'}
          value={strongest ? `${strongest.stars}★` : '—'}
          label="Top strength"
          sub={strongest ? CATEGORY_LABEL[strongest.category] : '—'}
        />
      </div>

      <Panel accent="magenta" label="Player weakness profile">
        <div className="space-y-3">
          {p.categories.map((cat) => (
            <div key={cat.category} className="flex items-center justify-between px-3 py-2 border-b border-border/50 last:border-0 bg-white/5">
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-text-primary">{CATEGORY_LABEL[cat.category]}</span>
                  <span className={`text-[10px] font-mono ${starsColor(cat.stars)}`}>{cat.label}</span>
                </div>
                <span className="text-[10px] font-mono text-text-muted">{cat.signal}</span>
              </div>
              <div className="flex items-center gap-2 text-right">
                {starFill(cat.stars)}
                <div className="text-xs font-mono text-text-muted min-w-[44px] text-right">
                  {cat.score.toFixed(1)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel accent="cyan" label="Category breakdown">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left border-collapse divide-y divide-border/50">
            <thead>
              <tr className="border-b border-border">
                <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted">Category</th>
                <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted text-right">Stars</th>
                <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted text-right">Score</th>
                <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted text-right">Moves</th>
                <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted text-right">Errors</th>
              </tr>
            </thead>
            <tbody>
              {p.categories.map((cat) => (
                <tr key={cat.category} className="hover:bg-white/5 last:border-0">
                  <td className="px-3 py-2 text-xs font-sans font-bold text-text-primary">{CATEGORY_LABEL[cat.category]}</td>
                  <td className="px-3 py-2 text-xs font-mono text-text-muted text-right">{starFill(cat.stars)}</td>
                  <td className="px-3 py-2 text-xs font-mono text-right">{cat.score.toFixed(1)}</td>
                  <td className="px-3 py-2 text-xs font-mono text-right">{cat.moves}</td>
                  <td className="px-3 py-2 text-xs font-mono text-right">{cat.errors}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel accent="orange" label="Summary">
        <div className="space-y-2">
          <div className="flex justify-between items-center px-2 py-1.5 border-b border-border/50">
            <span className="text-xs font-mono text-text-primary">Overall trend</span>
            <span className={`text-[10px] font-mono ${p.trend === 'improving' ? 'text-green' : p.trend === 'declining' ? 'text-pink' : 'text-yellow'}`}>
              {p.trend}
            </span>
          </div>
          <div className="flex justify-between items-center px-2 py-1.5 border-b border-border/50 last:border-0">
            <span className="text-xs font-mono text-text-primary">Greatest weakness</span>
            <span className={`text-[10px] font-mono ${weakest ? starsColor(weakest.stars) : 'text-text-dim'}`}>
              {weakest ? `${CATEGORY_LABEL[weakest.category]} · ${weakest.stars}★` : '—'}
            </span>
          </div>
          <div className="flex justify-between items-center px-2 py-1.5">
            <span className="text-xs font-mono text-text-primary">Greatest strength</span>
            <span className={`text-[10px] font-mono ${strongest ? starsColor(strongest.stars) : 'text-text-dim'}`}>
              {strongest ? `${CATEGORY_LABEL[strongest.category]} · ${strongest.stars}★` : '—'}
            </span>
          </div>
        </div>
      </Panel>
    </div>
  )
}
