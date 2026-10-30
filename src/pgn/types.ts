export type PgnResult = '1-0' | '0-1' | '1/2-1/2' | '*'

export type PgnHeaders = Map<string, string>

export type ParsedGame = {
  id: string
  headers: PgnHeaders
  movetext: string
  result: PgnResult | null
  root: MoveNode | null
  error: PgnError | null
  // Optional statistics fields (populated during import when known)
  playerColor?: string | null
  playerRating?: number | null
  opponent?: string | null
  opponentRating?: number | null
  outcome?: string | null
  timeClass?: string | null
  playedAt?: number | null
}

export type PgnError = {
  gameIndex: number
  message: string
  fatal: boolean
}

export type MoveNode = {
  id: string
  parentId: string | null
  ply: number
  san: string
  uci: string | null
  fenBefore: string
  fenAfter: string
  comment: string | null
  nags: string[]
  children: MoveNode[]
}

export type ParsedGames = {
  games: ParsedGame[]
  errors: PgnError[]
}

export const DEFAULT_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

export type OpeningMatch = {
  eco: string
  name: string
  variation: string | null
  ply: number
}
