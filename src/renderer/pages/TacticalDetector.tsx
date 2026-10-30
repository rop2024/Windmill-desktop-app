import { useCallback, useEffect, useMemo, useState } from 'react'
import { Panel } from '../components/ui/Panel'
import { KpiCard } from '../components/ui/KpiCard'

type Color = 'w' | 'b'

type TacticType =
  | 'fork'
  | 'pin'
  | 'skewer'
  | 'hanging'
  | 'double_attack'
  | 'discovered_attack'
  | 'clearance'
  | 'deflection'

type TacticLabel = 'created' | 'missed' | 'defended' | 'none'

type DetectedTactic = {
  id: string
  gameId: string
  ply: number
  san: string
  tacticType: TacticType
  label: TacticLabel
  side: Color
  description: string
  piece: string | null
  targetSquare: string | null
  targets: string[]
  value: number
  fenBefore: string
  fenAfter: string
}

type TacticTally = {
  created: Record<TacticType, number>
  missed: Record<TacticType, number>
  defended: Record<TacticType, number>
}

type GameTactics = {
  gameId: string
  totalPly: number
  white: TacticTally
  black: TacticTally
  tactics: DetectedTactic[]
}

type TacticSummaryRow = {
  tacticType: TacticType
  side: string
  label: TacticLabel
  count: number
}

type GameRow = {
  id: string
  whitePlayer: string
  blackPlayer: string
  result: string
  playedAt: number | null
}

const ALL_TYPES: TacticType[] = [
  'fork', 'pin', 'skewer', 'hanging', 'double_attack', 'discovered_attack', 'clearance', 'deflection'
]

const TYPE_LABEL: Record<TacticType, string> = {
  fork: 'Fork',
  pin: 'Pin',
  skewer: 'Skewer',
  hanging: 'Hanging piece',
  double_attack: 'Double attack',
  discovered_attack: 'Discovered attack',
  clearance: 'Clearance',
  deflection: 'Deflection'
}

const SIDE_LABEL: Record<Color, string> = { w: 'White', b: 'Black' }

function sumRecord(record: Record<TacticType, number>): number {
  let total = 0
  for (const v of Object.values(record)) total += v
  return total
}

function fmtDate(ms: number | null): string {
  if (!ms) return '—'
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function recLabelCount(tally: TacticTally, label: TacticLabel): number {
  if (label === 'none') return 0
  const map = tally[label]
  return sumRecord(map)
}

export default function TacticalDetector() {
  const [loading, setLoading] = useState(true)
  const [games, setGames] = useState<GameRow[]>([])
  const [summary, setSummary] = useState<TacticSummaryRow[]>([])
  const [selectedGame, setSelectedGame] = useState<string | null>(null)
  const [gameTactics, setGameTactics] = useState<GameTactics | null>(null)

  const loadGames = useCallback(async () => {
    try {
      const result = await window.api.games.query({}, 100, 0)
      if (result.ok) setGames(result.data.games.map((g) => ({
        id: g.id,
        whitePlayer: g.whitePlayer,
        blackPlayer: g.blackPlayer,
        result: g.result,
        playedAt: g.playedAt ?? null
      })))
    } catch {
      // ignore
    }
  }, [])

  const loadSummary = useCallback(async () => {
    try {
      const result = await window.api.tactics.summary()
      if (result.ok) setSummary(result.data)
    } catch {
      // ignore
    }
  }, [])

  const analyzeGame = useCallback(async (gameId: string) => {
    setLoading(true)
    setSelectedGame(gameId)
    try {
      const result = await window.api.tactics.getForGame(gameId)
      if (result.ok) setGameTactics(result.data)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadGames()
    loadSummary()
  }, [loadGames, loadSummary])

  const globalByType = useMemo(() => {
    const map = new Map<TacticType, { created: number; missed: number; defended: number }>()
    for (const t of ALL_TYPES) {
      map.set(t, { created: 0, missed: 0, defended: 0 })
    }
    for (const row of summary) {
      const entry = map.get(row.tacticType)
      if (!entry) continue
      if (row.label === 'created') entry.created += row.count
      else if (row.label === 'missed') entry.missed += row.count
      else if (row.label === 'defended') entry.defended += row.count
    }
    return map
  }, [summary])

  const totalCreated = useMemo(() => sumRecord(summary.reduce((acc, r) => {
    if (r.label === 'created') acc[r.tacticType] = (acc[r.tacticType] ?? 0) + r.count
    return acc
  }, {} as Record<TacticType, number>)), [summary])
  const totalMissed = useMemo(() => sumRecord(summary.reduce((acc, r) => {
    if (r.label === 'missed') acc[r.tacticType] = (acc[r.tacticType] ?? 0) + r.count
    return acc
  }, {} as Record<TacticType, number>)), [summary])
  const totalDefended = useMemo(() => sumRecord(summary.reduce((acc, r) => {
    if (r.label === 'defended') acc[r.tacticType] = (acc[r.tacticType] ?? 0) + r.count
    return acc
  }, {} as Record<TacticType, number>)), [summary])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-text-muted font-mono text-sm">
        Loading tactical detector…
      </div>
    )
  }

  return (
    <div className="bg-background min-h-screen space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-filter uppercase text-cyan">// tactics</span>
          <h1 className="text-page-title font-sans font-bold uppercase text-text-primary">
            Tactical Detector
          </h1>
        </div>
      </div>

      <div className="wm-grid-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <KpiCard accent="green" value={totalCreated.toLocaleString()} label="Tactics created" />
        <KpiCard accent="pink" value={totalMissed.toLocaleString()} label="Tactics missed" />
        <KpiCard accent="orange" value={totalDefended.toLocaleString()} label="Tactics defended" />
        <KpiCard accent="cyan" value={games.length.toLocaleString()} label="Analyzed games" />
      </div>

      <Panel accent="cyan" label="Tactic breakdown (all games)">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left border-collapse divide-y divide-border/50">
            <thead>
              <tr className="border-b border-border">
                <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted">Tactic</th>
                <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted text-right">Created</th>
                <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted text-right">Missed</th>
                <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted text-right">Defended</th>
                <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {ALL_TYPES.map((t) => {
                const entry = globalByType.get(t) ?? { created: 0, missed: 0, defended: 0 }
                const total = entry.created + entry.missed + entry.defended
                return (
                  <tr key={t} className="hover:bg-white/5 last:border-0">
                    <td className="px-3 py-2 text-xs font-sans font-bold text-text-primary">{TYPE_LABEL[t]}</td>
                    <td className="px-3 py-2 text-xs font-mono text-text-muted text-right">{entry.created}</td>
                    <td className="px-3 py-2 text-xs font-mono text-text-muted text-right">{entry.missed}</td>
                    <td className="px-3 py-2 text-xs font-mono text-text-muted text-right">{entry.defended}</td>
                    <td className="px-3 py-2 text-xs font-mono text-text-primary text-right">{total}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel accent="magenta" label="Pick a game to analyze">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left border-collapse divide-y divide-border/50">
            <thead>
              <tr className="border-b border-border">
                <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted">Game</th>
                <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted">Date</th>
                <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted text-right">Result</th>
                <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted text-right">Analyze</th>
              </tr>
            </thead>
            <tbody>
              {games.slice(0, 50).map((g) => (
                <tr
                  key={g.id}
                  onClick={() => analyzeGame(g.id)}
                  className="cursor-pointer hover:bg-white/5 last:border-0 transition-colors"
                >
                  <td className="px-3 py-2 text-xs font-sans text-text-primary">
                    {g.whitePlayer} vs {g.blackPlayer}
                  </td>
                  <td className="px-3 py-2 text-xs font-mono text-text-muted">{fmtDate(g.playedAt)}</td>
                  <td className="px-3 py-2 text-xs font-mono text-text-muted text-right">{g.result}</td>
                  <td className="px-3 py-2 text-xs font-mono text-cyan text-right">
                    {selectedGame === g.id ? 'Analyzing…' : 'Detect'}
                  </td>
                </tr>
              ))}
              {games.length === 0 && (
                <tr>
                  <td className="px-3 py-4 text-center text-text-muted text-xs font-mono" colSpan={4}>
                    No games found. Import games to analyze tactics.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      {gameTactics && (
        <>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-2">
            <div className="flex flex-col gap-1">
              <button
                onClick={() => { setSelectedGame(null); setGameTactics(null) }}
                className="bg-transparent border border-border font-mono text-filter uppercase text-xs px-3 py-2 rounded-none hover:border-cyan transition-colors"
              >
                &lt; Back
              </button>
              <h2 className="text-page-title font-sans font-bold uppercase text-text-primary">
                Game analysis
              </h2>
            </div>
          </div>

          <div className="wm-grid-4 grid grid-cols-1 md:grid-cols-4 gap-3">
            <KpiCard accent="cyan" value={gameTactics.totalPly.toLocaleString()} label="Ply analyzed" />
            <KpiCard
              accent="green"
              value={recLabelCount(gameTactics.white, 'created').toLocaleString()}
              label="White created"
              sub={`Missed ${recLabelCount(gameTactics.white, 'missed')} · Defended ${recLabelCount(gameTactics.white, 'defended')}`}
            />
            <KpiCard
              accent="green"
              value={recLabelCount(gameTactics.black, 'created').toLocaleString()}
              label="Black created"
              sub={`Missed ${recLabelCount(gameTactics.black, 'missed')} · Defended ${recLabelCount(gameTactics.black, 'defended')}`}
            />
            <KpiCard
              accent="pink"
              value={recLabelCount(gameTactics.white, 'missed') + recLabelCount(gameTactics.black, 'missed')}
              label="Total missed"
              sub="All sides · all tactic types"
            />
          </div>

          <Panel accent="cyan" label="White tactical summary">
            <div className="space-y-2">
              {ALL_TYPES.map((t) => {
                const created = gameTactics.white.created[t]
                const missed = gameTactics.white.missed[t]
                const defended = gameTactics.white.defended[t]
                const total = created + missed + defended
                return (
                  <div key={t} className="flex justify-between items-center px-2 py-1.5 border-b border-border/50 last:border-0">
                    <span className="text-xs font-mono text-text-primary">{TYPE_LABEL[t]}</span>
                    <div className="flex items-center gap-2 text-right min-w-[120px]">
                      <span className={`text-[10px] font-mono uppercase ${created > 0 ? 'text-green' : 'text-text-dim'}`}>
                        +{created}
                      </span>
                      <span className={`text-[10px] font-mono uppercase ${missed > 0 ? 'text-pink' : 'text-text-dim'}`}>
                        -{missed}
                      </span>
                      <span className={`text-[10px] font-mono uppercase ${defended > 0 ? 'text-orange' : 'text-text-dim'}`}>
                        d{defended}
                      </span>
                      <span className="text-[10px] font-mono text-text-muted">{total}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </Panel>

          <Panel accent="magenta" label="Black tactical summary">
            <div className="space-y-2">
              {ALL_TYPES.map((t) => {
                const created = gameTactics.black.created[t]
                const missed = gameTactics.black.missed[t]
                const defended = gameTactics.black.defended[t]
                const total = created + missed + defended
                return (
                  <div key={t} className="flex justify-between items-center px-2 py-1.5 border-b border-border/50 last:border-0">
                    <span className="text-xs font-mono text-text-primary">{TYPE_LABEL[t]}</span>
                    <div className="flex items-center gap-2 text-right min-w-[120px]">
                      <span className={`text-[10px] font-mono uppercase ${created > 0 ? 'text-green' : 'text-text-dim'}`}>
                        +{created}
                      </span>
                      <span className={`text-[10px] font-mono uppercase ${missed > 0 ? 'text-pink' : 'text-text-dim'}`}>
                        -{missed}
                      </span>
                      <span className={`text-[10px] font-mono uppercase ${defended > 0 ? 'text-orange' : 'text-text-dim'}`}>
                        d{defended}
                      </span>
                      <span className="text-[10px] font-mono text-text-muted">{total}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </Panel>

          <Panel accent="orange" label="Detected tactics">
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="min-w-full text-left border-collapse divide-y divide-border/50">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted">Ply</th>
                    <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted">Side</th>
                    <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted">Type</th>
                    <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted">Label</th>
                    <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted">Description</th>
                    <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted text-right">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {gameTactics.tactics.map((t) => (
                    <tr key={t.id} className="hover:bg-white/5 last:border-0">
                      <td className="px-3 py-2 text-xs font-mono text-text-muted">{t.ply}</td>
                      <td className="px-3 py-2 text-xs font-mono text-text-muted">{SIDE_LABEL[t.side]}</td>
                      <td className="px-3 py-2 text-xs font-mono text-text-primary">{TYPE_LABEL[t.tacticType]}</td>
                      <td className="px-3 py-2 text-xs font-mono">
                        <span className={`text-[10px] font-mono uppercase ${t.label === 'created' ? 'text-green' : t.label === 'missed' ? 'text-pink' : 'text-orange'}`}>
                          {t.label}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs font-mono text-text-muted truncate max-w-[220px]" title={t.description}>
                        {t.description}
                      </td>
                      <td className="px-3 py-2 text-xs font-mono text-text-muted text-right">{t.value}</td>
                    </tr>
                  ))}
                  {gameTactics.tactics.length === 0 && (
                    <tr>
                      <td className="px-3 py-4 text-center text-text-muted text-xs font-mono" colSpan={6}>
                        No tactics detected.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}
    </div>
  )
}
