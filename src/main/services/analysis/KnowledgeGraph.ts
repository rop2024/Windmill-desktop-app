import { statisticsService } from '../statistics/StatisticsService'
import { analysisRepository } from '../analysis/AnalysisRepository'
import { getDB } from '../database/connection'
import type { GameFilters } from '@shared/game'

export type GraphNode = {
  id: string
  label: string
  type: 'game' | 'opening' | 'mistake' | 'weakness' | 'puzzle' | 'training' | 'improvement'
  data: Record<string, unknown>
}

export type GraphEdge = {
  id: string
  source: string
  target: string
  type: 'played' | 'contains' | 'led-to' | 'caused' | 'practiced' | 'improved' | 'related'
  data: Record<string, unknown>
}

export type KnowledgeGraph = {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export type GraphQuery = {
  nodeId?: string
  nodeType?: GraphNode['type']
  relationship?: GraphEdge['type']
  maxDepth?: number
}

function nodeId(type: string, key: string): string {
  return `${type}:${key}`
}

export class KnowledgeGraphBuilder {
  private get db() {
    return getDB()
  }

  build(filters: GameFilters = {}): KnowledgeGraph {
    const nodes: GraphNode[] = []
    const edges: GraphEdge[] = []
    const nodeMap = new Map<string, GraphNode>()

    const addNode = (type: GraphNode['type'], key: string, label: string, data: Record<string, unknown>): GraphNode => {
      const id = nodeId(type, key)
      let node = nodeMap.get(id)
      if (!node) {
        node = { id, label, type, data }
        nodeMap.set(id, node)
        nodes.push(node)
      } else {
        node.data = { ...node.data, ...data }
      }
      return node
    }

    const addEdge = (source: string, target: string, type: GraphEdge['type'], data: Record<string, unknown> = {}): void => {
      const id = `${source}->${target}:${type}`
      edges.push({ id, source, target, type, data })
    }

    const games = statisticsService.fetchGames(filters)
    const now = Date.now()

    // 1. Game nodes + Improvement nodes (rating milestones)
    let prevRating: number | null = null
    for (const g of games) {
      const gameNode = addNode('game', g.id, `${g.whitePlayer} vs ${g.blackPlayer}`, {
        result: g.result,
        outcome: g.outcome,
        playedAt: g.playedAt,
        playerRating: g.playerRating,
        opponentRating: g.opponentRating,
        timeClass: g.timeClass
      })

      // Opening node
      const openingMatch = (g.pgn ?? '').match(/\[Opening "([^"]+)"/i)
      const ecoMatch = (g.pgn ?? '').match(/\[ECO "([^"]+)"/i)
      if (openingMatch) {
        const openingNode = addNode('opening', openingMatch[1], openingMatch[1], {
          eco: ecoMatch?.[1] ?? null,
          name: openingMatch[1]
        })
        addEdge(gameNode.id, openingNode.id, 'played', { ply: 0 })
      }

      // Mistake nodes (from engine_analysis)
      const plies = analysisRepository.getAnalysisForGame(g.id)
      for (const p of plies) {
        if (p.classification === 'mistake' || p.classification === 'blunder') {
          const mistakeNode = addNode('mistake', `${g.id}:${p.ply}`, `${p.classification} at ply ${p.ply}`, {
            classification: p.classification,
            centipawnLoss: p.centipawn_loss,
            ply: p.ply
          })
          addEdge(gameNode.id, mistakeNode.id, 'contains', { ply: p.ply })
          // Mistake → Weakness (classification-based weakness category)
          const weaknessCategory = p.centipawn_loss != null && p.centipawn_loss > 300 ? 'calculation' : 'calculation'
          const weaknessNode = addNode('weakness', weaknessCategory, weaknessCategory.charAt(0).toUpperCase() + weaknessCategory.slice(1), {
            category: weaknessCategory
          })
          addEdge(mistakeNode.id, weaknessNode.id, 'caused', { centipawnLoss: p.centipawn_loss })
        }
      }

      // Improvement node when rating increases
      if (g.playerRating != null) {
        if (prevRating != null && g.playerRating > prevRating) {
          const improvementNode = addNode('improvement', `${g.id}:rating`, `Rating gain ${prevRating} → ${g.playerRating}`, {
            from: prevRating,
            to: g.playerRating,
            gain: g.playerRating - prevRating,
            playedAt: g.playedAt
          })
          addEdge(gameNode.id, improvementNode.id, 'improved', { gain: g.playerRating - prevRating })
        }
        prevRating = g.playerRating
      }
    }

    // 2. Tactical nodes from game_tactics
    try {
      const tactics = this.getAllTactics()
      for (const t of tactics) {
        const tacticNode = addNode('puzzle', `tactic:${t.gameId}:${t.ply}`, `${t.tacticType} (${t.label})`, {
          tacticType: t.tacticType,
          label: t.label,
          side: t.side,
          ply: t.ply
        })
        addNode('game', t.gameId, '', {}) // ensure game node exists
        addEdge(t.gameId, tacticNode.id, 'contains', { ply: t.ply })
        if (t.label === 'missed') {
          const weaknessNode = addNode('weakness', t.tacticType, t.tacticType.charAt(0).toUpperCase() + t.tacticType.slice(1), {
            category: t.tacticType
          })
          addEdge(tacticNode.id, weaknessNode.id, 'led-to', { label: t.label })
        }
      }
    } catch {
      // game_tactics table may not exist yet
    }

    // 3. Puzzle nodes from puzzle_solves
    try {
      const solves = this.getPuzzleSolves()
      for (const s of solves) {
        const puzzleNode = addNode('puzzle', `solve:${s.puzzleId}`, `Puzzle solve ${s.correct ? 'correct' : 'incorrect'}`, {
          correct: s.correct,
          timeMs: s.timeMs,
          solvedAt: s.solvedAt
        })
        addNode('training', `session:${s.solvedAt}`, 'Training session', {
          solvedAt: s.solvedAt,
          correct: s.correct
        })
        addEdge(puzzleNode.id, `training:session:${s.solvedAt}`, 'practiced', { correct: s.correct })
        addEdge(`training:session:${s.solvedAt}`, `improvement:${now}`, 'improved', { correct: s.correct })
      }
    } catch {
      // puzzle_solves table may not exist yet
    }

    return { nodes, edges }
  }

  private getAllTactics(): Array<{ gameId: string; ply: number; tacticType: string; label: string; side: string }> {
    const rows = this.db.prepare(
      `SELECT gt.game_id, gt.ply, gt.tactic_type, gt.label, gt.side
       FROM game_tactics gt
       JOIN games g ON g.id = gt.game_id
       LIMIT 1000`
    ).all() as Array<{ game_id: string; ply: number; tactic_type: string; label: string; side: string }>
    return rows.map((r) => ({ gameId: r.game_id, ply: r.ply, tacticType: r.tactic_type, label: r.label, side: r.side }))
  }

  private getPuzzleSolves(): Array<{ puzzleId: string; correct: boolean; timeMs: number; solvedAt: number }> {
    const rows = this.db.prepare(
      'SELECT puzzle_id, correct, time_ms, solved_at FROM puzzle_solves LIMIT 1000'
    ).all() as Array<{ puzzle_id: string; correct: number; time_ms: number; solved_at: number }>
    return rows.map((r) => ({ puzzleId: r.puzzle_id, correct: r.correct === 1, timeMs: r.time_ms, solvedAt: r.solved_at }))
  }

  traverse(query: GraphQuery): KnowledgeGraph {
    const full = this.build({})

    if (!query.nodeId) return full

    const visited = new Set<string>()
    const queue: Array<{ id: string; depth: number }> = [{ id: query.nodeId, depth: 0 }]
    visited.add(query.nodeId)

    while (queue.length > 0) {
      const { id, depth } = queue.shift()!
      if (query.maxDepth != null && depth >= query.maxDepth) continue

      for (const e of full.edges) {
        if (e.source === id && !visited.has(e.target)) {
          if (query.relationship && e.type !== query.relationship) continue
          visited.add(e.target)
          queue.push({ id: e.target, depth: depth + 1 })
        }
        if (e.target === id && !visited.has(e.source)) {
          if (query.relationship && e.type !== query.relationship) continue
          visited.add(e.source)
          queue.push({ id: e.source, depth: depth + 1 })
        }
      }
    }

    const resultNodes = full.nodes.filter((n) => visited.has(n.id) && (!query.nodeType || n.type === query.nodeType))
    const resultEdges = full.edges.filter((e) => visited.has(e.source) && visited.has(e.target))
    return { nodes: resultNodes, edges: resultEdges }
  }
}

export const knowledgeGraph = new KnowledgeGraphBuilder()
