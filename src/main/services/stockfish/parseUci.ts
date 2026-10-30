import { Chess } from 'chess.js'

export type UciScore = { type: 'cp'; value: number } | { type: 'mate'; value: number }

export type UciInfo = {
  depth?: number
  seldepth?: number
  multipv?: number
  score: UciScore | null
  nodes?: number
  nps?: number
  pv: string[]
  time?: number
}

export type UciBestMove = { move: string | null; ponder: string | null }

export type UciLine =
  | { type: 'info'; data: UciInfo }
  | { type: 'bestmove'; data: UciBestMove }
  | { type: 'uciok' }
  | { type: 'readyok' }
  | { type: 'error'; message: string }

const SCORE_RE = /score (cp|mate) (-?\d+)/
const PV_RE = /pv\s+(.+)/
const DEPTH_RE = /depth (\d+)/
const SELDEPTH_RE = /seldepth (\d+)/
const MULTIPV_RE = /multipv (\d+)/
const NODES_RE = /nodes (\d+)/
const NPS_RE = /nps (\d+)/
const TIME_RE = /time (\d+)/

function normalizeScore(kind: string, value: number, sideToMove: 'w' | 'b'): UciScore {
  // UCI reports score from the side-to-move perspective. Normalize to White.
  const multiplier = sideToMove === 'w' ? 1 : -1
  if (kind === 'cp') {
    return { type: 'cp', value: value * multiplier }
  }
  // Mate: side to move mates in N. Negate and flip sign based on perspective.
  const mate = value * multiplier
  return { type: 'mate', value: mate }
}

export function parseUciLine(line: string, sideToMove: 'w' | 'b' = 'w'): UciLine | null {
  const trimmed = line.trim()
  if (!trimmed) return null

  if (trimmed === 'uciok') return { type: 'uciok' }
  if (trimmed === 'readyok') return { type: 'readyok' }

  if (trimmed.startsWith('bestmove')) {
    const parts = trimmed.split(/\s+/)
    const move = parts[1] === '(none)' ? null : parts[1] ?? null
    const ponderIdx = parts.indexOf('ponder')
    const ponder = ponderIdx !== -1 && parts[ponderIdx + 1] ? parts[ponderIdx + 1] : null
    return { type: 'bestmove', data: { move, ponder } }
  }

  if (trimmed.startsWith('info')) {
    const info: UciInfo = { score: null, pv: [] }

    const depthM = DEPTH_RE.exec(trimmed)
    if (depthM) info.depth = Number(depthM[1])

    const seldepthM = SELDEPTH_RE.exec(trimmed)
    if (seldepthM) info.seldepth = Number(seldepthM[1])

    const multipvM = MULTIPV_RE.exec(trimmed)
    if (multipvM) info.multipv = Number(multipvM[1])

    const scoreM = SCORE_RE.exec(trimmed)
    if (scoreM) {
      info.score = normalizeScore(scoreM[1], Number(scoreM[2]), sideToMove)
    }

    const nodesM = NODES_RE.exec(trimmed)
    if (nodesM) info.nodes = Number(nodesM[1])

    const npsM = NPS_RE.exec(trimmed)
    if (npsM) info.nps = Number(npsM[1])

    const timeM = TIME_RE.exec(trimmed)
    if (timeM) info.time = Number(timeM[1])

    const pvM = PV_RE.exec(trimmed)
    if (pvM) {
      info.pv = pvM[1].split(/\s+/).filter(Boolean)
    }

    return { type: 'info', data: info }
  }

  if (trimmed.startsWith('id ')) return null
  if (trimmed.startsWith('option ')) return null
  if (trimmed.startsWith('Console')) return null

  return { type: 'error', message: trimmed }
}

export function parsePvSan(pv: string[], startingFen: string): { san: string; fen: string }[] {
  const chess = new Chess(startingFen)
  const out: { san: string; fen: string }[] = []
  for (const uci of pv) {
    const promotion = uci.length === 5 ? (uci[4] as 'q' | 'r' | 'b' | 'n') : undefined
    const move = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion })
    if (!move) break
    out.push({ san: move.san, fen: chess.fen() })
  }
  return out
}
