import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { Chess } from 'chess.js'
import { classificationIcon } from '@renderer/analysis/classifyMove'
import { Panel } from '../components/ui/Panel'
import { PrimaryButton } from '../components/ui/PrimaryButton'
import { ProgressBar } from '../components/ui/ProgressBar'
import { StatusLabel } from '../components/ui/StatusLabel'

type StoredPly = {
  id: number
  game_id: string
  ply: number
  fen_before: string
  fen_after: string
  score_cp: number | null
  score_mate: number | null
  bestmove: string | null
  pv: string[] | null
  depth: number | null
  centipawn_loss: number | null
  classification: string | null
  analyzed_at: number
}

type EvalPoint = {
  ply: number
  eval: number
  mate: number | null
  classification: string | null
}

export default function Analysis() {
  const { gameId } = useParams<{ gameId: string }>()

  const [plies, setPlies] = useState<StoredPly[]>([])
  const [loading, setLoading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number; currentPly: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const points = useMemo<EvalPoint[]>(() => {
    return plies.map((p) => ({
      ply: p.ply,
      eval: p.score_cp !== null ? p.score_cp / 100 : p.score_mate !== null ? (p.score_mate > 0 ? 10 : -10) : 0,
      mate: p.score_mate,
      classification: p.classification
    }))
  }, [plies])

  const totalClassifications = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of plies) {
      const c = p.classification ?? 'none'
      map.set(c, (map.get(c) ?? 0) + 1)
    }
    return map
  }, [plies])

  const whiteAccuracy = useMemo(() => {
    const inputs = plies.filter((p) => p.ply % 2 === 1)
    if (inputs.length === 0) return null
    const sum = inputs.reduce((a, b) => a + (b.centipawn_loss !== null ? 100 - Math.min(100, Math.max(0, b.centipawn_loss)) : 75), 0)
    return Math.round((sum / inputs.length) * 10) / 10
  }, [plies])

  const blackAccuracy = useMemo(() => {
    const inputs = plies.filter((p) => p.ply % 2 === 0)
    if (inputs.length === 0) return null
    const sum = inputs.reduce((a, b) => a + (b.centipawn_loss !== null ? 100 - Math.min(100, Math.max(0, b.centipawn_loss)) : 75), 0)
    return Math.round((sum / inputs.length) * 10) / 10
  }, [plies])

  useEffect(() => {
    if (!gameId) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setPlies([])
      setError(null)
      try {
        const result = await window.api.analysis.getForGame(gameId)
        if (!cancelled && result.ok) {
          setPlies(result.data.plies)
        } else if (!cancelled) {
          setError(result.error.message)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [gameId])

  type AnalysisProgressEvent = {
    gameId: string
    done: number
    total: number
    currentPly: number
  }

  useEffect(() => {
    const unsubProgress = window.api.analysis.onProgress((p: unknown) => {
      const ev = p as AnalysisProgressEvent
      if (ev.gameId === gameId) {
        setProgress({ done: ev.done, total: ev.total, currentPly: ev.currentPly })
        setAnalyzing(true)
      }
    })
    const unsubComplete = window.api.analysis.onGameComplete((result: unknown) => {
      const ev = result as { gameId?: string }
      if (ev.gameId !== gameId) return
      setAnalyzing(false)
      setProgress(null)
      void window.api.analysis.getForGame(gameId!).then((analysisResult) => {
        if (analysisResult.ok) setPlies(analysisResult.data.plies)
      })
    })
    const unsubError = window.api.analysis.onGameError((result: unknown) => {
      const ev = result as { gameId?: string; error?: string }
      if (ev.gameId !== gameId) return
      setAnalyzing(false)
      setProgress(null)
      setError(ev.error ?? 'Game analysis failed')
    })
    return () => {
      unsubProgress()
      unsubComplete()
      unsubError()
    }
  }, [gameId])

  const handleAnalyze = async () => {
    if (!gameId) return
    setAnalyzing(true)
    setProgress({ done: 0, total: 0, currentPly: 0 })
    setError(null)
    try {
      const result = await window.api.analysis.startGame(gameId)
      if (!result.ok) {
        setError(result.error.message)
        setAnalyzing(false)
      }
    } catch (e) {
      setError(String(e))
      setAnalyzing(false)
    }
  }

  const handleCancel = async () => {
    if (!gameId) return
    await window.api.analysis.cancel(gameId)
    setAnalyzing(false)
    setProgress(null)
  }

  const sanForPly = useCallback((fenBefore: string, fenAfter: string): string => {
    try {
      const chess = new Chess(fenBefore)
      const moves = chess.moves({ verbose: true })
      const found = moves.find((m: { after: string; san: string }) => m.after === fenAfter)
      return found ? found.san : '?'
    } catch {
      return '?'
    }
  }, [])

  const findingState = (cls: string | null): 'GOOD' | 'QUEUED' | 'READY' => {
    switch (cls) {
      case 'best': return 'GOOD'
      case 'excellent': return 'GOOD'
      case 'good': return 'GOOD'
      case null: return 'QUEUED'
      default: return 'READY'
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-text-muted font-mono text-sm">
        Loading analysis…
      </div>
    )
  }

  const pct = progress ? Math.min(100, (progress.done / Math.max(1, progress.total)) * 100) : 0

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-filter uppercase text-magenta">// analysis · stockfish</span>
          <h1 className="text-page-title font-sans font-bold uppercase text-text-primary">
            Analysis
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <PrimaryButton onClick={handleAnalyze} disabled={analyzing}>
            {analyzing ? 'Analyzing…' : plies.length > 0 ? 'Analyze again' : 'Analyze game'}
          </PrimaryButton>
          <button
            onClick={handleCancel}
            disabled={!analyzing}
            className="bg-transparent border border-border rounded-none px-3 py-2 text-xs font-mono text-cyan uppercase hover:border-cyan focus-visible:outline-2 focus-visible:outline-cyan disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <KpiCardStyle accent="green" value={whiteAccuracy != null ? whiteAccuracy.toFixed(1) : '—'} label="White accuracy" />
        <KpiCardStyle accent="green" value={blackAccuracy != null ? blackAccuracy.toFixed(1) : '—'} label="Black accuracy" />
        <KpiCardStyle accent="magenta" value={plies.length} label="Positions" sub="analyzed" />
      </div>

      <Panel accent="green" label="Engine status">
        <div className="space-y-3">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-text-muted font-mono uppercase">Readiness</span>
            <StatusLabel accent={analyzing ? 'magenta' : 'green'}>
              {analyzing ? 'ENGINE ACTIVE' : 'READY'}
            </StatusLabel>
          </div>
          {progress && (
            <>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-text-muted font-mono uppercase">Progress</span>
                <span className="text-text-primary font-mono">{progress.done} / {progress.total}</span>
              </div>
              <ProgressBar value={pct} accent="green" />
            </>
          )}
          {error && (
            <div className="text-text-dim text-xs font-mono">{error}</div>
          )}
        </div>
      </Panel>

      <Panel accent="magenta" label="Findings">
        <div className="space-y-2">
          {['best', 'excellent', 'good', 'inaccuracy', 'mistake', 'blunder'].map((cls) => {
            const count = totalClassifications.get(cls) ?? 0
            const state = findingState(cls)
            return (
              <div key={cls} className="flex justify-between items-center px-2 py-1.5 border-b border-border/50 last:border-0">
                <span className="text-xs font-mono text-text-muted uppercase">{cls}</span>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-mono ${cls === 'blunder' || cls === 'mistake' ? 'text-pink' : cls === 'inaccuracy' ? 'text-orange' : 'text-green'} font-bold`}>
                    {count}
                  </span>
                  <StatusLabel accent={state === 'GOOD' ? 'green' : state === 'READY' ? 'magenta' : 'cyan'}>
                    {state}
                  </StatusLabel>
                </div>
              </div>
            )
          })}
          {plies.length === 0 && (
            <div className="text-text-muted text-xs font-mono py-2">No findings. Run analysis first.</div>
          )}
        </div>
      </Panel>

      <Panel accent="cyan" label="Evaluation graph">
        <div className="h-[300px] w-full flex items-center justify-center text-text-muted text-xs font-mono">
          {points.length > 0 ? 'Evaluation graph available in explorer view.' : 'No evaluation data. Run analysis first.'}
        </div>
      </Panel>

      <Panel accent="magenta" label="Move classifications">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left border-collapse divide-y divide-border/50">
            <thead>
              <tr className="border-b border-border">
                <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted">Ply</th>
                <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted">Move</th>
                <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted">Classification</th>
                <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted text-right">Eval</th>
              </tr>
            </thead>
            <tbody>
              {plies.map((p) => {
                const san = sanForPly(p.fen_before, p.fen_after)
                const cls = p.classification as ('best' | 'excellent' | 'good' | 'inaccuracy' | 'mistake' | 'blunder') | null
                const state = findingState(cls)
                return (
                  <tr key={p.ply} className="hover:bg-white/5 last:border-0">
                    <td className="px-3 py-2 text-xs font-mono text-text-muted">{Math.ceil(p.ply / 2)}.</td>
                    <td className="px-3 py-2 text-xs font-sans font-bold text-text-primary">{san}</td>
                    <td className="px-3 py-2 text-xs">
                      <StatusLabel accent={state === 'GOOD' ? 'green' : state === 'READY' ? 'magenta' : 'cyan'}>
                        {classificationIcon(cls) || '—'}
                      </StatusLabel>
                    </td>
                    <td className="px-3 py-2 text-xs font-mono text-text-muted text-right">
                      {p.score_cp !== null ? (p.score_cp / 100).toFixed(2) : p.score_mate !== null ? `M#${p.score_mate}` : '—'}
                    </td>
                  </tr>
                )
              })}
              {plies.length === 0 && (
                <tr>
                  <td className="px-3 py-4 text-center text-text-muted text-xs font-mono" colSpan={4}>
                    No analysis data.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="mt-4 text-text-dim text-xs font-mono">
        <p>Engine: Stockfish</p>
        <p>Finding states: GOOD · QUEUED · READY</p>
      </div>
    </div>
  )
}

function KpiCardStyle({ accent, value, label, sub }: { accent: string; value: string | number; label: string; sub?: string }) {
  return (
    <div className={`bg-panel border-l-4 clip-path-panel px-4 py-3.5 border-${accent}`}>
      <div className="font-mono text-filter uppercase text-text-muted">{label}</div>
      <div className="text-kpi-value font-sans font-bold mt-1 leading-tight" style={{ color: accent === 'cyan' ? '#00F0FF' : accent === 'yellow' ? '#FCEE09' : accent === 'green' ? '#5DFF6A' : accent === 'magenta' ? '#B026FF' : accent === 'pink' ? '#FF2A6D' : '#FF9F43' }}>
        {value}
      </div>
      {sub && <div className="text-text-dim text-xs mt-1 font-mono">{sub}</div>}
    </div>
  )
}
