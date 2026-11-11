import { useCallback, useEffect, useState } from 'react'
import { Panel } from '../components/ui/Panel'
import { KpiCard } from '../components/ui/KpiCard'

type BoardGame = {
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
  accuracy: number
  moves: number
  blunders: number
  tacticsCreated: number
  tacticsDefended: number
  timeClass: string | null
}

type BoardMove = {
  id: string
  gameId: string
  ply: number
  san: string
  classification: string | null
  centipawnLoss: number | null
  scoreCp: number | null
  scoreMate: number | null
  accuracy: number
  gameResult: string
  gameOutcome: string | null
  playedAt: number | null
  opponentRating: number | null
}

type BoardUpset = BoardGame & { ratingDiff: number }

type BoardSacrifice = BoardMove & { evalSwing: number }

type FameSummary = {
  bestGames: BoardGame[]
  bestMoves: BoardMove[]
  mostAccurateGames: BoardGame[]
  upsets: BoardUpset[]
  sacrifices: BoardSacrifice[]
}

type ShameGame = {
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
  accuracy: number
  moves: number
  blunders: number
  tacticsMissed: number
  tacticsDefended: number
  timeClass: string | null
}

type ShameMove = {
  id: string
  gameId: string
  ply: number
  san: string
  classification: string | null
  centipawnLoss: number | null
  scoreCp: number | null
  scoreMate: number | null
  accuracy: number
  gameResult: string
  gameOutcome: string | null
  playedAt: number | null
  opponentRating: number | null
}

type ShameThrow = ShameGame & { evalSwing: number; thrownFrom: string }

type ShameMissedMate = ShameGame & { mateIn: number }

type ShameTimeTrouble = ShameGame & { accuracyDrop: number }

type ShameSummary = {
  worstBlunders: ShameMove[]
  largestThrows: ShameThrow[]
  fastestLosses: ShameGame[]
  missedMates: ShameMissedMate[]
  timeTrouble: ShameTimeTrouble[]
  missedTactics: number
}

const ACCENT_FOR_ACC: (value: number) => 'cyan' | 'yellow' | 'green' | 'magenta' | 'pink' | 'orange' = (v) => {
  if (v >= 90) return 'green'
  if (v >= 80) return 'yellow'
  if (v >= 70) return 'cyan'
  if (v >= 60) return 'orange'
  return 'pink'
}

function fmtDate(ms: number | null): string {
  if (!ms) return '—'
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtRating(r: number | null): string {
  return r != null ? String(r) : '—'
}

function outcomeColor(o: string | null): 'cyan' | 'yellow' | 'green' | 'magenta' | 'pink' | 'orange' {
  if (o === 'win') return 'green'
  if (o === 'loss') return 'pink'
  return 'yellow'
}

export default function Board() {
  const [loading, setLoading] = useState(true)
  const [fame, setFame] = useState<FameSummary | null>(null)
  const [shame, setShame] = useState<ShameSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadSummaries = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [fameRes, shameRes] = await Promise.all([
        window.api.fame.summary(),
        window.api.shame.summary(),
      ])
      if (fameRes.ok) setFame(fameRes.data as FameSummary)
      else setError(fameRes.error?.message ?? 'Failed to load board of fame')
      if (shameRes.ok) setShame(shameRes.data as ShameSummary)
      else setError(shameRes.error?.message ?? 'Failed to load board of shame')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSummaries()
  }, [loadSummaries])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-text-muted font-mono text-sm">
        Loading board…
      </div>
    )
  }

  const f = fame ?? {
    bestGames: [],
    bestMoves: [],
    mostAccurateGames: [],
    upsets: [],
    sacrifices: [],
  }
  const s = shame ?? {
    worstBlunders: [],
    largestThrows: [],
    fastestLosses: [],
    missedMates: [],
    timeTrouble: [],
    missedTactics: 0,
  }

  return (
    <div className="bg-background min-h-screen space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-filter uppercase text-cyan">// board</span>
          <h1 className="text-page-title font-sans font-bold uppercase text-text-primary">
            Board
          </h1>
        </div>
      </div>

      {/* Board of Fame */}
      <section className="space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="font-mono text-filter uppercase text-cyan">// board of fame</span>
            <h2 className="text-page-title font-sans font-bold uppercase text-text-primary">
              Board of Fame
            </h2>
          </div>
        </div>

        <div className="wm-grid-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <KpiCard accent="cyan" value={f.bestGames.length} label="Best games" />
          <KpiCard accent="green" value={f.mostAccurateGames.length} label="Accurate games" />
          <KpiCard accent="orange" value={f.upsets.length} label="Upsets" />
          <KpiCard accent="magenta" value={f.sacrifices.length} label="Sacrifices" />
        </div>

        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 w-full lg:w-3/4">
            <Panel accent="magenta" label="Best games">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left border-collapse divide-y divide-border/50">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted">Game</th>
                      <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted text-right">Accuracy</th>
                      <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted text-right">Moves</th>
                      <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted text-right">Result</th>
                      <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted text-right">Opponent</th>
                      <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted text-right">Tactics</th>
                      <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted text-right">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {f.bestGames.map((g) => (
                      <tr key={g.id} className="hover:bg-white/5 last:border-0">
                        <td className="px-3 py-2 text-xs font-sans text-text-primary">{g.whitePlayer} vs {g.blackPlayer}</td>
                        <td className="px-3 py-2 text-xs font-mono text-right">
                          <span className={`text-[10px] font-mono ${ACCENT_FOR_ACC(g.accuracy)}`}>{g.accuracy.toFixed(1)}</span>
                        </td>
                        <td className="px-3 py-2 text-xs font-mono text-right">{g.moves}</td>
                        <td className="px-3 py-2 text-xs font-mono text-right">
                          <span className={`text-[10px] font-mono uppercase ${outcomeColor(g.outcome)}`}>
                            {g.outcome ?? '*'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs font-mono text-right">{fmtRating(g.opponentRating)}</td>
                        <td className="px-3 py-2 text-xs font-mono text-green text-right">{g.tacticsCreated}</td>
                        <td className="px-3 py-2 text-xs font-mono text-right">{fmtDate(g.playedAt)}</td>
                      </tr>
                    ))}
                    {f.bestGames.length === 0 && (
                      <tr>
                        <td className="px-3 py-4 text-center text-text-muted text-xs font-mono" colSpan={7}>
                          No games analyzed yet. Analyze games to populate the board of fame.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Panel>

            <Panel accent="cyan" label="Most accurate games">
              <div className="overflow-x-auto max-h-[320px] overflow-y-auto">
                <table className="min-w-full text-left border-collapse divide-y divide-border/50">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted">Game</th>
                      <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted text-right">Accuracy</th>
                      <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted text-right">Blunders</th>
                      <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted text-right">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {f.mostAccurateGames.map((g) => (
                      <tr key={g.id} className="hover:bg-white/5 last:border-0">
                        <td className="px-3 py-2 text-xs font-sans text-text-primary">{g.whitePlayer} vs {g.blackPlayer}</td>
                        <td className="px-3 py-2 text-xs font-mono text-right">
                          <span className={`text-[10px] font-mono ${ACCENT_FOR_ACC(g.accuracy)}`}>{g.accuracy.toFixed(1)}</span>
                        </td>
                        <td className="px-3 py-2 text-xs font-mono text-right">{g.blunders}</td>
                        <td className="px-3 py-2 text-xs font-mono text-right">
                          <span className={`text-[10px] font-mono uppercase ${outcomeColor(g.outcome)}`}>
                            {g.outcome ?? '*'}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {f.mostAccurateGames.length === 0 && (
                      <tr>
                        <td className="px-3 py-4 text-center text-text-muted text-xs font-mono" colSpan={4}>
                          No data available.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>

          <div className="flex-none lg:w-1/4">
            <Panel accent="orange" label="Largest upsets">
              <div className="space-y-2">
                {f.upsets.map((u) => (
                  <div key={u.id} className="flex justify-between items-center px-2 py-1.5 border-b border-border/50 last:border-0">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-mono text-text-primary">{u.whitePlayer} vs {u.blackPlayer}</span>
                      <span className="text-[10px] font-mono text-text-muted">{fmtDate(u.playedAt)}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-mono text-green">+{u.ratingDiff}</span>
                      <span className="text-[10px] font-mono text-text-muted block">{u.outcome === 'win' ? 'Win' : u.outcome}</span>
                    </div>
                  </div>
                ))}
                {f.upsets.length === 0 && (
                  <div className="text-text-muted text-xs font-mono py-2 text-center">No upsets found.</div>
                )}
              </div>
            </Panel>

            <Panel accent="magenta" label="Brilliant sacrifices">
              <div className="space-y-2 max-h-[320px] overflow-y-auto">
                {f.sacrifices.map((m) => (
                  <div key={m.id} className="flex justify-between items-center px-2 py-1.5 border-b border-border/50 last:border-0">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-mono text-text-primary">Ply {m.ply} · {m.classification}</span>
                      <span className="text-[10px] font-mono text-text-muted">{m.gameResult}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-mono text-yellow">+{m.evalSwing}</span>
                      <span className="text-[10px] font-mono text-text-muted block">{fmtRating(m.opponentRating)}</span>
                    </div>
                  </div>
                ))}
                {f.sacrifices.length === 0 && (
                  <div className="text-text-muted text-xs font-mono py-2 text-center">No sacrifices found.</div>
                )}
              </div>
            </Panel>
          </div>
        </div>

        <Panel accent="green" label="Best moves">
          <div className="overflow-x-auto max-h-[340px] overflow-y-auto">
            <table className="min-w-full text-left border-collapse divide-y divide-border/50">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted">Ply</th>
                  <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted">Move</th>
                  <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted text-right">Class.</th>
                  <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted text-right">Accuracy</th>
                  <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted text-right">Eval gain</th>
                  <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted text-right">Opponent</th>
                </tr>
              </thead>
              <tbody>
                {f.bestMoves.map((m) => (
                  <tr key={m.id} className="hover:bg-white/5 last:border-0">
                    <td className="px-3 py-2 text-xs font-mono text-text-muted">{m.ply}</td>
                    <td className="px-3 py-2 text-xs font-mono text-text-primary">{m.san ? m.san : '—'}</td>
                    <td className="px-3 py-2 text-xs font-mono text-right">
                        <span className={`text-[10px] font-mono uppercase ${m.classification === 'best' ? 'text-green' : 'text-yellow'}`}>
                          {m.classification?.toUpperCase() ?? '—'}
                        </span>
                    </td>
                    <td className="px-3 py-2 text-xs font-mono text-right">
                      <span className={`text-[10px] font-mono ${ACCENT_FOR_ACC(m.accuracy)}`}>{m.accuracy.toFixed(1)}</span>
                    </td>
                    <td className="px-3 py-2 text-xs font-mono text-right">
                      <span className="text-[10px] font-mono text-text-muted">{m.centipawnLoss != null ? m.centipawnLoss : '—'}</span>
                    </td>
                    <td className="px-3 py-2 text-xs font-mono text-right">{fmtRating(m.opponentRating)}</td>
                  </tr>
                ))}
                {f.bestMoves.length === 0 && (
                  <tr>
                    <td className="px-3 py-4 text-center text-text-muted text-xs font-mono" colSpan={6}>
                      No best moves found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      </section>

      {/* Board of Shame */}
      <section className="space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="font-mono text-filter uppercase text-pink">// board of shame</span>
            <h2 className="text-page-title font-sans font-bold uppercase text-text-primary">
              Board of Shame
            </h2>
          </div>
        </div>

        <div className="wm-grid-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <KpiCard accent="pink" value={s.worstBlunders.length} label="Worst blunders" />
          <KpiCard accent="orange" value={s.largestThrows.length} label="Throws" />
          <KpiCard accent="magenta" value={s.fastestLosses.length} label="Fastest losses" />
          <KpiCard accent="cyan" value={s.timeTrouble.length} label="Time trouble" />
          <KpiCard accent="pink" value={s.missedTactics} label="Missed tactics" />
        </div>

        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 w-full lg:w-3/4">
            <Panel accent="pink" label="Worst blunders">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left border-collapse divide-y divide-border/50">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted">Move</th>
                      <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted text-right">CP loss</th>
                      <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted text-right">Ply</th>
                      <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted text-right">Game</th>
                      <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted text-right">Result</th>
                      <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted text-right">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.worstBlunders.map((m) => (
                      <tr key={m.id} className="hover:bg-white/5 last:border-0">
                        <td className="px-3 py-2 text-xs font-mono text-text-primary">{m.san ? m.san : '—'}</td>
                        <td className="px-3 py-2 text-xs font-mono text-right">
                          <span className="text-[10px] font-mono text-pink">{m.centipawnLoss ?? 0}</span>
                        </td>
                        <td className="px-3 py-2 text-xs font-mono text-right">{m.ply}</td>
                        <td className="px-3 py-2 text-xs font-sans text-text-primary">{m.gameResult}</td>
                        <td className="px-3 py-2 text-xs font-mono text-right">
                          <span className={`text-[10px] font-mono uppercase ${outcomeColor(m.gameOutcome)}`}>
                            {m.gameOutcome ?? '*'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs font-mono text-right">{fmtDate(m.playedAt)}</td>
                      </tr>
                    ))}
                    {s.worstBlunders.length === 0 && (
                      <tr>
                        <td className="px-3 py-4 text-center text-text-muted text-xs font-mono" colSpan={6}>
                          No blunders detected yet. Analyze games to populate the board of shame.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Panel>

            <Panel accent="orange" label="Largest throws (winning → loss)">
              <div className="space-y-2 max-h-[320px] overflow-y-auto">
                {s.largestThrows.map((t) => (
                  <div key={t.id} className="flex justify-between items-center px-2 py-1.5 border-b border-border/50 last:border-0">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-mono text-text-primary">{t.whitePlayer} vs {t.blackPlayer}</span>
                      <span className="text-[10px] font-mono text-text-muted">{fmtDate(t.playedAt)}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-mono text-pink">-{t.evalSwing}</span>
                      <span className="text-[10px] font-mono text-text-muted block">{t.outcome === 'loss' ? 'Loss' : t.outcome}</span>
                    </div>
                  </div>
                ))}
                {s.largestThrows.length === 0 && (
                  <div className="text-text-muted text-xs font-mono py-2 text-center">No throws found.</div>
                )}
              </div>
            </Panel>
          </div>

          <div className="flex-none lg:w-1/4">
            <Panel accent="magenta" label="Fastest losses">
              <div className="space-y-2">
                {s.fastestLosses.map((g) => (
                  <div key={g.id} className="flex justify-between items-center px-2 py-1.5 border-b border-border/50 last:border-0">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-mono text-text-primary">{g.whitePlayer} vs {g.blackPlayer}</span>
                      <span className="text-[10px] font-mono text-text-muted">{fmtDate(g.playedAt)}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-mono text-pink">{g.moves} moves</span>
                    </div>
                  </div>
                ))}
                {s.fastestLosses.length === 0 && (
                  <div className="text-text-muted text-xs font-mono py-2 text-center">No fast losses found.</div>
                )}
              </div>
            </Panel>

            <Panel accent="cyan" label="Missed mates">
              <div className="space-y-2">
                {s.missedMates.map((m) => (
                  <div key={m.id} className="flex justify-between items-center px-2 py-1.5 border-b border-border/50 last:border-0">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-mono text-text-primary">{m.whitePlayer} vs {m.blackPlayer}</span>
                      <span className="text-[10px] font-mono text-text-muted">{fmtDate(m.playedAt)}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-mono text-yellow">Mate in {m.mateIn}</span>
                    </div>
                  </div>
                ))}
                {s.missedMates.length === 0 && (
                  <div className="text-text-muted text-xs font-mono py-2 text-center">No missed mates found.</div>
                )}
              </div>
            </Panel>

            <Panel accent="orange" label="Time trouble">
              <div className="space-y-2 max-h-[320px] overflow-y-auto">
                {s.timeTrouble.map((t) => (
                  <div key={t.id} className="flex justify-between items-center px-2 py-1.5 border-b border-border/50 last:border-0">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-mono text-text-primary">{t.whitePlayer} vs {t.blackPlayer}</span>
                      <span className="text-[10px] font-mono text-text-muted">{fmtDate(t.playedAt)}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-mono text-pink">-{t.accuracyDrop}</span>
                      <span className="text-[10px] font-mono text-text-muted block">{t.outcome === 'loss' ? 'Loss' : t.outcome}</span>
                    </div>
                  </div>
                ))}
                {s.timeTrouble.length === 0 && (
                  <div className="text-text-muted text-xs font-mono py-2 text-center">No time trouble detected.</div>
                )}
              </div>
            </Panel>
          </div>
        </div>
      </section>

      {error && (
        <div className="fixed bottom-4 right-4 bg-pink/10 border border-pink/30 text-pink text-xs font-mono px-3 py-2 rounded-none">
          {error}
        </div>
      )}
    </div>
  )
}
