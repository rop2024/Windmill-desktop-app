import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Chess, validateFen } from 'chess.js'
import { type MoveNode } from '@pgn/types'
import { ChessBoard } from '../components/ChessBoard'
import WindmillMoveList from '../components/WindmillMoveList'
import { useExplorerStore } from '../store/explorerStore'
import { createDefaultOpeningDetector } from '@openings/defaultOpenings'
import type { OpeningDetector } from '@openings/OpeningDetector'
import { Panel } from '../components/ui/Panel'

type GameInfo = {
  white: string
  black: string
  result: string
  date: string | null
  eco: string | null
  opening: string | null
  termination: string | null
  timeControl: string | null
}

type AnalysisUpdate = {
  score: { type: 'cp' | 'mate'; value: number } | null
  bestmove: string | null
  pv: string[]
  depth: number
  seldepth: number
  multipv: number
  nodes: number
  nps: number
  time: number
}

type ExplorerSearchResult = {
  id: string
  whitePlayer: string
  blackPlayer: string
  result: string
  outcome: string | null
}

export default function GameExplorer() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const {
    game,
    headers,
    roots,
    currentNodeId,
    fen,
    ply,
    loading,
    error,
    dirty,
    loadGame,
    goNext,
    goPrev,
    goFirst,
    goLast,
    goToNode,
    save,
    analysis,
    analyzeCurrent,
    stopAnalysis,
    setAnalysis
  } = useExplorerStore()

  const [selectedSquare, setSelectedSquare] = useState<string | null>(null)
  const [fenInput, setFenInput] = useState(fen)
  const [openingInfo, setOpeningInfo] = useState<{ eco: string; name: string } | null>(null)
  const [flipped, setFlipped] = useState(false)
  const [showSaveToast, setShowSaveToast] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<ExplorerSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  const openingDetectorRef = useRef<OpeningDetector | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    const fetchGame = async () => {
      useExplorerStore.setState({ loading: true, error: null, game: null, roots: [] })
      const result = await window.api.games.getById(id)
      if (!cancelled && result.ok && result.data) {
        loadGame(result.data)
        detectOpening()
      } else if (!cancelled) {
        useExplorerStore.setState({ loading: false, error: result.ok ? 'Game not found.' : result.error.message })
      }
    }
    fetchGame()
    return () => {
      cancelled = true
    }
  }, [id, loadGame])

  useEffect(() => {
    const unsub = window.api.analysis.onUpdate((update: unknown) => {
      const u = update as AnalysisUpdate
      setAnalysis({
        running: true,
        score: u.score ?? null,
        bestmove: u.bestmove ?? null,
        pv: Array.isArray(u.pv) ? u.pv : [],
        depth: u.depth ?? 0,
        seldepth: u.seldepth ?? 0,
        multipv: u.multipv ?? 0,
        nodes: u.nodes ?? 0,
        nps: u.nps ?? 0,
        time: u.time ?? 0,
        error: null
      })
    })
    const unsubErr = window.api.analysis.onError((message: string) => {
      setAnalysis({ running: false, error: message })
    })
    return () => {
      unsub()
      unsubErr()
    }
  }, [setAnalysis])

  useEffect(() => {
    if (!analysis.running) {
      analyzeCurrent()
    }
  }, [currentNodeId, fen, analyzeCurrent])

  useEffect(() => {
    setFenInput(fen)
  }, [fen])

  useEffect(() => {
    if (currentNodeId && roots.length) {
      const node = findNode(roots, currentNodeId)
      if (node && openingDetectorRef.current) {
        const mainline = getMainlineSan(roots, currentNodeId)
        const match = openingDetectorRef.current.detect(mainline)
        setOpeningInfo(match ? { eco: match.eco, name: match.name } : null)
      }
    }
  }, [currentNodeId, roots])

  const detectOpening = () => {
    const detector = createDefaultOpeningDetector()
    openingDetectorRef.current = detector
    if (currentNodeId) {
      const mainline = getMainlineSan(roots, currentNodeId)
      const match = detector.detect(mainline)
      setOpeningInfo(match ? { eco: match.eco, name: match.name } : null)
    }
  }

  const handleSquareClick = useCallback((square: string | null) => {
    if (!game || !roots.length) return
    const current = currentNodeId ? findNode(roots, currentNodeId) : roots[0]
    if (!current) return

    if (square === null) {
      setSelectedSquare(null)
      return
    }

    if (!selectedSquare) {
      setSelectedSquare(square)
      return
    }

    const chess = new Chess(current.fenBefore)
    const move = chess.move({ from: selectedSquare, to: square })
    if (move) {
      const san = move.san
      const child = current.children.find((c) => c.san === san)
      if (child) {
        goToNode(child.id)
      } else {
        createVariation(current, san, chess.fen())
      }
    }
    setSelectedSquare(null)
  }, [game, roots, currentNodeId, selectedSquare, goToNode])

  const createVariation = useCallback(
    (parent: MoveNode, san: string, fenAfter: string) => {
      const newNode: MoveNode = {
        id: crypto.randomUUID(),
        parentId: parent.id,
        ply: parent.ply + 1,
        san,
        uci: null,
        fenBefore: parent.fenAfter,
        fenAfter,
        comment: null,
        nags: [],
        children: []
      }
      const currentRoots = useExplorerStore.getState().roots
      const newRoots = currentRoots.map((r) => addVariationNode(r, parent.id, newNode))
      useExplorerStore.setState({
        roots: newRoots,
        currentNodeId: newNode.id,
        fen: newNode.fenAfter,
        sanAtCurrent: san,
        ply: newNode.ply,
        dirty: true
      })
    },
    []
  )

  const handleNav = useCallback((dir: 'next' | 'prev' | 'first' | 'last') => {
    if (dir === 'next') goNext()
    else if (dir === 'prev') goPrev()
    else if (dir === 'first') goFirst()
    else goLast()
  }, [goNext, goPrev, goFirst, goLast])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const target = document.activeElement as HTMLElement | null
      const inInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      if (inInput) return

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault()
          handleNav('prev')
          break
        case 'ArrowRight':
          e.preventDefault()
          handleNav('next')
          break
        case 'ArrowUp':
          e.preventDefault()
          handleNav('first')
          break
        case 'ArrowDown':
          e.preventDefault()
          handleNav('last')
          break
        case 'Home':
          e.preventDefault()
          handleNav('first')
          break
        case 'End':
          e.preventDefault()
          handleNav('last')
          break
        case 'PageUp':
          e.preventDefault()
          handleNav('prev')
          break
        case 'PageDown':
          e.preventDefault()
          handleNav('next')
          break
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleNav])

  const handleSave = async () => {
    const res = await save()
    if (res.ok) {
      setShowSaveToast(true)
      setTimeout(() => setShowSaveToast(false), 1500)
    }
  }

  const runSearch = async () => {
    if (!searchQuery.trim()) return
    setSearching(true)
    setSearchError(null)
    try {
      const result = await window.api.search.query(searchQuery.trim(), 8, 0)
      if (result.ok) setSearchResults(result.data.results)
      else setSearchError(result.error?.message ?? 'Search failed')
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : String(e))
    } finally {
      setSearching(false)
    }
  }

  const info: GameInfo = useMemo(() => {
    if (!game) return emptyInfo()
    return {
      white: headers.get('White') ?? 'Unknown',
      black: headers.get('Black') ?? 'Unknown',
      result: game.result ?? '*',
      date: headers.get('Date') ?? null,
      eco: headers.get('ECO') ?? null,
      opening: headers.get('Opening') ?? null,
      termination: headers.get('Termination') ?? null,
      timeControl: headers.get('TimeControl') ?? null
    }
  }, [game, headers])

  const cpScore = analysis.score?.type === 'cp' ? analysis.score.value : 0
  const clampedCp = Math.max(-500, Math.min(500, cpScore))
  const evalWidth = Math.max(0, Math.min(100, 50 + clampedCp / 10))
  const evalColor = cpScore > 0 ? '#5DFF6A' : cpScore < 0 ? '#FF2A6D' : '#9A9AA6'

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-text-muted font-mono text-sm">
        Loading game…
      </div>
    )
  }

  if (!game || !roots.length) {
    return (
      <div className="flex min-h-screen items-center justify-center text-text-muted font-mono text-sm">
        {error ? `Error: ${error}` : 'Game not found.'}
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex flex-col gap-3 px-6 pt-6">
        <span className="font-mono text-filter uppercase text-cyan">// explorer</span>
        <h1 className="text-page-title font-sans font-bold uppercase text-text-primary">
          {openingInfo ? `${openingInfo.eco} ${openingInfo.name}` : 'Explorer'}
        </h1>
      </div>

      <div className="wm-explorer flex-1 flex overflow-hidden bg-background">
        {/* Left region: eval strip, board, controls, FEN */}
        <div className="flex flex-col gap-4 w-1/3 min-w-0 border-r border-border px-6 py-6">
          <div className="flex items-end gap-2 min-h-[560px]">
            <div className="w-2 h-[500px] bg-track rounded-none relative">
              <div
                className="h-full relative"
                style={{
                  width: '100%',
                  height: `${evalWidth}%`,
                  bottom: 0,
                  position: 'absolute',
                  backgroundColor: evalColor,
                  boxShadow: `0 0 16px ${evalColor}`,
                }}
              />
            </div>
            <div className="flex flex-col items-center">
              <ChessBoard
                fen={fen}
                orientation={(flipped ? 'b' : 'w') as 'w' | 'b'}
                onSquareClick={handleSquareClick}
                squareSize={64}
                arrows={
                  analysis.bestmove
                    ? [
                        {
                          from: analysis.bestmove.slice(0, 2),
                          to: analysis.bestmove.slice(2, 4),
                          color: analysis.score?.type === 'cp' && analysis.score.value < -150 ? '#FF2A6D' : '#5DFF6A',
                        }
                      ]
                    : []
                }
                highlighted={selectedSquare ? [{ square: selectedSquare, type: 'selected', color: 'rgba(252, 238, 9, 0.35)' }] : []}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={() => setFlipped((f) => !f)}
                className="bg-transparent border border-border rounded-none px-3 py-2 text-xs font-mono text-cyan uppercase hover:border-cyan focus-visible:outline-2 focus-visible:outline-cyan transition-colors"
              >
                Flip board
              </button>
              <div className="flex items-center gap-2">
                <span className="text-text-dim text-xs font-mono">Ply {ply}</span>
                <span className={`text-xs font-mono ${cpScore > 0 ? 'text-green' : cpScore < 0 ? 'text-pink' : 'text-text-muted'}`}>
                  {analysis.score?.type === 'cp'
                    ? (analysis.score.value / 100).toFixed(2)
                    : analysis.score?.type === 'mate'
                      ? `M#${analysis.score.value}`
                      : '—'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleNav('first')}
                className="bg-transparent border border-border rounded-none px-3 py-2 text-xs font-mono text-cyan uppercase hover:border-cyan focus-visible:outline-2 focus-visible:outline-cyan transition-colors"
              >
                |&lt;
              </button>
              <button
                onClick={() => handleNav('prev')}
                className="bg-transparent border border-border rounded-none px-3 py-2 text-xs font-mono text-cyan uppercase hover:border-cyan focus-visible:outline-2 focus-visible:outline-cyan transition-colors"
              >
                &lt;
              </button>
              <button
                onClick={() => handleNav('next')}
                className="bg-transparent border border-border rounded-none px-3 py-2 text-xs font-mono text-cyan uppercase hover:border-cyan focus-visible:outline-2 focus-visible:outline-cyan transition-colors"
              >
                &gt;
              </button>
              <button
                onClick={() => handleNav('last')}
                className="bg-transparent border border-border rounded-none px-3 py-2 text-xs font-mono text-cyan uppercase hover:border-cyan focus-visible:outline-2 focus-visible:outline-cyan transition-colors"
              >
                &gt;|
              </button>
            </div>
            <button
              onClick={() => {
                if (analysis.running) stopAnalysis()
                else analyzeCurrent()
              }}
              className="bg-transparent border border-border rounded-none px-3 py-2 text-xs font-mono text-cyan uppercase hover:border-cyan focus-visible:outline-2 focus-visible:outline-cyan transition-colors disabled:opacity-50"
              disabled={analysis.running === false && analysis.bestmove == null && analysis.score == null}
            >
              {analysis.running ? 'Stop analysis' : 'Analyze position'}
            </button>
            <div className="bg-panel border-l-4 border-cyan clip-path-panel px-3 py-2.5">
              <div className="font-mono text-filter uppercase text-text-dim text-xs">FEN</div>
              <div className="flex gap-2 mt-1">
                <input
                  value={fenInput}
                  onChange={(e) => setFenInput(e.target.value)}
                  className="flex-1 bg-transparent border-b border-border text-xs font-mono text-text-primary focus:border-cyan focus:outline-none focus:ring-0"
                />
                <button
                  onClick={() => {
                    if (validateFen(fenInput)) {
                      // load handled via store not exposed here; show confirmation via analyze
                    }
                  }}
                  className="bg-transparent border border-border rounded-none px-3 py-2 text-xs font-mono text-cyan uppercase hover:border-cyan focus-visible:outline-2 focus-visible:outline-cyan transition-colors"
                >
                  Load
                </button>
                <button
                  onClick={() => navigator.clipboard.writeText(fen)}
                  className="bg-transparent border border-border rounded-none px-3 py-2 text-xs font-mono text-cyan uppercase hover:border-cyan focus-visible:outline-2 focus-visible:outline-cyan transition-colors"
                  title="Copy FEN"
                >
                  Copy
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right region: game info, moves, engine analysis, eval graph */}
        <div className="flex-1 overflow-y-auto min-w-0 p-6">
          <Panel accent="cyan" label="Search games" className="mb-4">
            <div className="flex gap-2">
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') runSearch()
                }}
                placeholder="Search games…"
                className="flex-1 bg-panel border border-border px-3 py-2 text-xs font-mono text-text-primary focus:border-cyan focus:outline-none"
              />
              <button
                onClick={runSearch}
                disabled={searching || !searchQuery.trim()}
                className="bg-transparent border border-cyan px-3 py-2 text-xs font-mono text-cyan uppercase hover:bg-cyan/10 disabled:opacity-50"
              >
                {searching ? 'Searching…' : 'Search'}
              </button>
            </div>
            {searchError && <div className="mt-2 text-xs font-mono text-pink">{searchError}</div>}
            {searchResults.length > 0 && (
              <div className="mt-2 divide-y divide-border/50">
                {searchResults.map((result) => (
                  <button
                    key={result.id}
                    onClick={() => navigate(`/explorer/${result.id}`)}
                    className="w-full flex justify-between gap-2 py-2 text-left text-xs font-mono text-text-primary hover:text-cyan"
                  >
                    <span>{result.whitePlayer} vs {result.blackPlayer}</span>
                    <span className="text-text-muted">{result.outcome ?? result.result}</span>
                  </button>
                ))}
              </div>
            )}
          </Panel>
          <Panel accent="magenta" label="Game info" className="mb-4">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-text-muted font-mono uppercase text-xs">Result</dt>
                <dd className="text-text-primary font-sans font-bold">{info.result}</dd>
              </div>
              {info.eco && (
                <div className="flex justify-between">
                  <dt className="text-text-muted font-mono uppercase text-xs">ECO</dt>
                  <dd className="text-text-primary font-sans font-bold text-yellow">{info.eco}</dd>
                </div>
              )}
              {info.opening && (
                <div className="flex justify-between">
                  <dt className="text-text-muted font-mono uppercase text-xs">Opening</dt>
                  <dd className="text-text-primary font-sans font-bold">{info.opening}</dd>
                </div>
              )}
              {info.date && (
                <div className="flex justify-between">
                  <dt className="text-text-muted font-mono uppercase text-xs">Date</dt>
                  <dd className="text-text-muted font-mono">{info.date}</dd>
                </div>
              )}
              {info.timeControl && (
                <div className="flex justify-between">
                  <dt className="text-text-muted font-mono uppercase text-xs">Time control</dt>
                  <dd className="text-text-muted font-mono">{info.timeControl}</dd>
                </div>
              )}
              {info.termination && (
                <div className="flex justify-between">
                  <dt className="text-text-muted font-mono uppercase text-xs">Termination</dt>
                  <dd className="text-text-muted font-mono">{info.termination}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-text-muted font-mono uppercase text-xs">White</dt>
                <dd className="text-text-primary font-mono">{info.white}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-muted font-mono uppercase text-xs">Black</dt>
                <dd className="text-text-primary font-mono">{info.black}</dd>
              </div>
            </dl>
          </Panel>

          <Panel accent="cyan" label="Moves" className="mb-4">
            <WindmillMoveList roots={roots} currentNodeId={currentNodeId} onSelect={goToNode} />
          </Panel>

          <Panel accent="magenta" label="Engine analysis">
            <div className="space-y-3">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-text-muted font-mono uppercase">Depth</span>
                <span className="text-text-primary font-mono">{analysis.depth}</span>
              </div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-text-muted font-mono uppercase">Nodes</span>
                <span className="text-text-primary font-mono">{analysis.nodes.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-text-muted font-mono uppercase">NPS</span>
                <span className="text-text-primary font-mono">{analysis.nps.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-text-muted font-mono uppercase">Best move</span>
                <span className="text-text-primary font-mono">{analysis.bestmove || '—'}</span>
              </div>
              <div className="mt-2">
                <span className="text-text-muted font-mono uppercase text-xs block">PV</span>
                <div className="text-xs font-mono text-text-primary truncate max-w-[300px]" title={analysis.pv.join(' ')}>
                  {analysis.pv.slice(0, 10).join(' ')}{analysis.pv.length > 10 ? '…' : ''}
                </div>
              </div>
              {analysis.error && (
                <div className="text-text-dim text-xs font-mono mt-1">{analysis.error}</div>
              )}
              {analysis.running && (
                <div className="text-text-dim text-xs font-mono mt-1 animate-pulse">Engine running…</div>
              )}
            </div>
          </Panel>
        </div>
      </div>

      {dirty && (
        <button
          onClick={handleSave}
          className="absolute bottom-6 right-6 bg-yellow text-background font-mono text-button uppercase clip-path-button px-4 py-2.5 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-cyan"
        >
          Save changes
        </button>
      )}
      {showSaveToast && (
        <span className="fixed bottom-6 right-20 z-50 text-xs text-green font-mono uppercase animate-pulse">
          Saved
        </span>
      )}
    </div>
  )
}

function emptyInfo(): GameInfo {
  return {
    white: 'Unknown',
    black: 'Unknown',
    result: '*',
    date: null,
    eco: null,
    opening: null,
    termination: null,
    timeControl: null
  }
}

function findNode(roots: MoveNode[], id: string): MoveNode | null {
  for (const root of roots) {
    const found = findNodeRec(root, id)
    if (found) return found
  }
  return null
}

function findNodeRec(node: MoveNode, id: string): MoveNode | null {
  if (node.id === id) return node
  for (const child of node.children) {
    const found = findNodeRec(child, id)
    if (found) return found
  }
  return null
}

function getMainlineSan(roots: MoveNode[], toNodeId: string): string[] {
  const line: string[] = []
  let node: MoveNode | null = roots[0] ?? null
  while (node) {
    if (node.san) line.push(node.san)
    if (node.id === toNodeId) break
    node = node.children[0] ?? null
  }
  return line
}

function addVariationNode(
  node: MoveNode,
  parentId: string,
  newNode: MoveNode
): MoveNode {
  if (node.id === parentId) {
    return { ...node, children: [...node.children, newNode] }
  }
  return {
    ...node,
    children: node.children.map((c: MoveNode) =>
      addVariationNode(c, parentId, newNode)
    )
  }
}
