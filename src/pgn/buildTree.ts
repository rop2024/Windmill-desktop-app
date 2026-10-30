import { tokenize } from './tokenize'
import { type MoveNode } from './types'
import { Chess } from 'chess.js'

const DEFAULT_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

export function buildTree(
  movetext: string,
  startFen: string = DEFAULT_FEN
): { nodes: MoveNode[]; errors: string[] } {
  const tokens = tokenize(movetext)

  const root: MoveNode = {
    id: crypto.randomUUID(),
    parentId: null,
    ply: 0,
    san: '',
    uci: null,
    fenBefore: startFen,
    fenAfter: startFen,
    comment: null,
    nags: [],
    children: []
  }

  const stack: MoveNode[] = [root]
  let current = root
  let lastMoveNode: MoveNode | null = null

  for (const token of tokens) {
    switch (token.type) {
      case 'lparen':
        stack.push(current)
        break
      case 'rparen':
        if (stack.length > 1) {
          stack.pop()
        }
        current = stack[stack.length - 1]
        break
      case 'san': {
        const node: MoveNode = {
          id: crypto.randomUUID(),
          parentId: current.id,
          ply: current.ply + 1,
          san: token.value,
          uci: null,
          fenBefore: '',
          fenAfter: '',
          comment: null,
          nags: [],
          children: []
        }
        current.children.push(node)
        current = node
        lastMoveNode = node
        break
      }
      case 'comment':
        if (lastMoveNode) {
          const sep = lastMoveNode.comment ? ' ' : ''
          lastMoveNode.comment = lastMoveNode.comment + sep + token.value
        }
        break
      case 'lineComment':
        if (lastMoveNode) {
          const sep = lastMoveNode.comment ? ' | ' : ''
          lastMoveNode.comment = lastMoveNode.comment + sep + token.value
        }
        break
      case 'nag':
        if (lastMoveNode) {
          lastMoveNode.nags.push(token.value)
        }
        break
      case 'moveNumber':
      case 'result':
        break
    }
  }

  const chess = new Chess(startFen)
  const errors: string[] = []
  annotate(root, chess, errors)

  return { nodes: root.children, errors }
}

function annotate(node: MoveNode, chess: Chess, errors: string[]): boolean {
  node.fenBefore = chess.fen()
  let applied = false

  if (node.san) {
    const moved = chess.move(node.san)
    if (moved) {
      node.uci = moved.from + moved.to
      node.fenAfter = chess.fen()
      applied = true
    } else {
      errors.push(`Illegal SAN at ply ${node.ply}: ${node.san}`)
      node.uci = null
      node.fenAfter = chess.fen()
    }
  } else {
    node.fenAfter = chess.fen()
  }

  for (const child of node.children) {
    const childApplied = annotate(child, chess, errors)
    if (childApplied) {
      chess.undo()
    }
  }

  return applied
}
