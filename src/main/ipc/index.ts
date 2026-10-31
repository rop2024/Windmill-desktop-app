import { ipcMain, app, dialog, type IpcMainInvokeEvent, type WebContents } from 'electron'
import { z } from 'zod'
import { err, isResult, ok, type Result } from '@shared/result'
import { logger } from '@main/services/logger'
import { getDB, closeDB, initDB, getDBPath } from '@main/services/database/connection'
import { GameRepository } from '@main/services/database/repositories/GameRepository'
import { ImportService } from '@main/services/ImportService'
import { ExportService } from '@main/services/ExportService'
import { analysisRepository } from '@main/services/analysis/AnalysisRepository'
import { engineService } from '@main/services/stockfish/EngineService'
import { analysisQueue, type GameAnalysisResult } from '@main/services/stockfish/AnalysisQueue'
import { settingsService, type AppSettings } from '@main/services/settings'
import { statisticsService } from '@main/services/statistics/StatisticsService'
import { openingExplorerService } from '@main/services/statistics/OpeningExplorerService'
import { OpeningDetector } from '@openings/OpeningDetector'
import { timelineService } from '@main/services/statistics/TimelineService'
import { tacticalDetector } from '@main/services/analysis/TacticalDetector'
import { weaknessEngine } from '@main/services/analysis/WeaknessEngine'
import { ruleEngine } from '@main/services/analysis/RuleEngine'
import { puzzleGenerator } from '@main/services/puzzle/PuzzleGenerator'
import { puzzleTrainer } from '@main/services/puzzle/PuzzleTrainer'
import { reportGenerator } from '@main/services/report/ReportGenerator'
import { coach } from '@main/services/analysis/Coach'
import { boardOfFame } from '@main/services/analysis/BoardOfFame'
import { boardOfShame } from '@main/services/analysis/BoardOfShame'
import { trainingPlanner } from '@main/services/analysis/TrainingPlanner'
import { searchEngine } from '@main/services/search/SearchEngine'
import { repertoireBuilder } from '@main/services/openings/RepertoireBuilder'
import { knowledgeGraph } from '@main/services/analysis/KnowledgeGraph'
import { achievementEngine } from '@main/services/gamification/AchievementEngine'
import { runMigrations } from '@main/services/database/migrator'
import { SyncService, type SyncProgress } from '@main/services/sync/SyncService'
import type { GameFilters, GameSource, GameResult, GameOutcome } from '@shared/game'

export type HandlerFn<Args, R> = (
  event: IpcMainInvokeEvent,
  args: Args
) => R | Promise<R>

let progressSender: ((progress: unknown) => void) | null = null
let syncProgressSender: ((progress: unknown) => void) | null = null
let activeSyncService: SyncService | null = null

export function setProgressSender(fn: (progress: unknown) => void): void {
  progressSender = fn
}

export function setSyncProgressSender(fn: (progress: unknown) => void): void {
  syncProgressSender = fn
}

let analysisWebContents: WebContents | null = null

export function setAnalysisWebContents(webContents: WebContents): void {
  analysisWebContents = webContents
}

function sendAnalysisUpdate(update: unknown): void {
  if (analysisWebContents) analysisWebContents.send('analysis:update', update)
}

function sendAnalysisError(message: string): void {
  if (analysisWebContents) analysisWebContents.send('analysis:error', message)
}

function sendAnalysisProgress(progress: unknown): void {
  if (analysisWebContents) analysisWebContents.send('analysis:progress', progress)
}

function validateArgs<Args>(schema: z.ZodSchema<Args>, rawArgs: unknown): Result<Args> {
  const parsed = schema.safeParse(rawArgs)
  if (!parsed.success) {
    return err('DATABASE_ERROR', `Invalid arguments: ${parsed.error.issues.map((i) => i.message).join(', ')}`)
  }
  return ok(parsed.data)
}

export function handle<Args, R>(
  channel: string,
  schema: z.ZodSchema<Args>,
  fn: HandlerFn<Args, R>
): void {
  ipcMain.handle(channel, async (event, rawArgs: unknown) => {
    const validation = validateArgs(schema, rawArgs)
    if (!validation.ok) {
      logger.warn('IPC validation failed', { channel, error: validation.error.message })
      return validation
    }
    try {
      const data = await fn(event, validation.data)
      return isResult(data) ? data : ok(data)
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      logger.error(`IPC handler error: ${channel}`, { error: message })
      return err('DATABASE_ERROR', message, e)
    }
  })
}

function emitProgress(progress: unknown): void {
  if (progressSender) progressSender(progress)
}

export function registerHandlers(): void {
  const db = getDB()
  const repo = new GameRepository()

  engineService.on('update', sendAnalysisUpdate)
  engineService.on('error', (err) => sendAnalysisError(err.message))

  analysisQueue.on('progress', sendAnalysisProgress)
  analysisQueue.on('gameComplete', (result: GameAnalysisResult) => {
    if (analysisWebContents) analysisWebContents.send('analysis:gameComplete', result)
    const plies = result.plies.map((p) => ({
      ply: p.ply,
      classification: p.classification,
      centipawnLoss: p.centipawnLoss
    }))
    ruleEngine.handleGameAnalysis(result.gameId, plies)
    const repo = new GameRepository()
    const game = repo.getById(result.gameId)
    achievementEngine.evaluateGame(
      result.gameId,
      game?.outcome ?? null,
      game?.playerColor ?? null,
      game?.playerRating ?? null,
      game?.opponentRating ?? null
    )
  })
  analysisQueue.on('gameError', (result) => {
    if (analysisWebContents) analysisWebContents.send('analysis:gameError', result)
  })

  handle('db.ping', z.object({}), async () => {
    const row = db.prepare('SELECT MAX(version) as version FROM schema_migrations').get() as {
      version: number | null
    }
    return { ok: true, data: { version: row.version ?? 0 } }
  })

  handle('games.getAll', z.object({}), async () => {
    const { rows } = repo.query({}, { field: 'updated_at', dir: 'desc' }, 200, 0)
    return { ok: true, data: { games: rows } }
  })

  handle(
    'games.query',
    z.object({
      source: z.string().optional(),
      result: z.string().optional(),
      outcome: z.string().optional(),
      search: z.string().optional(),
      limit: z.number().min(1).max(1000).optional(),
      offset: z.number().min(0).optional()
    }),
    async (_event, { source, result, outcome, search, limit, offset }) => {
      const filters: GameFilters = {}
      if (source) filters.source = source as GameSource
      if (result) filters.result = result as GameResult
      if (outcome) filters.outcome = outcome as GameOutcome
      if (search) filters.search = search
      const { rows, total } = repo.query(
        filters,
        { field: 'updated_at', dir: 'desc' },
        limit ?? 50,
        offset ?? 0
      )
      return { ok: true, data: { games: rows, total } }
    }
  )

  handle(
    'games.getById',
    z.object({ id: z.string() }),
    async (_event, { id }) => {
      const game = repo.getById(id)
      if (!game) return err('DATABASE_ERROR', `Game not found: ${id}`)
      return { ok: true, data: game }
    }
  )

  handle(
    'games.delete',
    z.object({ id: z.string() }),
    async (_event, { id }) => {
      const result = repo.delete(id)
      if (!result.ok) return result
      return { ok: true, data: { deleted: result.deleted } }
    }
  )

  handle(
    'games.update',
    z.object({
      id: z.string(),
      result: z.string().optional(),
      pgn: z.string().optional(),
      source: z.string().optional()
    }),
    async (_event, { id, ...patch }) => {
      const result = repo.update(id, patch as Parameters<typeof repo.update>[1])
      if (!result.ok) return result
      return { ok: true, data: result.game }
    }
  )

  handle(
    'pgn.import',
    z.object({ filePath: z.string() }),
    async (_event, { filePath }) => {
      const detector = new OpeningDetector()
      detector.loadFromTsv(
        `C00\tKing's Pawn Opening\t\t1. e4
C20\tKing's Knight Opening\t\t1. e4 e5 2. Nf3
C50\tGiuoco Piano\t\t1. e4 e5 2. Nf3 Nc6 3. Bc4
C55\tTwo Knights Defense\t\t1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6
C65\tRuy Lopez\t\t1. e4 e5 2. Nf3 Nc6 3. Bb5
C78\tRuy Lopez Closed\t\t1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7
D20\tQueen's Gambit\t\t1. d4 d5 2. c4
A00\tReti Opening\t\t1. Nf3
B20\tSicilian Defense\t\t1. e4 c5
A10\tEnglish Opening\t\t1. c4`
      )
      const service = new ImportService(emitProgress, detector)
      const report = await service.importFile(filePath)
      return { ok: true, data: report }
    }
  )

  handle(
    'pgn.import.pick',
    z.object({}),
    async () => {
      const result = await dialog.showOpenDialog({
        title: 'Import PGN',
        filters: [{ name: 'PGN', extensions: ['pgn', 'txt'] }],
        properties: ['openFile']
      })
      if (result.canceled || result.filePaths.length === 0) {
        return { ok: true, data: null }
      }
      return { ok: true, data: result.filePaths[0] }
    }
  )

  handle(
    'pgn.export',
    z.object({
      ids: z.array(z.string()).optional(),
      all: z.boolean().optional()
    }),
    async (_event, { ids, all }) => {
      const service = new ExportService()
      if (all || !ids) {
        return service.exportAll()
      }
      return service.exportByIds(ids)
    }
  )

  handle(
    'games.updatePgn',
    z.object({ id: z.string(), pgn: z.string() }),
    async (_event, { id, pgn }) => {
      const result = repo.update(id, { pgn })
      if (!result.ok) return result
      return { ok: true, data: result.game }
    }
  )

  handle(
    'analysis.position',
    z.object({
      fen: z.string(),
      depth: z.number().min(1).max(99).optional(),
      movetime: z.number().min(100).max(600000).optional(),
      threads: z.number().min(1).max(128).optional(),
      hash: z.number().min(1).max(1024).optional(),
      multiPV: z.number().min(1).max(8).optional()
    }),
    async (_event, { fen, depth, movetime, threads, hash, multiPV }) => {
      if (engineService.getStatus() === 'analyzing') {
        engineService.stop()
      }
      await engineService.start({ threads, hash, multiPV })
      try {
        const result = await engineService.analyzePosition(fen, {
          depth,
          movetime,
          timeoutMs: movetime ? movetime + 5000 : 30000
        })
        return { ok: true, data: result }
      } catch (e) {
        return err('ENGINE_FAILED', e instanceof Error ? e.message : String(e))
      }
    }
  )

  handle(
    'analysis.stop',
    z.object({}),
    async () => {
      engineService.stop()
      return { ok: true, data: { stopped: true } }
    }
  )

  handle(
    'settings.get',
    z.object({}),
    async () => {
      const settings = await settingsService.get()
      return { ok: true, data: settings }
    }
  )

  handle(
    'settings.set',
    z.object({
      theme: z.enum(['light', 'dark', 'system']).optional(),
      boardTheme: z.enum(['wood', 'marble', 'blue', 'green']).optional(),
      pieceSet: z.enum(['classic', 'neo', 'alpha', 'tatiana']).optional(),
      myUsernames: z.string().optional(),
      autoSync: z.boolean().optional(),
      engine: z.object({
        depth: z.number().min(1).max(99).optional(),
        movetime: z.number().min(100).max(600000).optional(),
        threads: z.number().min(1).max(128).optional(),
        hash: z.number().min(1).max(1024).optional(),
        multiPV: z.number().min(1).max(8).optional()
      }).optional()
    }),
    async (_event, patch) => {
      await settingsService.save(patch as Partial<AppSettings>)
      return { ok: true, data: patch }
    }
  )

  handle(
    'database.backup',
    z.object({ filePath: z.string() }),
    async (_event, { filePath }) => {
      const db = getDB()
      db.backup(filePath)
      logger.info('Database backup created', { path: filePath })
      return { ok: true, data: { path: filePath } }
    }
  )

  handle(
    'database.restore',
    z.object({ filePath: z.string() }),
    async (_event, { filePath }) => {
      const fs = await import('node:fs/promises')
      const { existsSync } = await import('node:fs')
      if (!existsSync(filePath)) {
        return err('FILE_READ_FAILED', `Backup file not found: ${filePath}`)
      }
      // Validate it's a SQLite DB by checking header
      const header = Buffer.alloc(16)
      const fd = await fs.open(filePath, 'r')
      try {
        await fd.read(header, 0, 16, 0)
        const magic = header.toString('ascii', 0, 16)
        if (!magic.startsWith('SQLite format 3')) {
          return err('FILE_READ_FAILED', 'File is not a valid SQLite database')
        }
      } finally {
        await fd.close()
      }
      // Close current connection, replace file, reopen
      await closeDB()
      await fs.copyFile(filePath, getDBPath())
      // Re-initialize
      await initDB()
      await runMigrations()
      logger.info('Database restored from backup', { path: filePath })
      return { ok: true, data: { path: filePath } }
    }
  )

  handle(
    'pgn.export.all',
    z.object({}),
    async () => {
      const service = new ExportService()
      return service.exportAll()
    }
  )

  handle(
    'statistics.overview',
    z.object({
      source: z.string().optional(),
      result: z.string().optional(),
      outcome: z.string().optional(),
      timeClass: z.string().optional(),
      search: z.string().optional()
    }).default({}),
    async (_event, filters) => {
      const stats = statisticsService.overview(filters as GameFilters)
      return { ok: true, data: stats }
    }
  )

  handle(
    'statistics.rating',
    z.object({
      source: z.string().optional(),
      result: z.string().optional(),
      outcome: z.string().optional(),
      timeClass: z.string().optional(),
      search: z.string().optional()
    }).default({}),
    async (_event, filters) => {
      const history = statisticsService.ratingHistory(filters as GameFilters)
      return { ok: true, data: history }
    }
  )

  handle(
    'statistics.resultsByColor',
    z.object({
      source: z.string().optional(),
      result: z.string().optional(),
      outcome: z.string().optional(),
      timeClass: z.string().optional(),
      search: z.string().optional()
    }).default({}),
    async (_event, filters) => {
      const result = statisticsService.resultsByColor(filters as GameFilters)
      return { ok: true, data: result }
    }
  )

  handle(
    'statistics.openings',
    z.object({
      source: z.string().optional(),
      result: z.string().optional(),
      outcome: z.string().optional(),
      timeClass: z.string().optional(),
      search: z.string().optional()
    }).default({}),
    async (_event, filters) => {
      const openings = statisticsService.openings(filters as GameFilters)
      return { ok: true, data: openings }
    }
  )

  handle(
    'statistics.opponents',
    z.object({
      source: z.string().optional(),
      result: z.string().optional(),
      outcome: z.string().optional(),
      timeClass: z.string().optional(),
      search: z.string().optional()
    }).default({}),
    async (_event, filters) => {
      const opponents = statisticsService.opponents(filters as GameFilters)
      return { ok: true, data: opponents }
    }
  )

  handle(
    'statistics.timeControls',
    z.object({
      source: z.string().optional(),
      result: z.string().optional(),
      outcome: z.string().optional(),
      timeClass: z.string().optional(),
      search: z.string().optional()
    }).default({}),
    async (_event, filters) => {
      const timeControls = statisticsService.timeControls(filters as GameFilters)
      return { ok: true, data: timeControls }
    }
  )

  handle(
    'statistics.streaks',
    z.object({
      source: z.string().optional(),
      result: z.string().optional(),
      outcome: z.string().optional(),
      timeClass: z.string().optional(),
      search: z.string().optional()
    }).default({}),
    async (_event, filters) => {
      const streaks = statisticsService.streaks(filters as GameFilters)
      return { ok: true, data: streaks }
    }
  )

  handle(
    'statistics.calendar',
    z.object({
      source: z.string().optional(),
      result: z.string().optional(),
      outcome: z.string().optional(),
      timeClass: z.string().optional(),
      search: z.string().optional(),
      year: z.number().optional()
    }).default({}),
    async (_event, filters) => {
      const f = filters ?? {}
      const calendar = statisticsService.calendar(f as GameFilters, f.year)
      return { ok: true, data: calendar }
    }
  )

  handle(
    'timeline.ratingProgression',
    z.object({
      source: z.string().optional(),
      result: z.string().optional(),
      outcome: z.string().optional(),
      timeClass: z.string().optional(),
      search: z.string().optional()
    }),
    async (_event, filters) => {
      const progression = timelineService.ratingProgression(filters as GameFilters)
      return { ok: true, data: progression }
    }
  )

  handle(
    'timeline.summary',
    z.object({
      source: z.string().optional(),
      result: z.string().optional(),
      outcome: z.string().optional(),
      timeClass: z.string().optional(),
      search: z.string().optional()
    }).default({}),
    async (_event, filters) => {
      const summary = timelineService.summary(filters as GameFilters)
      return { ok: true, data: summary }
    }
  )

  const openingsFiltersSchema = z.object({
    source: z.string().optional(),
    result: z.string().optional(),
    outcome: z.string().optional(),
    timeClass: z.string().optional(),
    search: z.string().optional()
  }).default({})

  handle(
    'openings.list',
    openingsFiltersSchema,
    async (_event, filters) => {
      const openings = openingExplorerService.list(filters as GameFilters)
      return { ok: true, data: openings }
    }
  )

  handle(
    'openings.drilldown',
    z.object({
      opening: z.string().min(1),
      source: z.string().optional(),
      result: z.string().optional(),
      outcome: z.string().optional(),
      timeClass: z.string().optional(),
      search: z.string().optional()
    }),
    async (_event, args) => {
      const { opening, ...filters } = args
      const drilldown = openingExplorerService.drilldown(opening, filters as GameFilters)
      return { ok: true, data: drilldown }
    }
  )

  handle(
    'openings.games',
    z.object({
      opening: z.string().min(1),
      source: z.string().optional(),
      result: z.string().optional(),
      outcome: z.string().optional(),
      timeClass: z.string().optional(),
      search: z.string().optional(),
      limit: z.number().min(1).max(500).optional(),
      offset: z.number().min(0).optional()
    }),
    async (_event, args) => {
      const { opening, limit, offset, ...filters } = args
      const result = openingExplorerService.games(opening, filters as GameFilters, limit ?? 50, offset ?? 0)
      return { ok: true, data: result }
    }
  )

  handle(
    'tactics.analyze',
    z.object({ gameId: z.string() }),
    async (_event, { gameId }) => {
      const tactics = tacticalDetector.analyzeGame(gameId)
      ruleEngine.handleTacticsDetected(
        gameId,
        tactics.tactics.map((t) => ({
          tacticType: t.tacticType,
          label: t.label,
          side: t.side as 'w' | 'b'
        }))
      )
      return { ok: true, data: tactics }
    }
  )

  handle(
    'tactics.getForGame',
    z.object({ gameId: z.string() }),
    async (_event, { gameId }) => {
      const tactics = tacticalDetector.getForGame(gameId)
      return { ok: true, data: tactics }
    }
  )

  handle(
    'tactics.summary',
    z.object({
      source: z.string().optional(),
      result: z.string().optional(),
      outcome: z.string().optional(),
      timeClass: z.string().optional(),
      search: z.string().optional()
    }).default({}),
    async (_event, filters) => {
      const summary = tacticalDetector.summary(filters as GameFilters)
      return { ok: true, data: summary }
    }
  )

  handle(
    'weakness.profile',
    z.object({
      source: z.string().optional(),
      result: z.string().optional(),
      outcome: z.string().optional(),
      timeClass: z.string().optional(),
      search: z.string().optional()
    }).default({}),
    async (_event, filters) => {
      const profile = weaknessEngine.profile(filters as GameFilters)
      return { ok: true, data: profile }
    }
  )

  handle(
    'analysis.startGame',
    z.object({ gameId: z.string() }),
    async (_event, { gameId }) => {
      const settings = await settingsService.get()
      const job: Parameters<typeof analysisQueue.enqueue>[0] = {
        gameId,
        settings: settings.engine
      }
      analysisQueue.enqueue(job)
      return { ok: true, data: { queued: true } }
    }
  )

  handle(
    'analysis.cancel',
    z.object({ gameId: z.string() }),
    async (_event, { gameId }) => {
      analysisQueue.cancel(gameId)
      return { ok: true, data: { cancelled: true } }
    }
  )

  handle(
    'analysis.getForGame',
    z.object({ gameId: z.string() }),
    async (_event, { gameId }) => {
      const rows = analysisRepository.getAnalysisForGame(gameId)
      return { ok: true, data: { plies: rows } }
    }
  )

  handle('app.getVersion', z.object({}), async () => {
    return { ok: true, data: app.getVersion() }
  })

  handle(
    'sync.status',
    z.object({}),
    async () => {
      const sync = new SyncService()
      const status = await sync.status()
      return { ok: true, data: status }
    }
  )

  handle(
    'sync.start',
    z.object({
      username: z.string().min(1, 'Username required')
    }),
    async (_event, { username }) => {
      if (activeSyncService) {
        activeSyncService.cancel()
      }
      const sync = new SyncService((progress: SyncProgress) => {
        if (syncProgressSender) {
          syncProgressSender({ ...progress, username })
        }
      })
      activeSyncService = sync
      try {
        return await sync.sync(username)
      } finally {
        if (activeSyncService === sync) {
          activeSyncService = null
        }
      }
    }
  )

  handle(
    'sync.cancel',
    z.object({}),
    async () => {
      if (activeSyncService) {
        activeSyncService.cancel()
        activeSyncService = null
      }
      return { ok: true, data: { cancelled: true } }
    }
  )

  handle(
    'rule.engine.getCounters',
    z.object({}).default({}),
    async () => {
      return { ok: true, data: ruleEngine.getCounters() }
    }
  )

  handle(
    'rule.engine.getFlags',
    z.object({
      acknowledged: z.boolean().optional()
    }).default({}),
    async (_event, args) => {
      return { ok: true, data: ruleEngine.getFlags(args?.acknowledged) }
    }
  )

  handle(
    'rule.engine.evaluate',
    z.object({
      type: z.string().min(1),
      data: z.unknown().optional(),
      gameId: z.string().optional(),
      side: z.enum(['w', 'b']).optional()
    }),
    async (_event, { type, data, gameId, side }) => {
      const triggered = ruleEngine.evaluate({
        type,
        data: data ?? null,
        timestamp: Date.now(),
        gameId,
        side
      })
      return { ok: true, data: { triggered } }
    }
  )

  handle(
    'rule.engine.addRule',
    z.object({
      id: z.string().min(1),
      when: z.string().min(1),
      action: z.enum(['increment_counter', 'set_flag']),
      counter: z.string().optional(),
      threshold: z.number().optional(),
      flag: z.string().optional(),
      severity: z.enum(['info', 'warning', 'critical']).optional(),
      cooldown: z.number().optional(),
      enabled: z.boolean().optional()
    }),
    async (_event, rule) => {
      ruleEngine.addRule(rule)
      return { ok: true, data: { ruleId: rule.id } }
    }
  )

  handle(
    'rule.engine.getRules',
    z.object({}).default({}),
    async () => {
      return { ok: true, data: ruleEngine.getRules() }
    }
  )

  handle(
    'rule.engine.acknowledgeFlag',
    z.object({
      flagId: z.number()
    }),
    async (_event, { flagId }) => {
      const acknowledged = ruleEngine.acknowledgeFlag(flagId)
      return { ok: true, data: { acknowledged } }
    }
  )

  handle(
    'puzzle.generate',
    z.object({
      source: z.string().optional(),
      result: z.string().optional(),
      outcome: z.string().optional(),
      timeClass: z.string().optional(),
      search: z.string().optional(),
      maxPuzzles: z.number().min(1).max(1000).optional()
    }).default({}),
    async (_event, args) => {
      const { maxPuzzles, ...filters } = args!
      const result = await puzzleGenerator.generate(filters as GameFilters, maxPuzzles ?? 200)
      return { ok: true, data: result }
    }
  )

  handle(
    'puzzle.list',
    z.object({
      source: z.string().optional(),
      result: z.string().optional(),
      outcome: z.string().optional(),
      timeClass: z.string().optional(),
      search: z.string().optional(),
      difficulty: z.enum(['easy', 'medium', 'hard', 'expert']).optional(),
      limit: z.number().min(1).max(500).optional(),
      offset: z.number().min(0).optional()
    }).default({}),
    async (_event, args) => {
      const { difficulty, limit, offset, ...filters } = args!
      // Puzzle list is not filtered by game filters directly; buildWhere operates on games table.
      // We pass filters through to join games; difficulty applied in SQL below.
      const result = puzzleGenerator.list(filters as GameFilters, limit ?? 50, offset ?? 0)
      let puzzles = result.puzzles
      if (difficulty) {
        puzzles = puzzles.filter((p) => p.difficulty === difficulty)
      }
      return { ok: true, data: { puzzles, total: puzzles.length } }
    }
  )

  handle(
    'puzzle.get',
    z.object({
      id: z.string().min(1)
    }),
    async (_event, { id }) => {
      const puzzle = puzzleGenerator.get(id)
      return puzzle ? { ok: true, data: puzzle } : { ok: false, error: new Error('Puzzle not found') }
    }
  )

  handle(
    'puzzle.trainer.select',
    z.object({
      mode: z.enum(['daily', 'weakness', 'spaced']).optional()
    }).default({}),
    async (_event, args) => {
      const { mode } = args ?? {}
      const result = puzzleTrainer.select(mode ?? 'daily')
      return { ok: true, data: result }
    }
  )

  handle(
    'puzzle.trainer.solve',
    z.object({
      puzzleId: z.string().min(1),
      correct: z.boolean(),
      timeMs: z.number().min(0)
    }),
    async (_event, { puzzleId, correct, timeMs }) => {
      const result = puzzleTrainer.solve(puzzleId, correct, timeMs)
      return { ok: true, data: result }
    }
  )

  handle(
    'puzzle.trainer.stats',
    z.object({}).default({}),
    async () => {
      return { ok: true, data: puzzleTrainer.stats() }
    }
  )

  handle(
    'puzzle.trainer.recent',
    z.object({
      limit: z.number().min(1).max(100).optional()
    }),
    async (_event, { limit }) => {
      return { ok: true, data: puzzleTrainer.recentSolves(limit ?? 10) }
    }
  )

  handle(
    'puzzle.trainer.schedule',
    z.object({
      puzzleId: z.string().min(1)
    }),
    async (_event, { puzzleId }) => {
      return { ok: true, data: puzzleTrainer.getSchedule(puzzleId) }
    }
  )

  handle(
    'report.generate',
    z.object({
      type: z.enum(['weekly', 'monthly', 'opening', 'tournament']),
      format: z.enum(['html', 'markdown']),
      source: z.string().optional(),
      result: z.string().optional(),
      outcome: z.string().optional(),
      timeClass: z.string().optional(),
      search: z.string().optional()
    }),
    async (_event, { type, format, ...filters }) => {
      const payload = await reportGenerator.generate(type, format, filters as GameFilters)
      return { ok: true, data: payload }
    }
  )

  handle(
    'coach.weeklyReport',
    z.object({
      source: z.string().optional(),
      result: z.string().optional(),
      outcome: z.string().optional(),
      timeClass: z.string().optional(),
      search: z.string().optional()
    }).default({}),
    async (_event, filters) => {
      const report = coach.weeklyReport(filters as GameFilters)
      return { ok: true, data: report }
    }
  )

  handle(
    'coach.monthlyReport',
    z.object({
      source: z.string().optional(),
      result: z.string().optional(),
      outcome: z.string().optional(),
      timeClass: z.string().optional(),
      search: z.string().optional()
    }).default({}),
    async (_event, filters) => {
      const report = coach.monthlyReport(filters as GameFilters)
      return { ok: true, data: report }
    }
  )

  handle(
    'coach.dailyAdvice',
    z.object({
      source: z.string().optional(),
      result: z.string().optional(),
      outcome: z.string().optional(),
      timeClass: z.string().optional(),
      search: z.string().optional()
    }).default({}),
    async (_event, filters) => {
      const advice = coach.dailyAdvice(filters as GameFilters)
      return { ok: true, data: advice }
    }
  )

  handle(
    'coach.trainingPlan',
    z.object({
      source: z.string().optional(),
      result: z.string().optional(),
      outcome: z.string().optional(),
      timeClass: z.string().optional(),
      search: z.string().optional()
    }).default({}),
    async (_event, filters) => {
      const plan = coach.trainingPlan(filters as GameFilters)
      return { ok: true, data: plan }
    }
  )

  handle(
    'fame.summary',
    z.object({
      source: z.string().optional(),
      result: z.string().optional(),
      outcome: z.string().optional(),
      timeClass: z.string().optional(),
      search: z.string().optional(),
      limit: z.number().min(1).max(200).optional()
    }).default({}),
    async (_event, args) => {
      const { limit, ...filters } = args ?? {}
      const summary = boardOfFame.summary(filters as GameFilters, limit ?? 20)
      return { ok: true, data: summary }
    }
  )

  handle(
    'shame.summary',
    z.object({
      source: z.string().optional(),
      result: z.string().optional(),
      outcome: z.string().optional(),
      timeClass: z.string().optional(),
      search: z.string().optional(),
      limit: z.number().min(1).max(200).optional()
    }).default({}),
    async (_event, args) => {
      const { limit, ...filters } = args ?? {}
      const summary = boardOfShame.summary(filters as GameFilters, limit ?? 20)
      return { ok: true, data: summary }
    }
  )

  handle(
    'training.dailyPlan',
    z.object({
      source: z.string().optional(),
      result: z.string().optional(),
      outcome: z.string().optional(),
      timeClass: z.string().optional(),
      search: z.string().optional()
    }).default({}),
    async (_event, filters) => {
      const plan = trainingPlanner.dailyPlan(filters as GameFilters)
      return { ok: true, data: plan }
    }
  )

  handle(
    'training.completeItem',
    z.object({}),
    async () => {
      const result = trainingPlanner.completeItem()
      return { ok: true, data: result }
    }
  )

  handle(
    'achievement.list',
    z.object({}).default({}),
    async () => {
      return { ok: true, data: achievementEngine.list() }
    }
  )

  handle(
    'achievement.check',
    z.object({
      gameId: z.string().min(1)
    }),
    async (_event, { gameId }) => {
      const unlocks = achievementEngine.evaluateGame(gameId, null, null, null, null)
      return { ok: true, data: { unlocks } }
    }
  )

  handle(
    'search.query',
    z.object({
      query: z.string().min(1),
      limit: z.number().min(1).max(500).optional(),
      offset: z.number().min(0).optional()
    }),
    async (_event, { query, limit, offset }) => {
      const result = searchEngine.search(query, limit ?? 50, offset ?? 0)
      return { ok: true, data: result }
    }
  )

  handle(
    'repertoire.list',
    z.object({}),
    async () => {
      return { ok: true, data: repertoireBuilder.listLines() }
    }
  )

  handle(
    'repertoire.add',
    z.object({
      color: z.enum(['w', 'b']),
      eco: z.string().optional().nullable(),
      name: z.string().min(1),
      moves: z.array(z.string()).min(1),
      priority: z.enum(['high', 'medium', 'low']).optional()
    }),
    async (_event, { color, eco, name, moves, priority }) => {
      const line = repertoireBuilder.addLine(color, eco ?? null, name, moves, priority ?? 'medium')
      return { ok: true, data: line }
    }
  )

  handle(
    'repertoire.update',
    z.object({
      id: z.string().min(1),
      eco: z.string().optional().nullable(),
      name: z.string().optional(),
      moves: z.array(z.string()).optional(),
      priority: z.enum(['high', 'medium', 'low']).optional()
    }),
    async (_event, { id, ...patch }) => {
      repertoireBuilder.updateLine(id, patch)
      return { ok: true, data: { id } }
    }
  )

  handle(
    'repertoire.delete',
    z.object({
      id: z.string().min(1)
    }),
    async (_event, { id }) => {
      const deleted = repertoireBuilder.deleteLine(id)
      return { ok: true, data: { deleted } }
    }
  )

  handle(
    'repertoire.coverage',
    z.object({
      source: z.string().optional(),
      result: z.string().optional(),
      outcome: z.string().optional(),
      timeClass: z.string().optional(),
      search: z.string().optional()
    }),
    async (_event, filters) => {
      const coverage = repertoireBuilder.computeCoverage(filters as GameFilters)
      return { ok: true, data: coverage }
    }
  )

  handle(
    'repertoire.summary',
    z.object({
      source: z.string().optional(),
      result: z.string().optional(),
      outcome: z.string().optional(),
      timeClass: z.string().optional(),
      search: z.string().optional()
    }),
    async (_event, filters) => {
      const summary = repertoireBuilder.summary(filters as GameFilters)
      return { ok: true, data: summary }
    }
  )

  handle(
    'repertoire.studyPlan',
    z.object({
      source: z.string().optional(),
      result: z.string().optional(),
      outcome: z.string().optional(),
      timeClass: z.string().optional(),
      search: z.string().optional()
    }),
    async (_event, filters) => {
      const plan = repertoireBuilder.generateStudyPlan(filters as GameFilters)
      return { ok: true, data: plan }
    }
  )

  handle(
    'graph.build',
    z.object({
      source: z.string().optional(),
      result: z.string().optional(),
      outcome: z.string().optional(),
      timeClass: z.string().optional(),
      search: z.string().optional()
    }),
    async (_event, filters) => {
      const graph = knowledgeGraph.build(filters as GameFilters)
      return { ok: true, data: graph }
    }
  )

  handle(
    'graph.traverse',
    z.object({
      nodeId: z.string().min(1),
      nodeType: z.enum(['game', 'opening', 'mistake', 'weakness', 'puzzle', 'training', 'improvement']).optional(),
      relationship: z.enum(['played', 'contains', 'led-to', 'caused', 'practiced', 'improved', 'related']).optional(),
      maxDepth: z.number().min(1).max(10).optional()
    }),
    async (_event, query) => {
      const graph = knowledgeGraph.traverse(query)
      return { ok: true, data: graph }
    }
  )

  logger.info('IPC handlers registered')
}
