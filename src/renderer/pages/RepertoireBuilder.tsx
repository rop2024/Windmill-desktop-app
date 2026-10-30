import { useCallback, useEffect, useState } from 'react'
import { Panel } from '../components/ui/Panel'
import { KpiCard } from '../components/ui/KpiCard'
import { FilterChip } from '../components/ui/FilterChip'

type RepertoireLine = {
  id: string
  color: 'w' | 'b'
  eco: string | null
  name: string
  moves: string[]
  priority: 'high' | 'medium' | 'low'
  addedAt: number
  updatedAt: number
}

type RepertoireCoverageLine = RepertoireLine & {
  gamesPlayed: number
  wins: number
  losses: number
  draws: number
  winRate: number
  lastPlayed: number | null
  coveragePct: number
  status: 'covered' | 'weak' | 'forgotten' | 'untouched'
}

type RepertoireSummary = {
  totalLines: number
  coveredLines: number
  weakLines: number
  forgottenLines: number
  untouchedLines: number
  overallCoverage: number
  coverageByColor: Record<string, { total: number; covered: number }>
}

const STATUS_COLOR: Record<string, string> = {
  covered: 'green',
  weak: 'pink',
  forgotten: 'orange',
  untouched: 'text-text-muted'
}

const STATUS_LABEL: Record<string, string> = {
  covered: 'Covered',
  weak: 'Weak',
  forgotten: 'Forgotten',
  untouched: 'Untouched'
}

const PRIORITY_COLOR: Record<string, 'cyan' | 'yellow' | 'green' | 'magenta' | 'pink' | 'orange'> = {
  high: 'pink',
  medium: 'orange',
  low: 'yellow'
}

function fmtDate(ms: number | null): string {
  if (!ms) return '—'
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function RepertoireBuilder() {
  const [loading, setLoading] = useState(false)
  const [lines, setLines] = useState<RepertoireCoverageLine[]>([])
  const [summary, setSummary] = useState<RepertoireSummary | null>(null)
const [error, setError] = useState<string | null>(null)
  const [newColor, setNewColor] = useState<'w' | 'b'>('w')
  const [newEco, setNewEco] = useState('')
  const [newName, setNewName] = useState('')
  const [newMoves, setNewMoves] = useState('')
  const [newPriority, setNewPriority] = useState<'high' | 'medium' | 'low'>('medium')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [covRes, sumRes] = await Promise.all([
        window.api.repertoire.coverage(),
        window.api.repertoire.summary()
      ])
      if (covRes.ok) setLines(covRes.data)
      if (sumRes.ok) setSummary(sumRes.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const addLine = useCallback(async () => {
    const moves = newMoves.split(/\s+/).filter(Boolean)
    if (!newName.trim() || moves.length === 0) return
    setLoading(true)
    try {
      const res = await window.api.repertoire.add({
        color: newColor,
        eco: newEco.trim() || null,
        name: newName.trim(),
        moves,
        priority: newPriority
      })
      if (res.ok) {
        setNewEco('')
        setNewName('')
        setNewMoves('')
        await load()
      } else {
        setError(res.error?.message ?? 'Failed to add line')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [newColor, newEco, newName, newMoves, newPriority, load])

  const deleteLine = useCallback(async (id: string) => {
    if (!confirm('Delete this repertoire line?')) return
    setLoading(true)
    try {
      await window.api.repertoire.delete(id)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [load])

  const colorLabel = (c: string) => (c === 'w' ? 'White' : 'Black')

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-text-muted font-mono text-sm">
        Loading repertoire…
      </div>
    )
  }

  return (
    <div className="bg-background min-h-screen space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-filter uppercase text-cyan">// repertoire</span>
          <h1 className="text-page-title font-sans font-bold uppercase text-text-primary">
            Opening Repertoire Builder
          </h1>
        </div>
      </div>

      <div className="wm-grid-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <KpiCard accent="cyan" value={summary?.totalLines ?? 0} label="Lines" />
        <KpiCard accent="green" value={summary?.overallCoverage ?? 0} label="Coverage" sub="%" />
        <KpiCard accent="pink" value={summary?.weakLines ?? 0} label="Weak lines" />
        <KpiCard accent="orange" value={summary?.forgottenLines ?? 0} label="Forgotten" />
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 w-full lg:w-2/3">
          <Panel accent="magenta" label="Repertoire lines">
            <div className="space-y-2">
              {lines.length > 0 ? (
                lines.map((l) => (
                  <div key={l.id} className="flex items-center justify-between px-3 py-2 border-b border-border/50 last:border-0 bg-white/5 rounded-none">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-mono font-bold ${STATUS_COLOR[l.status]}`}>{l.name}</span>
                        <span className={`text-[10px] font-mono ${STATUS_COLOR[l.status]}`}>{STATUS_LABEL[l.status]}</span>
                        <span className={`text-[10px] font-mono ${PRIORITY_COLOR[l.priority]}`}>{l.priority}</span>
                        <span className="text-[10px] font-mono text-text-muted">{colorLabel(l.color)} · {l.eco ?? '—'}</span>
                      </div>
                      <span className="text-[10px] font-mono text-text-muted truncate max-w-xs">{l.moves.join(' ')}</span>
                    </div>
                    <div className="flex items-center gap-2 text-right">
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="text-xs font-mono text-text-primary">{cFormat(l.winRate)}%</span>
                        <span className="text-[10px] font-mono text-text-muted">{l.gamesPlayed} games</span>
                      </div>
                      <span className="text-[10px] font-mono text-text-muted">{fmtDate(l.lastPlayed)}</span>
                      <button
                        onClick={() => deleteLine(l.id)}
                        className="text-[10px] font-mono text-pink hover:bg-pink/10 px-2 py-1 rounded-none"
                        title="Delete"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-text-muted text-xs font-mono py-4 text-center">
                  No repertoire lines defined. Add your first line below.
                </div>
              )}
            </div>
          </Panel>
        </div>

        <div className="flex-none lg:w-1/3">
          <Panel accent="cyan" label="Add repertoire line">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-text-muted">Color</span>
                <div className="flex gap-1">
                  <FilterChip
                    selected={newColor === 'w'}
                    onClick={() => setNewColor('w')}
                  >
                    White
                  </FilterChip>
                  <FilterChip
                    selected={newColor === 'b'}
                    onClick={() => setNewColor('b')}
                  >
                    Black
                  </FilterChip>
                </div>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newEco}
                  onChange={(e) => setNewEco(e.target.value)}
                  placeholder="ECO (e.g. C50)"
                  className="bg-panel border border-border font-mono text-text-primary px-2 py-2 rounded-none uppercase w-20"
                />
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Name (e.g. Italian Game)"
                  className="flex-1 bg-panel border border-border font-mono text-text-primary px-3 py-2 rounded-none uppercase"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono text-text-muted block mb-1">Moves (SAN, space-separated)</label>
                <input
                  type="text"
                  value={newMoves}
                  onChange={(e) => setNewMoves(e.target.value)}
                  placeholder="e.g. e4 e5 Nf3 Nc6 Bc4"
                  className="bg-panel border border-border font-mono text-text-primary px-3 py-2 rounded-none w-full uppercase"
                />
              </div>
              <div className="flex gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-text-muted">Priority</span>
                  <div className="flex gap-1">
                    <FilterChip
                      selected={newPriority === 'high'}
                      onClick={() => setNewPriority('high')}
                    >
                      High
                    </FilterChip>
                    <FilterChip
                      selected={newPriority === 'medium'}
                      onClick={() => setNewPriority('medium')}
                    >
                      Medium
                    </FilterChip>
                    <FilterChip
                      selected={newPriority === 'low'}
                      onClick={() => setNewPriority('low')}
                    >
                      Low
                    </FilterChip>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={addLine}
                  disabled={loading || !newName.trim() || newMoves.split(/\s+/).filter(Boolean).length === 0}
                  className="flex-1 bg-transparent border border-cyan text-cyan font-mono text-xs uppercase px-4 py-2.5 rounded-none hover:bg-cyan/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add line
                </button>
                <button
                  className="flex-1 bg-transparent border border-border text-text-muted font-mono text-xs uppercase px-4 py-2.5 rounded-none hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </Panel>

          <Panel accent="orange" label="Study plan">
            <div className="space-y-2">
              <div className="text-xs font-mono font-bold text-text-primary mb-2">
                Lines to study
              </div>
              {lines
                .filter((l) => l.status !== 'covered')
                .slice(0, 5)
                .map((l) => (
                  <div key={l.id} className="flex justify-between items-center px-2 py-1.5 border-b border-border/50 last:border-0">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-mono font-bold text-text-primary">{l.name}</span>
                      <span className={`text-[10px] font-mono ${STATUS_COLOR[l.status]}`}>{STATUS_LABEL[l.status]}</span>
                    </div>
                    <span className="text-xs font-mono text-text-primary">{l.priority}</span>
                  </div>
                ))}
              {lines.filter((l) => l.status !== 'covered').length === 0 && (
                <div className="text-text-muted text-xs font-mono py-2 text-center">Nothing to study — all lines covered!</div>
              )}
            </div>
          </Panel>
        </div>
      </div>

      <Panel accent="cyan" label="Coverage summary">
        <div className="space-y-3">
          {summary && (
            <>
              <div className="flex justify-between items-center px-2 py-1.5 border-b border-border/50">
                <span className="text-xs font-mono text-text-muted">Total lines</span>
                <span className="text-xs font-mono text-text-primary">{summary.totalLines}</span>
              </div>
              <div className="flex justify-between items-center px-2 py-1.5 border-b border-border/50">
                <span className="text-xs font-mono text-text-muted">Covered</span>
                <span className="text-xs font-mono text-green">{summary.coveredLines}</span>
              </div>
              <div className="flex justify-between items-center px-2 py-1.5 border-b border-border/50">
                <span className="text-xs font-mono text-text-muted">Weak</span>
                <span className="text-xs font-mono text-pink">{summary.weakLines}</span>
              </div>
              <div className="flex justify-between items-center px-2 py-1.5 border-b border-border/50">
                <span className="text-xs font-mono text-text-muted">Forgotten</span>
                <span className="text-xs font-mono text-orange">{summary.forgottenLines}</span>
              </div>
              <div className="flex justify-between items-center px-2 py-1.5">
                <span className="text-xs font-mono text-text-muted">Untouched</span>
                <span className="text-xs font-mono text-text-muted">{summary.untouchedLines}</span>
              </div>
              <div className="pt-2 border-t border-border/50">
                <div className="flex justify-between items-center px-2 py-1.5">
                  <span className="text-xs font-mono text-text-muted">Overall coverage</span>
                  <span className="text-xs font-mono text-text-primary">{summary.overallCoverage}%</span>
                </div>
              </div>
            </>
          )}
        </div>
      </Panel>

      {error && (
        <div className="fixed bottom-4 right-4 bg-pink/10 border border-pink/30 text-pink text-xs font-mono px-3 py-2 rounded-none">
          {error}
        </div>
      )}
    </div>
  )
}

function cFormat(n: number): string {
  return n.toFixed(1)
}
