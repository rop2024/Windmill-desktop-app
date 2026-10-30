import { useCallback, useState } from 'react'
import { Panel } from '../components/ui/Panel'
import { PrimaryButton } from '../components/ui/PrimaryButton'
import { StatusLabel } from '../components/ui/StatusLabel'

export default function Engine() {
  const [status, setStatus] = useState<'idle' | 'analyzing' | 'error'>('idle')
  const [bestmove, setBestmove] = useState<string | null>(null)
  const [score, setScore] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const runBenchmark = useCallback(async () => {
    setRunning(true)
    setError(null)
    setStatus('analyzing')
    try {
      const result = await window.api.analysis.position('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', {
        depth: 12,
        movetime: 1000
      })
      if (result.ok) {
        setBestmove(result.data.bestmove ?? '—')
        setScore(result.data.score ? (result.data.score.type === 'cp' ? `${result.data.score.value}cp` : `Mate ${result.data.score.value}`) : '—')
      } else {
        setError(result.error?.message ?? 'Benchmark failed')
        setStatus('error')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setStatus('error')
    } finally {
      setRunning(false)
      setStatus('idle')
    }
  }, [])

  const stopAnalysis = useCallback(async () => {
    try {
      await window.api.analysis.stop()
      setStatus('idle')
      setRunning(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-filter uppercase text-magenta">// engine · stockfish</span>
          <h1 className="text-page-title font-sans font-bold uppercase text-text-primary">
            Engine
          </h1>
        </div>
      </div>

      <Panel accent="magenta" label="Engine status">
        <div className="flex justify-between items-center">
          <div>
            <span className="font-mono text-filter uppercase text-text-muted text-xs block">Stockfish</span>
            <span className="text-text-primary font-sans font-bold">{status === 'error' ? 'Error' : 'Ready'}</span>
          </div>
          <StatusLabel accent={status === 'error' ? 'pink' : 'green'}>{status === 'error' ? 'ERROR' : 'ONLINE'}</StatusLabel>
        </div>
      </Panel>

      <Panel accent="cyan" label="Controls">
        <div className="flex flex-col gap-3">
          <PrimaryButton
            onClick={runBenchmark}
            disabled={running}
            className="w-full"
          >
            {running ? 'Analyzing…' : 'Run benchmark'}
          </PrimaryButton>
          <PrimaryButton
            onClick={stopAnalysis}
            disabled={status !== 'analyzing'}
            className="w-full border border-pink text-pink hover:bg-pink/10"
          >
            Stop
          </PrimaryButton>
        </div>
      </Panel>

      {bestmove && (
        <Panel accent="green" label="Result">
          <div className="grid grid-cols-3 gap-3 text-xs font-mono">
            <div className="bg-track border border-border rounded-none px-3 py-2">
              <span className="text-text-dim uppercase">Best move</span>
              <span className="text-text-primary">{bestmove}</span>
            </div>
            <div className="bg-track border border-border rounded-none px-3 py-2">
              <span className="text-text-dim uppercase">Score</span>
              <span className="text-text-primary">{score}</span>
            </div>
          </div>
        </Panel>
      )}

      {error && (
        <Panel accent="pink" label="Error">
          <span className="text-xs font-mono text-pink">{error}</span>
        </Panel>
      )}

      <div className="text-text-dim text-xs font-mono">
        <p>Engine integration is handled in the Explorer and Analysis views.</p>
        <p>Environment: Electron · Stockfish UCI</p>
      </div>
    </div>
  )
}
