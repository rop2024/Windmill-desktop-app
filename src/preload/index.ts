import { contextBridge, ipcRenderer } from 'electron'
import { type GameFilters } from '@shared/game'
import type { ReportFormat, ReportType } from '@main/services/report/ReportGenerator'

contextBridge.exposeInMainWorld('api', {
  getVersion: () => ipcRenderer.invoke('app.getVersion', {}),
  games: {
    query: (filters?: GameFilters, limit?: number, offset?: number) =>
      ipcRenderer.invoke('games.query', { ...filters, limit, offset }),
    getById: (id: string) => ipcRenderer.invoke('games.getById', { id }),
    delete: (id: string) => ipcRenderer.invoke('games.delete', { id }),
    update: (id: string, patch: { result?: string; pgn?: string; source?: string }) =>
      ipcRenderer.invoke('games.update', { id, ...patch })
  },
  pgn: {
    import: () => ipcRenderer.invoke('pgn.import', {}),
    export: (ids?: string[], all?: boolean) => ipcRenderer.invoke('pgn.export', { ids, all }),
    exportAll: () => ipcRenderer.invoke('pgn.export.all', {}),
    updatePgn: (id: string, pgn: string) => ipcRenderer.invoke('games.updatePgn', { id, pgn })
  },
  analysis: {
    position: (fen: string, settings?: { depth?: number; movetime?: number; threads?: number; hash?: number; multiPV?: number }) =>
      ipcRenderer.invoke('analysis.position', { fen, ...settings }),
    stop: () => ipcRenderer.invoke('analysis.stop', {}),
    startGame: (gameId: string) => ipcRenderer.invoke('analysis.startGame', { gameId }),
    cancel: (gameId: string) => ipcRenderer.invoke('analysis.cancel', { gameId }),
    getForGame: (gameId: string) => ipcRenderer.invoke('analysis.getForGame', { gameId }),
    onUpdate: (callback: (update: unknown) => void) => {
      const handler = (_event: unknown, update: unknown) => callback(update)
      ipcRenderer.on('analysis:update', handler)
      return () => ipcRenderer.off('analysis:update', handler)
    },
    onError: (callback: (message: string) => void) => {
      const handler = (_event: unknown, message: string) => callback(message)
      ipcRenderer.on('analysis:error', handler)
      return () => ipcRenderer.off('analysis:error', handler)
    },
    onProgress: (callback: (progress: unknown) => void) => {
      const handler = (_event: unknown, progress: unknown) => callback(progress)
      ipcRenderer.on('analysis:progress', handler)
      return () => ipcRenderer.off('analysis:progress', handler)
    },
    onGameComplete: (callback: (result: unknown) => void) => {
      const handler = (_event: unknown, result: unknown) => callback(result)
      ipcRenderer.on('analysis:gameComplete', handler)
      return () => ipcRenderer.off('analysis:gameComplete', handler)
    },
    onGameError: (callback: (result: unknown) => void) => {
      const handler = (_event: unknown, result: unknown) => callback(result)
      ipcRenderer.on('analysis:gameError', handler)
      return () => ipcRenderer.off('analysis:gameError', handler)
    }
  },
  settings: {
    get: () => ipcRenderer.invoke('settings.get', {}),
    set: (patch: {
      theme?: 'light' | 'dark' | 'system'
      boardTheme?: 'cyberpunk'
      pieceSet?: 'classic' | 'neo' | 'alpha' | 'tatiana'
      myUsernames?: string
      autoSync?: boolean
      chessComUsername?: string
      chessComLastSyncAt?: number | null
      engine?: {
        depth?: number
        movetime?: number
        threads?: number
        hash?: number
        multiPV?: number
      }
    }) => ipcRenderer.invoke('settings.set', patch)
  },
  database: {
    backup: () => ipcRenderer.invoke('database.backup', {}),
    restore: () => ipcRenderer.invoke('database.restore', {}),
    reset: () => ipcRenderer.invoke('database.reset', {})
  },
  statistics: {
    overview: (filters?: GameFilters) => ipcRenderer.invoke('statistics.overview', filters),
    rating: (filters?: GameFilters) => ipcRenderer.invoke('statistics.rating', filters),
    resultsByColor: (filters?: GameFilters) => ipcRenderer.invoke('statistics.resultsByColor', filters),
    openings: (filters?: GameFilters) => ipcRenderer.invoke('statistics.openings', filters),
    opponents: (filters?: GameFilters) => ipcRenderer.invoke('statistics.opponents', filters),
    timeControls: (filters?: GameFilters) => ipcRenderer.invoke('statistics.timeControls', filters),
    streaks: (filters?: GameFilters) => ipcRenderer.invoke('statistics.streaks', filters),
      calendar: (filters?: GameFilters & { year?: number }) => ipcRenderer.invoke('statistics.calendar', filters)
  },
  timeline: {
    ratingProgression: (filters?: GameFilters) => ipcRenderer.invoke('timeline.ratingProgression', filters),
    summary: (filters?: GameFilters) => ipcRenderer.invoke('timeline.summary', filters)
  },
  openings: {
    list: (filters?: GameFilters) => ipcRenderer.invoke('openings.list', filters),
    drilldown: (opening: string, filters?: GameFilters, limit?: number, offset?: number) =>
      ipcRenderer.invoke('openings.drilldown', { opening, ...filters, limit, offset }),
    games: (opening: string, filters?: GameFilters, limit?: number, offset?: number) =>
      ipcRenderer.invoke('openings.games', { opening, ...filters, limit, offset })
  },
  tactics: {
    analyze: (gameId: string) => ipcRenderer.invoke('tactics.analyze', { gameId }),
    getForGame: (gameId: string) => ipcRenderer.invoke('tactics.getForGame', { gameId }),
    summary: (filters?: GameFilters) => ipcRenderer.invoke('tactics.summary', filters)
  },
  weakness: {
    getProfile: (filters?: GameFilters) => ipcRenderer.invoke('weakness.profile', filters)
  },
  rules: {
    getCounters: () => ipcRenderer.invoke('rule.engine.getCounters'),
    getFlags: (acknowledged?: boolean) => ipcRenderer.invoke('rule.engine.getFlags', { acknowledged }),
    evaluate: (type: string, data?: unknown, gameId?: string, side?: 'w' | 'b') =>
      ipcRenderer.invoke('rule.engine.evaluate', { type, data, gameId, side }),
    addRule: (rule: unknown) => ipcRenderer.invoke('rule.engine.addRule', rule),
    getRules: () => ipcRenderer.invoke('rule.engine.getRules'),
    acknowledgeFlag: (flagId: number) => ipcRenderer.invoke('rule.engine.acknowledgeFlag', { flagId })
  },
  puzzle: {
    generate: (filters?: GameFilters, maxPuzzles?: number) => ipcRenderer.invoke('puzzle.generate', { ...filters, maxPuzzles }),
    list: (filters?: GameFilters, difficulty?: string, limit?: number, offset?: number) =>
      ipcRenderer.invoke('puzzle.list', { ...filters, difficulty, limit, offset }),
    get: (id: string) => ipcRenderer.invoke('puzzle.get', { id })
  },
  puzzleTrainer: {
    select: (mode?: 'daily' | 'weakness' | 'spaced') => ipcRenderer.invoke('puzzle.trainer.select', { mode }),
    solve: (puzzleId: string, correct: boolean, timeMs: number) => ipcRenderer.invoke('puzzle.trainer.solve', { puzzleId, correct, timeMs }),
    stats: () => ipcRenderer.invoke('puzzle.trainer.stats'),
    recent: (limit?: number) => ipcRenderer.invoke('puzzle.trainer.recent', { limit }),
    schedule: (puzzleId: string) => ipcRenderer.invoke('puzzle.trainer.schedule', { puzzleId })
  },
  report: {
    generate: (type: ReportType, format: ReportFormat, filters?: GameFilters) =>
      ipcRenderer.invoke('report.generate', { type, format, ...filters })
  },
  coach: {
    weeklyReport: (filters?: GameFilters) => ipcRenderer.invoke('coach.weeklyReport', filters),
    monthlyReport: (filters?: GameFilters) => ipcRenderer.invoke('coach.monthlyReport', filters),
    dailyAdvice: (filters?: GameFilters) => ipcRenderer.invoke('coach.dailyAdvice', filters),
    trainingPlan: (filters?: GameFilters) => ipcRenderer.invoke('coach.trainingPlan', filters)
  },
  fame: {
    summary: (filters?: GameFilters, limit?: number) => ipcRenderer.invoke('fame.summary', { ...filters, limit })
  },
  shame: {
    summary: (filters?: GameFilters, limit?: number) => ipcRenderer.invoke('shame.summary', { ...filters, limit })
  },
  training: {
    dailyPlan: (filters?: GameFilters) => ipcRenderer.invoke('training.dailyPlan', filters),
    completeItem: () => ipcRenderer.invoke('training.completeItem', {})
  },
  achievements: {
    list: () => ipcRenderer.invoke('achievement.list'),
    check: (gameId: string) => ipcRenderer.invoke('achievement.check', { gameId })
  },
  repertoire: {
    list: () => ipcRenderer.invoke('repertoire.list'),
    add: (line: { color: 'w' | 'b'; eco?: string | null; name: string; moves: string[]; priority?: 'high' | 'medium' | 'low' }) =>
      ipcRenderer.invoke('repertoire.add', line),
    update: (id: string, patch: { eco?: string | null; name?: string; moves?: string[]; priority?: 'high' | 'medium' | 'low' }) =>
      ipcRenderer.invoke('repertoire.update', { id, ...patch }),
    delete: (id: string) => ipcRenderer.invoke('repertoire.delete', { id }),
    coverage: (filters?: GameFilters) => ipcRenderer.invoke('repertoire.coverage', filters),
    summary: (filters?: GameFilters) => ipcRenderer.invoke('repertoire.summary', filters),
    studyPlan: (filters?: GameFilters) => ipcRenderer.invoke('repertoire.studyPlan', filters)
  },
  graph: {
    build: (filters?: GameFilters) => ipcRenderer.invoke('graph.build', filters),
    traverse: (query: { nodeId: string; nodeType?: string; relationship?: string; maxDepth?: number }) =>
      ipcRenderer.invoke('graph.traverse', query)
  },
  search: {
    query: (query: string, limit?: number, offset?: number) =>
      ipcRenderer.invoke('search.query', { query, limit, offset })
  },
  onImportProgress: (callback: (progress: unknown) => void) => {
    const handler = (_event: unknown, progress: unknown) => callback(progress)
    ipcRenderer.on('pgn:import:progress', handler)
    return () => ipcRenderer.off('pgn:import:progress', handler)
  },
  sync: {
    status: () => ipcRenderer.invoke('sync.status', {}),
    start: (username: string) => ipcRenderer.invoke('sync.start', { username }),
    cancel: () => ipcRenderer.invoke('sync.cancel', {}),
    onProgress: (callback: (progress: unknown) => void) => {
      const handler = (_event: unknown, progress: unknown) => callback(progress)
      ipcRenderer.on('sync:progress', handler)
      return () => ipcRenderer.off('sync:progress', handler)
    }
  }
})
