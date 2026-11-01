import { useCallback, useEffect, useMemo, useState } from 'react'
import { Panel } from '../components/ui/Panel'
import { KpiCard } from '../components/ui/KpiCard'

type GraphNode = {
  id: string
  label: string
  type: 'game' | 'opening' | 'mistake' | 'weakness' | 'puzzle' | 'training' | 'improvement'
  data: Record<string, unknown>
}

type GraphEdge = {
  id: string
  source: string
  target: string
  type: 'played' | 'contains' | 'led-to' | 'caused' | 'practiced' | 'improved' | 'related'
  data: Record<string, unknown>
}

type KnowledgeGraphData = {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

const TYPE_LABEL: Record<string, string> = {
  game: 'Game',
  opening: 'Opening',
  mistake: 'Mistake',
  weakness: 'Weakness',
  puzzle: 'Puzzle',
  training: 'Training',
  improvement: 'Improvement'
}

const TYPE_COLOR: Record<string, 'cyan' | 'yellow' | 'green' | 'magenta' | 'pink' | 'orange'> = {
  game: 'cyan',
  opening: 'yellow',
  mistake: 'pink',
  weakness: 'magenta',
  puzzle: 'green',
  training: 'orange',
  improvement: 'green'
}

const EDGE_LABEL: Record<string, string> = {
  played: 'played',
  contains: 'contains',
  'led-to': 'led to',
  caused: 'caused',
  practiced: 'practiced',
  improved: 'improved',
  related: 'related'
}

export default function KnowledgeGraph() {
  const [loading, setLoading] = useState(true)
  const [graph, setGraph] = useState<KnowledgeGraphData | null>(null)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [traversed, setTraversed] = useState<KnowledgeGraphData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadGraph = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await window.api.graph.build()
      if (res.ok) setGraph(res.data)
      else setError(res.error?.message ?? 'Failed to build graph')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  const traverse = useCallback(async (nodeId: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await window.api.graph.traverse({ nodeId })
      if (res.ok) {
        setTraversed(res.data)
        setSelectedNode(nodeId)
      } else {
        setError(res.error?.message ?? 'Failed to traverse')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadGraph()
  }, [loadGraph])

  const g = graph ?? { nodes: [], edges: [] }
  const nodesByType = useMemo(() => {
    const map = new Map<string, GraphNode[]>()
    for (const n of g.nodes) {
      const arr = map.get(n.type) ?? []
      arr.push(n)
      map.set(n.type, arr)
    }
    return map
  }, [g.nodes])

  const edgesByType = useMemo(() => {
    const map = new Map<string, GraphEdge[]>()
    for (const e of g.edges) {
      const arr = map.get(e.type) ?? []
      arr.push(e)
      map.set(e.type, arr)
    }
    return map
  }, [g.edges])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-text-muted font-mono text-sm">
        Building knowledge graph…
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-center">
        <p className="text-text-muted font-mono text-sm">{error}</p>
        <button
          type="button"
          onClick={loadGraph}
          className="border border-cyan px-3 py-2 text-xs font-mono uppercase text-cyan hover:bg-cyan/10"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="bg-background min-h-screen space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-filter uppercase text-cyan">// knowledge graph</span>
          <h1 className="text-page-title font-sans font-bold uppercase text-text-primary">
            Chess Knowledge Graph
          </h1>
        </div>
      </div>

      <div className="wm-grid-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <KpiCard accent="cyan" value={g.nodes.length} label="Nodes" />
        <KpiCard accent="green" value={g.edges.length} label="Edges" />
        <KpiCard accent="yellow" value={nodesByType.size} label="Node types" />
        <KpiCard accent="magenta" value={edgesByType.size} label="Edge types" />
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 w-full lg:w-3/4">
          <Panel accent="magenta" label="All nodes">
            <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
              <table className="min-w-full text-left border-collapse divide-y divide-border/50">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted">Type</th>
                    <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted">Label</th>
                    <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted text-right">Edges</th>
                    <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted text-right">Traverse</th>
                  </tr>
                </thead>
                <tbody>
                  {[...g.nodes].sort((a, b) => a.label.localeCompare(b.label)).map((n) => {
                    const edgeCount = g.edges.filter((e) => e.source === n.id || e.target === n.id).length
                    return (
                      <tr key={n.id} className="hover:bg-white/5 last:border-0 cursor-pointer">
                        <td className="px-3 py-2 text-xs font-mono">
                          <span className={`text-[10px] font-mono ${TYPE_COLOR[n.type]}`}>{TYPE_LABEL[n.type]}</span>
                        </td>
                        <td className="px-3 py-2 text-xs font-sans text-text-primary" onClick={() => traverse(n.id)}>
                          {n.label}
                        </td>
                        <td className="px-3 py-2 text-xs font-mono text-right">{edgeCount}</td>
                        <td className="px-3 py-2 text-xs font-mono text-cyan text-right">
                          {selectedNode === n.id ? 'Selected' : 'Explore'}
                        </td>
                      </tr>
                    )
                  })}
                  {g.nodes.length === 0 && (
                    <tr>
                      <td className="px-3 py-4 text-center text-text-muted text-xs font-mono" colSpan={4}>
                        No nodes. Analyze games to build the graph.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>

          {traversed && (
            <Panel accent="cyan" label={`Traversal from ${selectedNode}`}>
              <div className="space-y-3">
                <div className="flex justify-between items-center px-2 py-1.5 border-b border-border/50">
                  <span className="text-xs font-mono text-text-muted">Root node</span>
                  <span className="text-xs font-mono text-text-primary">{selectedNode}</span>
                </div>
                <div className="flex justify-between items-center px-2 py-1.5 border-b border-border/50">
                  <span className="text-xs font-mono text-text-muted">Reachable nodes</span>
                  <span className="text-xs font-mono text-text-primary">{traversed.nodes.length}</span>
                </div>
                <div className="flex justify-between items-center px-2 py-1.5 border-b border-border/50">
                  <span className="text-xs font-mono text-text-muted">Reachable edges</span>
                  <span className="text-xs font-mono text-text-primary">{traversed.edges.length}</span>
                </div>
                <div className="overflow-x-auto max-h-[240px] overflow-y-auto">
                  <table className="min-w-full text-left border-collapse divide-y divide-border/50">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted">From</th>
                        <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted">Relation</th>
                        <th className="px-3 py-2 text-xs font-mono uppercase text-text-muted">To</th>
                      </tr>
                    </thead>
                    <tbody>
                      {traversed.edges.map((e) => (
                        <tr key={e.id} className="hover:bg-white/5 last:border-0">
                          <td className="px-3 py-2 text-xs font-mono text-text-muted truncate max-w-xs">{e.source}</td>
                          <td className="px-3 py-2 text-xs font-mono text-text-primary">{EDGE_LABEL[e.type]}</td>
                          <td className="px-3 py-2 text-xs font-mono text-text-primary truncate max-w-xs">{e.target}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button
                  onClick={() => { setTraversed(null); setSelectedNode(null) }}
                  className="bg-transparent border border-border text-text-muted font-mono text-xs uppercase px-3 py-2 rounded-none hover:bg-white/5 transition-colors"
                >
                  Clear traversal
                </button>
              </div>
            </Panel>
          )}
        </div>

        <div className="flex-none lg:w-1/4">
          <Panel accent="green" label="Node types">
            <div className="space-y-2">
              {[...nodesByType.entries()].sort((a, b) => b[1].length - a[1].length).map(([type, ns]) => (
                <div key={type} className="flex justify-between items-center px-2 py-1.5 border-b border-border/50 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-mono ${TYPE_COLOR[type]}`}>{TYPE_LABEL[type]}</span>
                    <span className="text-[10px] font-mono text-text-muted">{ns.length}</span>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel accent="orange" label="Edge types">
            <div className="space-y-2">
              {[...edgesByType.entries()].sort((a, b) => b[1].length - a[1].length).map(([type, es]) => (
                <div key={type} className="flex justify-between items-center px-2 py-1.5 border-b border-border/50 last:border-0">
                  <span className="text-xs font-mono text-text-primary">{EDGE_LABEL[type]}</span>
                  <span className="text-[10px] font-mono text-text-muted">{es.length}</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel accent="cyan" label="About">
            <div className="space-y-2 text-xs font-mono text-text-muted">
              <div>The knowledge graph connects every entity in your chess ecosystem:</div>
              <ul className="list-disc list-inside space-y-1 mt-1">
                <li><b>Game → Opening</b> — games linked to their played openings</li>
                <li><b>Game → Mistake</b> — games linked to blunder/mistake plies</li>
                <li><b>Mistake → Weakness</b> — mistakes linked to weakness categories</li>
                <li><b>Puzzle → Training</b> — puzzles linked to training sessions</li>
                <li><b>Training → Improvement</b> — training linked to rating gains</li>
              </ul>
              <div className="mt-2">Click a node to traverse its connections and explore the ecosystem.</div>
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
