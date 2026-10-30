import { type MoveNode } from './types'

export type GameMoveRow = {
  gameId: string
  moveNumber: number
  san: string
  uci: string | null
  fenBefore: string
  fenAfter: string
  createdAt: number
}

export function flattenMainLine(gameId: string, roots: MoveNode[]): GameMoveRow[] {
  const rows: GameMoveRow[] = []
  let node: MoveNode | null = roots[0] ?? null
  while (node) {
    rows.push({
      gameId,
      moveNumber: node.ply,
      san: node.san,
      uci: node.uci,
      fenBefore: node.fenBefore,
      fenAfter: node.fenAfter,
      createdAt: Date.now()
    })
    node = node.children[0] ?? null
  }
  return rows
}
