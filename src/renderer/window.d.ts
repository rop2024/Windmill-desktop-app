import { Result } from '@shared/result'
import { Game, GameFilters, GameOutcome, PlayerColor } from '@shared/game'
import { AppSettings } from '@shared/game'

export type OverviewStats = {
  totalGames: number
  wins: number
  losses: number
  draws: number
  winRate: number
  currentRating: number | null
  bestRating: number | null
}

export type RatingPoint = {
  date: string
  rating: number
}

export type ColorResult = {
  games: number
  wins: number
  losses: number
  draws: number
  winRate: number
}

export type ResultsByColor = {
  white: ColorResult
  black: ColorResult
}

export type OpeningStat = {
  opening: string
  eco: string | null
  games: number
  wins: number
  losses: number
  draws: number
  winRate: number
  accuracy: number | null
  mistakes: number
  recommendation: 'play' | 'avoid' | 'consider'
}

export type OpponentStat = {
  opponent: string
  games: number
  wins: number
  losses: number
  draws: number
  winRate: number
}

export type TimeControlStat = {
  timeClass: string
  games: number
  wins: number
  losses: number
  draws: number
  winRate: number
}

export type StreakStat = {
  currentWin: number
  longestWin: number
  currentLoss: number
  longestLoss: number
  currentUnbeaten: number
  longestUnbeaten: number
}

export type CalendarDay = {
  date: string
  count: number
}

export type Milestone = {
  rating: number
  date: string | null
  achieved: boolean
}

export type TimelineData = {
  ratingProgression: RatingPoint[]
  milestones: Milestone[]
  firstRating: number | null
  currentRating: number | null
  ratingGain: number | null
  totalRatedGames: number
}

export type TacticType =
  | 'fork'
  | 'pin'
  | 'skewer'
  | 'hanging'
  | 'double_attack'
  | 'discovered_attack'
  | 'clearance'
  | 'deflection'

export type TacticLabel = 'created' | 'missed' | 'defended' | 'none'

export type DetectedTactic = {
  id: string
  gameId: string
  ply: number
  san: string
  tacticType: TacticType
  label: TacticLabel
  side: 'w' | 'b'
  description: string
  piece: string | null
  targetSquare: string | null
  targets: string[]
  value: number
  fenBefore: string
  fenAfter: string
}

export type TacticTally = {
  created: Record<TacticType, number>
  missed: Record<TacticType, number>
  defended: Record<TacticType, number>
}

export type GameTactics = {
  gameId: string
  totalPly: number
  white: TacticTally
  black: TacticTally
  tactics: DetectedTactic[]
}

export type TacticSummaryRow = {
  tacticType: TacticType
  side: 'w' | 'b'
  label: TacticLabel
  count: number
}

export type WeaknessCategory = 'opening' | 'endgame' | 'kingSafety' | 'timePressure' | 'calculation'

export type CategoryRating = {
  category: WeaknessCategory
  stars: number
  score: number
  label: string
  signal: string
  moves: number
  errors: number
}

export type WeaknessProfile = {
  categories: CategoryRating[]
  gamesAnalyzed: number
  dateRange: { from: string | null; to: string | null }
  trend: 'improving' | 'declining' | 'stable'
  topWeakness: WeaknessCategory | null
  topStrength: WeaknessCategory | null
}

export type RuleSeverity = 'info' | 'warning' | 'critical'

export type Rule = {
  id: string
  when: string
  action: 'increment_counter' | 'set_flag'
  counter?: string
  threshold?: number
  flag?: string
  severity?: RuleSeverity
  cooldown?: number
  enabled?: boolean
}

export type RuleEvent = {
  type: string
  data: unknown
  timestamp: number
  gameId?: string
  side?: 'w' | 'b'
}

export type Counter = {
  name: string
  value: number
  updatedAt: number
}

export type Flag = {
  id: number
  ruleId: string
  flag: string
  severity: RuleSeverity
  counterName: string | null
  counterValue: number | null
  triggeredAt: number
  gameId: string | null
  acknowledged: boolean
}

export type PuzzleDifficulty = 'easy' | 'medium' | 'hard' | 'expert'

export type Puzzle = {
  id: string
  gameId: string
  ply: number
  san: string
  fenBefore: string
  fenAfter: string
  solutionSan: string
  solutionPv: string[]
  scoreCp: number | null
  scoreMate: number | null
  centipawnLoss: number | null
  difficulty: PuzzleDifficulty
  tacticType: string | null
  tacticLabel: string | null
  createdAt: number
}

export type PuzzleSolve = {
  id: string
  puzzleId: string
  correct: boolean
  timeMs: number
  solvedAt: number
}

export type PuzzleSchedule = {
  puzzleId: string
  nextReview: number
  intervalDays: number
  easeFactor: number
  repetitions: number
  updatedAt: number
}

export type TrainerStats = {
  totalSolves: number
  correctSolves: number
  incorrectSolves: number
  solveRate: number
  avgTimeMs: number
  currentStreak: number
  bestStreak: number
  puzzlesSolved: number
}

export type TrainerSelectResult = {
  puzzle: Puzzle | null
  mode: 'daily' | 'weakness' | 'spaced'
  reason: string
}

export type ReportType = 'weekly' | 'monthly' | 'opening' | 'tournament'
export type ReportFormat = 'html' | 'markdown'

export type ReportPayload = {
  path: string
  type: ReportType
  format: ReportFormat
  gamesAnalyzed: number
}

export type FocusArea = {
  category: string
  stars: number
  label: string
  reason: string
}

export type TrainingPlanItem = {
  area: string
  action: string
  puzzles: number
  priority: 'high' | 'medium' | 'low'
}

export type CoachReport = {
  period: 'weekly' | 'monthly'
  from: string
  to: string
  gamesAnalyzed: number
  winRate: number
  ratingChange: string
  keyInsights: string[]
  focusAreas: FocusArea[]
  trainingPlan: TrainingPlanItem[]
}

export type DailyAdvice = {
  date: string
  advice: string
  focusArea: FocusArea | null
  puzzleSuggestion: string | null
  reason: string
}

export type CoachTrainingPlan = {
  focusAreas: FocusArea[]
  plan: TrainingPlanItem[]
  totalPuzzles: number
}

export type BoardGame = {
  id: string
  whitePlayer: string
  blackPlayer: string
  result: string
  outcome: GameOutcome | null
  playedAt: number | null
  playerColor: string | null
  playerRating: number | null
  opponent: string | null
  opponentRating: number | null
  accuracy: number
  moves: number
  blunders: number
  timeClass: string | null
}

export type BoardMove = {
  id: string
  gameId: string
  ply: number
  san: string
  classification: string | null
  centipawnLoss: number | null
  scoreCp: number | null
  scoreMate: number | null
  accuracy: number
  gameResult: string
  gameOutcome: GameOutcome | null
  playedAt: number | null
  opponentRating: number | null
}

export type BoardUpset = BoardGame & {
  ratingDiff: number
}

export type BoardSacrifice = BoardMove & {
  evalSwing: number
}

export type BoardSummary = {
  bestGames: BoardGame[]
  bestMoves: BoardMove[]
  mostAccurateGames: BoardGame[]
  upsets: BoardUpset[]
  sacrifices: BoardSacrifice[]
}

export type ShameGame = {
  id: string
  whitePlayer: string
  blackPlayer: string
  result: string
  outcome: GameOutcome | null
  playedAt: number | null
  playerColor: string | null
  playerRating: number | null
  opponent: string | null
  opponentRating: number | null
  accuracy: number
  moves: number
  blunders: number
  timeClass: string | null
}

export type ShameMove = {
  id: string
  gameId: string
  ply: number
  san: string
  classification: string | null
  centipawnLoss: number | null
  scoreCp: number | null
  scoreMate: number | null
  accuracy: number
  gameResult: string
  gameOutcome: GameOutcome | null
  playedAt: number | null
  opponentRating: number | null
}

export type ShameThrow = ShameGame & {
  evalSwing: number
  thrownFrom: string
}

export type ShameMissedMate = ShameGame & {
  mateIn: number
}

export type ShameTimeTrouble = ShameGame & {
  accuracyDrop: number
}

export type ShameSummary = {
  worstBlunders: ShameMove[]
  largestThrows: ShameThrow[]
  fastestLosses: ShameGame[]
  missedMates: ShameMissedMate[]
  timeTrouble: ShameTimeTrouble[]
}

export type SearchResult = {
  id: string
  whitePlayer: string
  blackPlayer: string
  result: string
  outcome: GameOutcome | null
  playedAt: number | null
  playerColor: PlayerColor | null
  playerRating: number | null
  opponent: string | null
  opponentRating: number | null
  timeClass: string | null
  matchReasons: string[]
}

export type SearchQueryFilters = {
  source?: string
  result?: string
  outcome?: string
  timeClass?: string
  search?: string
  tactic?: string
  endgame?: boolean
  sacrificed?: string
  mateMissed?: boolean
  timeTrouble?: boolean
}

export type RepertoireLine = {
  id: string
  color: 'w' | 'b'
  eco: string | null
  name: string
  moves: string[]
  priority: 'high' | 'medium' | 'low'
  addedAt: number
  updatedAt: number
}

export type RepertoireCoverageLine = RepertoireLine & {
  gamesPlayed: number
  wins: number
  losses: number
  draws: number
  winRate: number
  lastPlayed: number | null
  coveragePct: number
  status: 'covered' | 'weak' | 'forgotten' | 'untouched'
}

export type RepertoireSummary = {
  totalLines: number
  coveredLines: number
  weakLines: number
  forgottenLines: number
  untouchedLines: number
  overallCoverage: number
  coverageByColor: Record<string, { total: number; covered: number }>
}

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

export type Achievement = {
  id: string
  name: string
  description: string
  xpReward: number
}

export type AchievementProgress = {
  achievementId: string
  name: string
  description: string
  status: 'locked' | 'in_progress' | 'unlocked'
  progress: number
  target: number
  xpReward: number
  unlockedAt: number | null
}

export type AchievementUnlock = {
  achievementId: string
  name: string
  xpReward: number
}

export type PlanItem = {
  area: string
  label: string
  action: string
  puzzles: number
  puzzleType: string | null
  priority: 'high' | 'medium' | 'low'
  completed: boolean
}

export type DailyPlan = {
  date: string
  summary: string
  items: PlanItem[]
  totalPuzzles: number
  weaknessSource: 'weakness-engine' | 'none'
}

export type OpeningGame = {
  id: string
  whitePlayer: string
  blackPlayer: string
  result: string
  outcome: GameOutcome | null
  playerColor: PlayerColor | null
  playedAt: number | null
  eco: string | null
  opening: string
  accuracy: number | null
}

export type PositionStat = {
  fen: string
  san: string
  moveNumber: number
  ply: number
  timesPlayed: number
  games: number
  winRate: number
}

export type Recommendation = {
  type: 'play' | 'avoid' | 'consider'
  opening: string
  eco: string | null
  winRate: number
  accuracy: number | null
  games: number
  reason: string
}

export type OpeningDrilldown = {
  opening: string
  eco: string | null
  summary: OpeningStat
  games: OpeningGame[]
  positions: PositionStat[]
  recommendations: Recommendation[]
}

declare global {
  interface Window {
    api: {
      getVersion: () => Promise<Result<string>>
      games: {
        query: (filters?: GameFilters, limit?: number, offset?: number) => Promise<
          Result<{ games: Game[]; total: number }>
        >
        getById: (id: string) => Promise<Result<Game>>
        delete: (id: string) => Promise<Result<{ deleted: boolean }>>
        update: (id: string, patch: { result?: string; pgn?: string; source?: string }) => Promise<Result<Game>>
      }
      pgn: {
        import: () => Promise<Result<{
          found: number
          imported: number
          duplicates: number
          invalid: number
          errors: Array<{ gameIndex: number; message: string }>
        } | null>>
        export: (ids?: string[], all?: boolean) => Promise<Result<{ path: string; count: number }>>
        updatePgn: (id: string, pgn: string) => Promise<Result<Game>>
      }
      analysis: {
        position: (fen: string, settings?: { depth?: number; movetime?: number; threads?: number; hash?: number; multiPV?: number }) => Promise<Result<{ bestmove: string | null; pv: string[]; score: { type: string; value: number } | null }>>
        stop: () => Promise<Result<{ stopped: boolean }>>
        startGame: (gameId: string) => Promise<Result<{ queued: boolean }>>
        cancel: (gameId: string) => Promise<Result<{ cancelled: boolean }>>
        getForGame: (gameId: string) => Promise<Result<{ plies: Array<{
          id: number
          game_id: string
          ply: number
          fen_before: string
          fen_after: string
          score_cp: number | null
          score_mate: number | null
          bestmove: string | null
          pv: string[] | null
          depth: number | null
          centipawn_loss: number | null
          classification: string | null
          analyzed_at: number
        }> }>>
        onUpdate: (callback: (update: unknown) => void) => () => void
        onError: (callback: (message: string) => void) => () => void
        onProgress: (callback: (progress: unknown) => void) => () => void
        onGameComplete: (callback: (result: unknown) => void) => () => void
        onGameError: (callback: (result: unknown) => void) => () => void
      }
      settings: {
        get: () => Promise<Result<AppSettings>>
        set: (patch: Partial<AppSettings>) => Promise<Result<unknown>>
      }
      database: {
        backup: () => Promise<Result<{ path: string } | null>>
        restore: () => Promise<Result<{ path: string } | null>>
      }
      statistics: {
        overview: (filters?: GameFilters) => Promise<Result<OverviewStats>>
        rating: (filters?: GameFilters) => Promise<Result<RatingPoint[]>>
        resultsByColor: (filters?: GameFilters) => Promise<Result<ResultsByColor>>
        openings: (filters?: GameFilters) => Promise<Result<OpeningStat[]>>
        opponents: (filters?: GameFilters) => Promise<Result<OpponentStat[]>>
        timeControls: (filters?: GameFilters) => Promise<Result<TimeControlStat[]>>
        streaks: (filters?: GameFilters) => Promise<Result<StreakStat>>
        calendar: (filters?: GameFilters & { year?: number }) => Promise<Result<CalendarDay[]>>
      }
      timeline: {
        ratingProgression: (filters?: GameFilters) => Promise<Result<RatingPoint[]>>
        summary: (filters?: GameFilters) => Promise<Result<TimelineData>>
      }
      openings: {
        list: (filters?: GameFilters) => Promise<Result<OpeningStat[]>>
        drilldown: (opening: string, filters?: GameFilters, limit?: number, offset?: number) => Promise<Result<OpeningDrilldown>>
        games: (opening: string, filters?: GameFilters, limit?: number, offset?: number) => Promise<Result<{ games: OpeningGame[]; total: number }>>
      }
      tactics: {
        analyze: (gameId: string) => Promise<Result<GameTactics>>
        getForGame: (gameId: string) => Promise<Result<GameTactics>>
        summary: (filters?: GameFilters) => Promise<Result<TacticSummaryRow[]>>
      }
      weaknesses: {
        getProfile: (filters?: GameFilters) => Promise<Result<WeaknessProfile>>
      }
      rules: {
        getCounters: () => Promise<Result<Counter[]>>
        getFlags: (acknowledged?: boolean) => Promise<Result<Flag[]>>
        evaluate: (type: string, data?: unknown, gameId?: string, side?: 'w' | 'b') => Promise<Result<{ triggered: Flag[] }>>
        addRule: (rule: Rule) => Promise<Result<{ ruleId: string }>>
        getRules: () => Promise<Result<Rule[]>>
        acknowledgeFlag: (flagId: number) => Promise<Result<{ acknowledged: boolean }>>
      }
      puzzle: {
        generate: (filters?: GameFilters, maxPuzzles?: number) => Promise<Result<{ generated: number; puzzles: Puzzle[] }>>
        list: (filters?: GameFilters, difficulty?: string, limit?: number, offset?: number) => Promise<Result<{ puzzles: Puzzle[]; total: number }>>
        get: (id: string) => Promise<Result<Puzzle>>
      }
      puzzleTrainer: {
        select: (mode?: 'daily' | 'weakness' | 'spaced') => Promise<Result<TrainerSelectResult>>
        solve: (puzzleId: string, correct: boolean, timeMs: number) => Promise<Result<{ ok: boolean; schedule: PuzzleSchedule }>>
        stats: () => Promise<Result<TrainerStats>>
        recent: (limit?: number) => Promise<Result<PuzzleSolve[]>>
        schedule: (puzzleId: string) => Promise<Result<PuzzleSchedule | null>>
      }
      report: {
        generate: (type: ReportType, format: ReportFormat, filters?: GameFilters) => Promise<Result<ReportPayload>>
      }
      coach: {
        weeklyReport: (filters?: GameFilters) => Promise<Result<CoachReport>>
        monthlyReport: (filters?: GameFilters) => Promise<Result<CoachReport>>
        dailyAdvice: (filters?: GameFilters) => Promise<Result<DailyAdvice>>
        trainingPlan: (filters?: GameFilters) => Promise<Result<CoachTrainingPlan>>
      }
      fame: {
        summary: (filters?: GameFilters, limit?: number) => Promise<Result<BoardSummary>>
      }
      shame: {
        summary: (filters?: GameFilters, limit?: number) => Promise<Result<ShameSummary>>
      }
      training: {
        dailyPlan: (filters?: GameFilters) => Promise<Result<DailyPlan>>
        completeItem: () => Promise<Result<{ ok: boolean }>>
      }
      achievements: {
        list: () => Promise<Result<AchievementProgress[]>>
        check: (gameId: string) => Promise<Result<{ unlocks: AchievementUnlock[] }>>
      }
      repertoire: {
        list: () => Promise<Result<RepertoireLine[]>>
        add: (line: { color: 'w' | 'b'; eco?: string | null; name: string; moves: string[]; priority?: 'high' | 'medium' | 'low' }) => Promise<Result<RepertoireLine>>
        update: (id: string, patch: { eco?: string | null; name?: string; moves?: string[]; priority?: 'high' | 'medium' | 'low' }) => Promise<Result<{ id: string }>>
        delete: (id: string) => Promise<Result<{ deleted: boolean }>>
        coverage: (filters?: GameFilters) => Promise<Result<RepertoireCoverageLine[]>>
        summary: (filters?: GameFilters) => Promise<Result<RepertoireSummary>>
        studyPlan: (filters?: GameFilters) => Promise<Result<(RepertoireCoverageLine & { reason: string })[]>>
      }
      search: {
        query: (query: string, limit?: number, offset?: number) => Promise<Result<{ results: SearchResult[]; total: number; filters: SearchQueryFilters }>>
      }
      graph: {
        build: (filters?: GameFilters) => Promise<Result<KnowledgeGraph>>
        traverse: (query: { nodeId: string; nodeType?: string; relationship?: string; maxDepth?: number }) => Promise<Result<KnowledgeGraph>>
      }
      onImportProgress: (callback: (progress: unknown) => void) => () => void
      sync: {
        status: () => Promise<Result<{
          username: string | null
          lastSyncAt: number | null
          totalGames: number
          onlineGames: number
        }>>
        start: (username: string) => Promise<Result<{
          ok: boolean
          imported: number
          duplicates: number
          found: number
          error?: string
        }>>
        cancel: () => Promise<Result<{ cancelled: boolean }>>
        onProgress: (callback: (progress: unknown) => void) => () => void
      }
    }
  }
}

export {}
