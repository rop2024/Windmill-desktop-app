import { create } from 'zustand'
import { type MoveNode, DEFAULT_FEN } from '@pgn/types'
import { buildTree } from '@pgn/buildTree'
import { serialize } from '@pgn/serialize'
import { extractHeaders } from '@pgn/parseHeaders'
import type { Game } from '@shared/game'

type ExplorerState = {
  game: Game | null
  headers: Map<string, string>
  roots: MoveNode[]
  currentNodeId: string | null
  orientation: 'w' | 'b'
  fen: string
  sanAtCurrent: string | null
  ply: number
  loading: boolean
  error: string | null
  dirty: boolean

  loadGame: (game: Game) => void
  goNext: () => void
  goPrev: () => void
  goFirst: () => void
  goLast: () => void
  goToNode: (nodeId: string) => void
  selectVariation: (nodeId: string) => void
  setOrientation: (orientation: 'w' | 'b') => void
  setComment: (nodeId: string, comment: string) => void
  save: () => Promise<{ ok: boolean; error: string | null }>
  reset: () => void

  // Engine analysis
  analysis: {
    running: boolean
    score: { type: 'cp' | 'mate'; value: number } | null
    bestmove: string | null
    pv: string[]
    depth: number
    seldepth: number
    multipv: number
    nodes: number
    nps: number
    time: number
    error: string | null
  }
  analyzeCurrent: () => void
  stopAnalysis: () => void
  setAnalysis: (patch: Partial<ExplorerState['analysis']>) => void
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

function getMainline(roots: MoveNode[]): MoveNode[] {
  const line: MoveNode[] = []
  let node: MoveNode | null = roots[0] ?? null
  while (node) {
    line.push(node)
    node = node.children[0] ?? null
  }
  return line
}

export const useExplorerStore = create<ExplorerState>((set) => ({
  game: null,
  headers: new Map(),
  roots: [],
  currentNodeId: null,
  orientation: 'w',
  fen: DEFAULT_FEN,
  sanAtCurrent: null,
  ply: 0,
  loading: false,
  error: null,
  dirty: false,
  analysis: {
    running: false,
    score: null,
    bestmove: null,
    pv: [],
    depth: 0,
    seldepth: 0,
    multipv: 0,
    nodes: 0,
    nps: 0,
    time: 0,
    error: null
  },

  loadGame: (game) => {
    const { headers, rest } = extractHeaders(game.pgn)
    const { nodes, errors } = buildTree(rest, headers.get('SetUp') === '1' && headers.get('FEN') ? headers.get('FEN')! : DEFAULT_FEN)
    const first = nodes[0]
    set({
      game,
      headers,
      roots: nodes,
      currentNodeId: first?.id ?? null,
      fen: first?.fenAfter ?? DEFAULT_FEN,
      sanAtCurrent: first?.san ?? null,
      ply: first?.ply ?? 0,
      loading: false,
      error: errors.length > 0 ? errors.join('; ') : null,
      dirty: false
    })
  },

  goNext: () => {
    const { currentNodeId, roots } = useExplorerStore.getState()
    const node = currentNodeId ? findNode(roots, currentNodeId) : null
    const next = node?.children[0]
    if (next) setCurrent(next)
  },

  goPrev: () => {
    const { currentNodeId, roots } = useExplorerStore.getState()
    const node = currentNodeId ? findNode(roots, currentNodeId) : null
    const parent = node?.parentId ? findNode(roots, node.parentId) : null
    if (parent) {
      setCurrent(parent)
    } else {
      const first = roots[0]
      if (first) setCurrent(first)
    }
  },

  goFirst: () => {
    const { roots } = useExplorerStore.getState()
    const first = roots[0]
    if (first) setCurrent(first)
  },

  goLast: () => {
    const { roots } = useExplorerStore.getState()
    const line = getMainline(roots)
    const last = line[line.length - 1]
    if (last) setCurrent(last)
  },

  goToNode: (nodeId) => {
    const node = findNode(useExplorerStore.getState().roots, nodeId)
    if (node) setCurrent(node)
  },

  selectVariation: (nodeId) => {
    const node = findNode(useExplorerStore.getState().roots, nodeId)
    if (node) setCurrent(node)
  },

  setOrientation: (orientation) => set({ orientation }),

  setComment: (nodeId, comment) => {
    const { roots } = useExplorerStore.getState()
    const newRoots = roots.map((r) => updateNodeComment(r, nodeId, comment))
    set({ roots: newRoots, dirty: true })
  },

  save: async () => {
    const { game, headers, roots, dirty } = useExplorerStore.getState()
    if (!game || !dirty) return { ok: true, error: null }
    const pgnResult = (() => {
      switch (game.result) {
        case 'win': return '1-0'
        case 'loss': return '0-1'
        case 'draw': return '1/2-1/2'
        default: return '*'
      }
    })()
    const pgn = serialize(headers, roots, pgnResult)
    const result = await window.api.pgn.updatePgn(game.id, pgn)
    if (!result.ok) {
      return { ok: false, error: result.error.message ?? String(result.error) }
    }
    useExplorerStore.setState({ dirty: false })
    return { ok: true, error: null }
  },

  analyzeCurrent: () => {
    const { fen } = useExplorerStore.getState()
    useExplorerStore.setState((s) => ({ analysis: { ...s.analysis, running: true, error: null } }))
    window.api.settings
      .get()
      .then((result) => {
        const settings = result.ok ? result.data.engine : { depth: 12, movetime: 2000, threads: 1, hash: 256, multiPV: 1 }
        return window.api.analysis.position(fen, settings)
      })
      .then((result) => {
        if (result.ok) {
          const { bestmove, pv, score } = result.data
          useExplorerStore.setState({
            analysis: {
              running: false,
              score: score as { type: 'cp' | 'mate'; value: number } | null,
              bestmove,
              pv,
              depth: 0,
              seldepth: 0,
              multipv: 0,
              nodes: 0,
              nps: 0,
              time: 0,
              error: null
            }
          })
        } else {
          useExplorerStore.setState((s) => ({
            analysis: { ...s.analysis, running: false, error: String(result.error) }
          }))
        }
      })
      .catch((e) => {
        useExplorerStore.setState((s) => ({
          analysis: { ...s.analysis, running: false, error: String(e) }
        }))
      })
  },

  stopAnalysis: () => {
    window.api.analysis.stop()
    useExplorerStore.setState((s) => ({ analysis: { ...s.analysis, running: false } }))
  },

  setAnalysis: (patch) => {
    useExplorerStore.setState((s) => ({ analysis: { ...s.analysis, ...patch } }))
  },

  reset: () => {
    set({
      game: null,
      headers: new Map(),
      roots: [],
      currentNodeId: null,
      orientation: 'w',
      fen: DEFAULT_FEN,
      sanAtCurrent: null,
      ply: 0,
      loading: false,
      error: null,
      dirty: false,
      analysis: {
        running: false,
        score: null,
        bestmove: null,
        pv: [],
        depth: 0,
        seldepth: 0,
        multipv: 0,
        nodes: 0,
        nps: 0,
        time: 0,
        error: null
      }
    })
  }
}))

function setCurrent(node: MoveNode): void {
  useExplorerStore.setState({
    currentNodeId: node.id,
    fen: node.fenAfter,
    sanAtCurrent: node.san,
    ply: node.ply
  })
}

function updateNodeComment(
  node: MoveNode,
  targetId: string,
  comment: string
): MoveNode {
  if (node.id === targetId) {
    return { ...node, comment }
  }
  return {
    ...node,
    children: node.children.map((c) => updateNodeComment(c, targetId, comment))
  }
}
