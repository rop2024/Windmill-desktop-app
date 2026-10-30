import { app } from 'electron'
import { existsSync } from 'node:fs'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { logger } from './logger'

export type Theme = 'light' | 'dark' | 'system'

export type BoardTheme = 'wood' | 'marble' | 'blue' | 'green'

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

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  boardTheme: 'wood',
  pieceSet: 'classic',
  myUsernames: '',
  dbLocation: '',
  autoSync: false,
  chessComUsername: '',
  chessComLastSyncAt: null,
  engine: {
    depth: 12,
    movetime: 2000,
    threads: 1,
    hash: 256,
    multiPV: 1
  }
}

const SETTINGS_FILE = 'chess-settings.json'

export class SettingsService {
  private path: string

  constructor() {
    this.path = join(app.getPath('userData'), SETTINGS_FILE)
  }

  async get(): Promise<AppSettings> {
    try {
      if (!existsSync(this.path)) return { ...DEFAULT_SETTINGS }
      const raw = await readFile(this.path, 'utf8')
      const parsed = JSON.parse(raw) as Partial<AppSettings>
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        engine: { ...DEFAULT_SETTINGS.engine, ...(parsed.engine ?? {}) }
      }
    } catch (e) {
      logger.warn('Settings read failed, using defaults', { error: String(e) })
      return { ...DEFAULT_SETTINGS }
    }
  }

  async save(settings: Partial<AppSettings>): Promise<void> {
    try {
      const dir = join(app.getPath('userData'))
      if (!existsSync(dir)) await mkdir(dir, { recursive: true })
      const current = await this.get()
      const merged: AppSettings = {
        ...current,
        ...settings,
        engine: settings.engine ? { ...current.engine, ...settings.engine } : current.engine
      }
      await writeFile(this.path, JSON.stringify(merged, null, 2), 'utf8')
      logger.info('Settings saved', { settings })
    } catch (e) {
      logger.error('Settings save failed', { error: String(e) })
    }
  }
}

export const settingsService = new SettingsService()
