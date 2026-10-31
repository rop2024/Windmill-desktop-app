import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { Panel } from '../components/ui/Panel'
import { KpiCard } from '../components/ui/KpiCard'
import { ProgressBar } from '../components/ui/ProgressBar'

type OpeningStat = {
  opening: string
  eco: string | null
  games: number
  wins: number
  losses: number
  draws: number
  winRate: number
  accuracy: number | null
  mistakes: number
  recommendation: 'play' | 'avoid' | 'consider'
}

type OpeningGame = {
  id: string
  whitePlayer: string
  blackPlayer: string
  result: string
  outcome: string | null
  playerColor: string | null
  playedAt: number | null
  eco: string | null
  opening: string
  accuracy: number | null
}

type PositionStat = {
  fen: string
  san: string
  moveNumber: number
  ply: number
  timesPlayed: number
  games: number
  winRate: number
}

type Recommendation = {
  type: 'play' | 'avoid' | 'consider'
  opening: string
  eco: string | null
  winRate: number
  accuracy: number | null
  games: number
  reason: string
}

type OpeningDrilldown = {
  opening: string
  eco: string | null
  summary: OpeningStat
  games: OpeningGame[]
  positions: PositionStat[]
  recommendations: Recommendation[]
}

function rateColor(value: number): 'cyan' | 'yellow' | 'green' | 'magenta' | 'pink' | 'orange' {
  if (value >= 60) return 'green'
  if (value >= 45) return 'yellow'
  return 'pink'
}

function recColor(type: string): 'cyan' | 'yellow' | 'green' | 'magenta' | 'pink' | 'orange' {
  switch (type) {
    case 'play': return 'green'
    case 'avoid': return 'pink'
    default: return 'yellow'
  }
}

function fmtDate(ms: number | null): string {
  if (!ms) return '—'
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function OpeningExplorer() {
  const { opening } = useParams<{ opening: string }>()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [openings, setOpenings] = useState<OpeningStat[]>([])
  const [drilldown, setDrilldown] = useState<OpeningDrilldown | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadList = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await window.api.openings.list()
      if (result.ok) setOpenings(result.data)
      else setError(result.error?.message ?? 'Failed to load openings')
    } catch {
      setError('Failed to load openings')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadDrilldown = useCallback(async (name: string) => {
    setLoading(true)
    setError(null)
    try {
      const result = await window.api.openings.drilldown(decodeURIComponent(name))
      if (result.ok) setDrilldown(result.data)
      else setError(result.error?.message ?? 'Failed to load opening')
    } catch {
      setError('Failed to load opening')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (opening) {
      loadDrilldown(opening)
    } else {
      setDrilldown(null)
      loadList()
    }
  }, [opening, loadList, loadDrilldown])

  const totalGames = useMemo(() => openings.reduce((sum, o) => sum + o.games, 0), [openings])
  const bestOpening = useMemo(() => openings[0], [openings])
  const bestAccuracy = useMemo(() => {
    let best: OpeningStat | null = null
    for (const o of openings) {
      if (o.accuracy != null && (best == null || o.accuracy! > best.accuracy!)) best = o
    }
    return best
  }, [openings])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-text-muted font-mono text-sm">
        Loading opening explorer…
      </div>
    )
  }

  if (!opening && error) {
    return (
      <div className="bg-background min-h-screen space-y-4">
        <Panel accent="pink">
          <span className="text-xs font-mono text-pink">{error}</span>
        </Panel>
      </div>
    )
  }

  if (!opening) {
    return (
      <div className="bg-background min-h-screen space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="font-mono text-filter uppercase text-cyan">// opening explorer</span>
            <h1 className="text-page-title font-sans font-bold uppercase text-text-primary">
              Opening Explorer
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/statistics" className="bg-transparent border border-border font-mono text-filter uppercase px-3 py-2 rounded-none hover:border-cyan transition-colors">
              Statistics
            </Link>
          </div>
        </div>

        <div className="wm-grid-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <KpiCard accent="cyan" value={openings.length.toLocaleString()} label="Openings played" />
          <KpiCard accent="yellow" value={totalGames.toLocaleString()} label="Total games" />
          <KpiCard
            accent={bestOpening ? rateColor(bestOpening.winRate) : 'cyan'}
            value={bestOpening ? bestOpening.winRate.toFixed(1) : '—'}
            label="Best win rate"
            sub={bestOpening ? bestOpening.opening : '—'}
          />
          <KpiCard
            accent={bestAccuracy ? 'green' : 'cyan'}
            value={bestAccuracy != null && bestAccuracy.accuracy != null ? bestAccuracy.accuracy.toFixed(1) : '—'}
            label="Best accuracy"
            sub={bestAccuracy != null ? bestAccuracy.opening : '—'}
          />
        </div>

        <Panel accent="magenta" label="Your openings">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left border-collapse divide-y divide-border/50">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted">Opening</th>
                  <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted text-right">ECO</th>
                  <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted text-right">Games</th>
                  <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted text-right">Win %</th>
                  <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted text-right">Accuracy</th>
                  <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted text-right">Mistakes</th>
                  <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {openings.map((o) => (
                  <tr
                    key={o.opening}
                    onClick={() => navigate(`/openings/${encodeURIComponent(o.opening)}`)}
                    className="cursor-pointer hover:bg-white/5 last:border-0 transition-colors"
                  >
                    <td className="px-3 py-2 text-xs font-sans font-bold text-text-primary">{o.opening}</td>
                    <td className="px-3 py-2 text-xs font-mono text-text-muted text-right">{o.eco ?? '—'}</td>
                    <td className="px-3 py-2 text-xs font-mono text-text-muted text-right">{o.games}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="w-24">
                        <ProgressBar value={o.winRate} accent={rateColor(o.winRate)} />
                      </div>
                      <span className="text-xs font-mono text-text-muted mt-0.5 block">{o.winRate.toFixed(1)}%</span>
                    </td>
                    <td className="px-3 py-2 text-xs font-mono text-right">
                      {o.accuracy != null ? <span className="text-text-primary">{o.accuracy.toFixed(1)}</span> : <span className="text-text-dim">—</span>}
                    </td>
                    <td className="px-3 py-2 text-xs font-mono text-right">{o.mistakes}</td>
                    <td className="px-3 py-2 text-right">
                      <span className={`text-xs font-mono font-bold uppercase ${recColor(o.recommendation)}`}>
                        {o.recommendation}
                      </span>
                    </td>
                  </tr>
                ))}
                {openings.length === 0 && (
                  <tr>
                    <td className="px-3 py-4 text-center text-text-muted text-xs font-mono" colSpan={7}>
                      No opening data. Import games to populate your opening explorer.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    )
  }

  const d = drilldown
  if (!d) {
    return (
      <div className="bg-background min-h-screen space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <button
              onClick={() => navigate('/openings')}
              className="bg-transparent border border-border font-mono text-filter uppercase text-xs px-3 py-2 rounded-none hover:border-cyan transition-colors"
            >
              &lt; Back to openings
            </button>
            <h1 className="text-page-title font-sans font-bold uppercase text-text-primary">
              Opening not found
            </h1>
          </div>
        </div>
        <Panel accent="pink">
          <span className="text-xs font-mono text-pink">Opening data not available.</span>
        </Panel>
      </div>
    )
  }
  const summary = d.summary

  return (
    <div className="bg-background min-h-screen space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-filter uppercase text-cyan">// opening explorer</span>
          <button
            onClick={() => navigate('/openings')}
            className="bg-transparent border border-border font-mono text-filter uppercase text-xs px-3 py-2 rounded-none hover:border-cyan transition-colors"
          >
            &lt; Back to openings
          </button>
          <h1 className="text-page-title font-sans font-bold uppercase text-text-primary">
            {d.opening}{d.eco ? ` · ${d.eco}` : ''}
          </h1>
        </div>
      </div>

      <div className="wm-grid-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <KpiCard accent="cyan" value={summary.games.toLocaleString()} label="Games" />
        <KpiCard accent={rateColor(summary.winRate)} value={summary.winRate.toFixed(1)} label="Win rate" sub={`${summary.wins}W · ${summary.losses}L · ${summary.draws}D`} />
        <KpiCard accent={summary.accuracy != null ? 'green' : 'cyan'} value={summary.accuracy != null ? summary.accuracy.toFixed(1) : '—'} label="Accuracy" />
        <KpiCard accent="yellow" value={summary.mistakes.toLocaleString()} label="Mistakes" sub="Inaccuracies + mistakes + blunders" />
      </div>

      <Panel accent="magenta" label="Games">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left border-collapse divide-y divide-border/50">
            <thead>
              <tr className="border-b border-border">
                <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted">Date</th>
                <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted">White</th>
                <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted">Black</th>
                <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted text-right">Result</th>
                <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted text-right">Accuracy</th>
              </tr>
            </thead>
            <tbody>
              {d.games.map((g) => (
                <tr key={g.id} className="hover:bg-white/5 last:border-0">
                  <td className="px-3 py-2 text-xs font-mono text-text-muted">{fmtDate(g.playedAt)}</td>
                  <td className="px-3 py-2 text-xs font-sans text-text-primary">{g.whitePlayer}</td>
                  <td className="px-3 py-2 text-xs font-sans text-text-primary">{g.blackPlayer}</td>
                  <td className="px-3 py-2 text-xs font-mono text-right">
                    <span className={`font-bold ${g.outcome === 'win' ? 'text-green' : g.outcome === 'loss' ? 'text-pink' : 'text-yellow'}`}>
                      {g.outcome ?? '*'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs font-mono text-right">
                    {g.accuracy != null ? <span className="text-text-primary">{g.accuracy.toFixed(1)}</span> : <span className="text-text-dim">—</span>}
                  </td>
                </tr>
              ))}
              {d.games.length === 0 && (
                <tr>
                  <td className="px-3 py-4 text-center text-text-muted text-xs font-mono" colSpan={5}>
                    No games found for this opening.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel accent="cyan" label="Common positions">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left border-collapse divide-y divide-border/50">
            <thead>
              <tr className="border-b border-border">
                <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted">Position (FEN)</th>
                <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted text-right">Reached</th>
                <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted text-right">Games</th>
                <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted text-right">Win %</th>
                <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted text-right">Move</th>
              </tr>
            </thead>
            <tbody>
              {d.positions.slice(0, 15).map((p) => (
                <tr key={p.fen} className="hover:bg-white/5 last:border-0">
                  <td className="px-3 py-2 text-xs font-mono text-text-muted truncate max-w-[220px]" title={p.fen}>
                    {p.fen}
                  </td>
                  <td className="px-3 py-2 text-xs font-mono text-text-muted text-right">{p.timesPlayed}</td>
                  <td className="px-3 py-2 text-xs font-mono text-text-muted text-right">{p.games}</td>
                  <td className="px-3 py-2 text-xs font-mono text-right">
                    <div className="w-20">
                      <ProgressBar value={p.winRate} accent={rateColor(p.winRate)} />
                    </div>
                    <span className="text-xs font-mono text-text-muted mt-0.5 block text-right">{p.winRate.toFixed(1)}%</span>
                  </td>
                  <td className="px-3 py-2 text-xs font-mono text-text-muted text-right">
                    {p.san} (ply {p.ply})
                  </td>
                </tr>
              ))}
              {d.positions.length === 0 && (
                <tr>
                  <td className="px-3 py-4 text-center text-text-muted text-xs font-mono" colSpan={5}>
                    No position data available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel accent="green" label="Recommendations">
        <div className="space-y-2">
          {d.recommendations.map((r) => (
            <div key={`${r.type}-${r.opening}`} className="flex justify-between items-center px-2 py-1.5 border-b border-border/50 last:border-0">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-mono font-bold uppercase text-text-primary">{r.opening}</span>
                <span className={`text-[10px] font-mono uppercase ${recColor(r.type)}`}>{r.type}</span>
              </div>
              <div className="flex items-center gap-2 text-right">
                <span className="text-xs font-mono text-text-muted">{r.winRate.toFixed(1)}%</span>
                <span className="text-xs font-mono text-text-dim">{r.games} games</span>
              </div>
              <span className="text-xs font-mono text-text-muted truncate max-w-xs">{r.reason}</span>
            </div>
          ))}
          {d.recommendations.length === 0 && (
            <div className="text-text-muted text-xs font-mono py-2">No recommendations yet.</div>
          )}
        </div>
      </Panel>
    </div>
  )
}
