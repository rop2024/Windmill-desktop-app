import { useCallback, useEffect, useState } from 'react'
import { ChessBoard } from '../components/ChessBoard'
import { Panel } from '../components/ui/Panel'
import { KpiCard } from '../components/ui/KpiCard'
import { FilterChip } from '../components/ui/FilterChip'
import { PrimaryButton } from '../components/ui/PrimaryButton'

type PuzzleDifficulty = 'easy' | 'medium' | 'hard' | 'expert'

type Puzzle = {
  id: string
  gameId: string
  ply: number
  san: string
  fenBefore: string
  fenAfter: string
  solutionSan: string
  solutionPv: string[]
  scoreCp: number | null
  scoreMate: number | null
  centipawnLoss: number | null
  difficulty: PuzzleDifficulty
  tacticType: string | null
  tacticLabel: string | null
  createdAt: number
}

type PuzzleSolve = {
  id: string
  puzzleId: string
  correct: boolean
  timeMs: number
  solvedAt: number
}

type TrainerStats = {
  totalSolves: number
  correctSolves: number
  incorrectSolves: number
  solveRate: number
  avgTimeMs: number
  currentStreak: number
  bestStreak: number
  puzzlesSolved: number
}

type TrainerSelectResult = {
  puzzle: Puzzle | null
  mode: 'daily' | 'weakness' | 'spaced'
  reason: string
}

const DIFFICULTY_LABEL: Record<PuzzleDifficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  expert: 'Expert'
}

function fmtTime(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const rem = s % 60
  return `${m}:${rem.toString().padStart(2, '0')}`
}

export default function PuzzleTrainer() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selecting, setSelecting] = useState(false)
  const [mode, setMode] = useState<'daily' | 'weakness' | 'spaced'>('daily')
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null)
  const [selectResult, setSelectResult] = useState<TrainerSelectResult | null>(null)
  const [stats, setStats] = useState<TrainerStats | null>(null)
  const [recent, setRecent] = useState<PuzzleSolve[]>([])

  // Solving state
  const [solving, setSolving] = useState(false)
  const [solutionRevealed, setSolutionRevealed] = useState(false)
  const [moveInput, setMoveInput] = useState('')
  const [solveResult, setSolveResult] = useState<'correct' | 'incorrect' | null>(null)
  const [startTime, setStartTime] = useState<number | null>(null)

  const loadStats = useCallback(async () => {
    try {
      const result = await window.api.puzzleTrainer.stats()
      if (result.ok) setStats(result.data)
      const recentResult = await window.api.puzzleTrainer.recent(10)
      if (recentResult.ok) setRecent(recentResult.data)
    } catch {
      setError('Unable to load trainer statistics')
    }
  }, [])

  const selectPuzzle = useCallback(async (m: 'daily' | 'weakness' | 'spaced') => {
    setSelecting(true)
    setSolutionRevealed(false)
    setSolveResult(null)
    setMoveInput('')
    setStartTime(null)
    try {
      const result = await window.api.puzzleTrainer.select(m)
      if (result.ok) {
        setSelectResult(result.data)
        setPuzzle(result.data.puzzle)
        setMode(m)
      } else {
        setError(result.error.message)
      }
    } catch {
      setError('Unable to select a puzzle')
    } finally {
      setSelecting(false)
    }
  }, [])

  const submitSolution = useCallback(async (userMove: string) => {
    if (!puzzle || !startTime) return
    const correct = userMove === puzzle.solutionSan
    const timeMs = Date.now() - startTime
    setSolving(true)
    try {
      const result = await window.api.puzzleTrainer.solve(puzzle.id, correct, timeMs)
      if (result.ok) {
        setSolveResult(correct ? 'correct' : 'incorrect')
        loadStats()
      }
    } catch {
      // ignore
    } finally {
      setSolving(false)
    }
  }, [puzzle, startTime, loadStats])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setError(null)
      await Promise.all([loadStats(), selectPuzzle('daily')])
      if (!cancelled) setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [loadStats, selectPuzzle])

  const elapsedMs = startTime != null ? Date.now() - startTime : 0

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-text-muted font-mono text-sm">
        Loading puzzle trainer…
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-center">
        <p className="text-text-muted font-mono text-sm">{error}</p>
        <PrimaryButton onClick={() => {
          setLoading(true)
          setError(null)
          void Promise.all([loadStats(), selectPuzzle('daily')]).finally(() => setLoading(false))
        }}>
          Retry
        </PrimaryButton>
      </div>
    )
  }

  return (
    <div className="bg-background min-h-screen space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-filter uppercase text-cyan">// puzzle trainer</span>
          <h1 className="text-page-title font-sans font-bold uppercase text-text-primary">
            Puzzle Trainer
          </h1>
        </div>
      </div>

      <div className="wm-grid-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <KpiCard accent="cyan" value={stats?.totalSolves ?? 0} label="Total solves" />
        <KpiCard accent="green" value={stats?.solveRate ?? 0} label="Solve rate" sub="%" />
        <KpiCard accent="yellow" value={stats?.currentStreak ?? 0} label="Current streak" sub="days" />
        <KpiCard accent="orange" value={stats?.bestStreak ?? 0} label="Best streak" sub="days" />
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 w-full lg:w-2/3">
          <Panel accent="magenta" label={`Puzzle · ${DIFFICULTY_LABEL[puzzle?.difficulty ?? 'easy']}`}>
            <div className="flex flex-col lg:flex-row gap-4 items-start">
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-mono text-text-muted">
                    {puzzle ? `Ply ${puzzle.ply} · ${puzzle.tacticLabel ?? 'Tactic'}` : 'Select a puzzle to begin'}
                  </span>
                  <div className="flex items-center gap-2">
                    {startTime != null && solveResult === null && (
                      <span className="text-xs font-mono text-text-primary">{fmtTime(elapsedMs)}</span>
                    )}
                    <FilterChip
                      selected={mode === 'daily'}
                      onClick={() => selectPuzzle('daily')}
                    >
                      Daily
                    </FilterChip>
                    <FilterChip
                      selected={mode === 'weakness'}
                      onClick={() => selectPuzzle('weakness')}
                    >
                      Weakness
                    </FilterChip>
                    <FilterChip
                      selected={mode === 'spaced'}
                      onClick={() => selectPuzzle('spaced')}
                    >
                      Spaced
                    </FilterChip>
                  </div>
                </div>

                {selecting && (
                  <div className="flex items-center justify-center py-8 text-text-muted text-xs font-mono">
                    Selecting puzzle…
                  </div>
                )}

                {!selecting && puzzle && (
                  <div className="flex flex-col items-center justify-center min-h-[400px]">
                    <ChessBoard
                      fen={puzzle.fenBefore}
                      orientation='w'
                      squareSize={60}
                      disabled={solveResult !== null || solutionRevealed}
                    />
                    <div className="mt-4 flex items-center gap-3">
                      <input
                        type="text"
                        value={moveInput}
                        onChange={(e) => setMoveInput(e.target.value.toUpperCase())}
                        placeholder="Enter move (e.g. Nf3)"
                        disabled={solving || solveResult !== null || solutionRevealed}
                        className="bg-panel border border-border font-mono text-text-primary px-3 py-2 rounded-none w-32 uppercase"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') submitSolution(moveInput)
                        }}
                      />
                      <button
                        onClick={() => submitSolution(moveInput)}
                        disabled={solving || solveResult !== null || solutionRevealed || moveInput === ''}
                        className="bg-transparent border border-cyan text-cyan font-mono text-xs uppercase px-3 py-2 rounded-none hover:bg-cyan/10 transition-colors"
                      >
                        Submit
                      </button>
                      <button
                        onClick={() => setSolutionRevealed(true)}
                        disabled={solving || solveResult !== null}
                        className="bg-transparent border border-border text-text-muted font-mono text-xs uppercase px-3 py-2 rounded-none hover:bg-white/5 transition-colors"
                      >
                        Reveal
                      </button>
                    </div>
                    {solveResult === 'correct' && (
                      <div className="mt-3 text-xs font-mono text-green">Correct! Well played.</div>
                    )}
                    {solveResult === 'incorrect' && (
                      <div className="mt-3 text-xs font-mono text-pink">Incorrect. The solution was {puzzle.solutionSan}.</div>
                    )}
                    {solutionRevealed && (
                      <div className="mt-3 text-xs font-mono text-text-muted">
                        Solution: {puzzle.solutionSan} · PV: {puzzle.solutionPv.slice(0, 4).join(' ')}
                      </div>
                    )}
                  </div>
                )}

                {!selecting && !puzzle && (
                  <div className="flex items-center justify-center py-8 text-text-muted text-xs font-mono">
                    {selectResult?.reason || 'No puzzle available. Generate puzzles first.'}
                  </div>
                )}
              </div>
            </div>
          </Panel>
        </div>

        <div className="flex-none lg:w-1/3">
          <Panel accent="cyan" label="Stats">
            <div className="space-y-3">
              {stats && (
                <>
                  <div className="flex justify-between items-center px-2 py-1.5 border-b border-border/50">
                    <span className="text-xs font-mono text-text-muted">Solve rate</span>
                    <span className="text-xs font-mono text-text-primary">{stats.solveRate}%</span>
                  </div>
                  <div className="flex justify-between items-center px-2 py-1.5 border-b border-border/50">
                    <span className="text-xs font-mono text-text-muted">Avg time</span>
                    <span className="text-xs font-mono text-text-primary">{fmtTime(stats.avgTimeMs)}</span>
                  </div>
                  <div className="flex justify-between items-center px-2 py-1.5 border-b border-border/50">
                    <span className="text-xs font-mono text-text-muted">Puzzles solved</span>
                    <span className="text-xs font-mono text-text-primary">{stats.puzzlesSolved}</span>
                  </div>
                  <div className="flex justify-between items-center px-2 py-1.5">
                    <span className="text-xs font-mono text-text-muted">Current streak</span>
                    <span className="text-xs font-mono text-yellow">{stats.currentStreak}</span>
                  </div>
                </>
              )}
            </div>
          </Panel>

          <Panel accent="orange" label="Recent solves">
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {recent.map((s) => (
                <div key={s.id} className="flex justify-between items-center px-2 py-1.5 border-b border-border/50 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-mono uppercase ${s.correct ? 'text-green' : 'text-pink'}`}>
                      {s.correct ? '✓' : '✗'}
                    </span>
                    <span className="text-[10px] font-mono text-text-muted">{fmtTime(s.timeMs)}</span>
                  </div>
                </div>
              ))}
              {recent.length === 0 && (
                <div className="text-text-muted text-xs font-mono py-2">No solves yet.</div>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}
