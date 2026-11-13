export type GameSource = 'local' | 'online' | 'engine'

export type GameResult = 'win' | 'loss' | 'draw'

export type GameOutcome = 'win' | 'loss' | 'draw'

export type TimeClass = 'bullet' | 'blitz' | 'rapid' | 'classical' | 'daily'

export type PlayerColor = 'w' | 'b'

export type Game = {
  id: string
  whitePlayer: string
  blackPlayer: string
  result: GameResult
  pgn: string
  source: GameSource
  createdAt: number
  updatedAt: number
  external_id?: string | null
  // Statistics fields (may be null for legacy/imported games)
  playerColor?: PlayerColor | null
  playerRating?: number | null
  opponent?: string | null
  opponentRating?: number | null
  outcome?: GameOutcome | null
  timeClass?: TimeClass | null
  playedAt?: number | null
  accuracies?: { white: number; black: number } | null
}

export type GameFilters = {
  source?: GameSource
  result?: GameResult
  outcome?: GameOutcome
  timeClass?: TimeClass
  search?: string
  limit?: number
  offset?: number
}

export type GameMove = {
  id: number
  gameId: string
  moveNumber: number
  san: string
  fen: string
  createdAt: number
}

export type SyncState = {
  key: string
  value: string
  updatedAt: number
}

export type Theme = 'light' | 'dark' | 'system'
export type BoardTheme = 'cyberpunk'
export type PieceSet = 'classic' | 'neo' | 'alpha' | 'tatiana'

export type EngineSettings = {
  depth: number
  movetime: number
  threads: number
  hash: number
  multiPV: number
}

export type AppSettings = {
  theme: Theme
  boardTheme: BoardTheme
  pieceSet: PieceSet
  myUsernames: string
  dbLocation: string
  autoSync: boolean
  chessComUsername: string
  chessComLastSyncAt: number | null
  engine: EngineSettings
}
