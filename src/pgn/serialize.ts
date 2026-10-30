import { type PgnHeaders, type MoveNode, type PgnResult } from './types'

function escapePGN(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

interface SerialState {
  out: string
  lastMoveNum: number
  lastSide: 'w' | 'b' | null
}

function serializeNode(node: MoveNode, state: SerialState): void {
  if (!node.san) {
    if (node.children[0]) serializeNode(node.children[0], state)
    return
  }

  const side = node.ply % 2 === 1 ? 'w' : 'b'
  const moveNum = Math.ceil(node.ply / 2)

  if (moveNum !== state.lastMoveNum || side !== state.lastSide) {
    state.out += side === 'w' ? `${moveNum}. ` : `${moveNum}... `
    state.lastMoveNum = moveNum
    state.lastSide = side
  }

  state.out += node.san

  for (const nag of node.nags) {
    state.out += ' ' + nag
  }

  if (node.comment) {
    state.out += ` { ${node.comment} } `
  }

  if (node.children[0]) {
    state.out += ' '
    serializeNode(node.children[0], state)
  }

  for (let i = 1; i < node.children.length; i++) {
    state.out += ` (`
    serializeNode(node.children[i], state)
    state.out += `)`
  }
}

export function serialize(
  headers: PgnHeaders,
  roots: MoveNode[],
  result: PgnResult | null
): string {
  const lines: string[] = []
  for (const [key, value] of headers) {
    lines.push(`[${key} "${escapePGN(value)}"]`)
  }
  if (lines.length > 0) {
    lines.push('')
  }

  const state: SerialState = { out: '', lastMoveNum: 0, lastSide: null }
  for (const root of roots) {
    serializeNode(root, state)
  }

  const movetext = state.out.trim()
  if (movetext.length > 0) {
    lines.push(result ? `${movetext} ${result}` : movetext)
  } else if (result) {
    lines.push(result)
  }

  return lines.join('\n')
}
