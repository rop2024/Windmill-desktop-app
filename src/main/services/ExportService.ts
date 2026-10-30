import { dialog } from 'electron'
import { writeFile } from 'node:fs/promises'
import { GameRepository } from './database/repositories/GameRepository'
import { type GameFilters } from '@shared/game'
import { logger } from './logger'

export class ExportService {
  private repo: GameRepository

  constructor() {
    this.repo = new GameRepository()
  }

  async exportByIds(ids: string[]): Promise<{ ok: true; path: string; count: number } | { ok: false; error: unknown }> {
    try {
      const games = ids.map((id) => this.repo.getById(id)).filter((g): g is NonNullable<typeof g> => g !== null)
      return this.exportGames(games)
    } catch (e) {
      logger.error('ExportService.exportByIds failed', { error: e instanceof Error ? e.message : String(e) })
      return { ok: false, error: e }
    }
  }

  async exportByFilters(filters: GameFilters): Promise<{ ok: true; path: string; count: number } | { ok: false; error: unknown }> {
    try {
      const { rows } = this.repo.query(filters, { field: 'updated_at', dir: 'desc' }, 10000, 0)
      return this.exportGames(rows)
    } catch (e) {
      logger.error('ExportService.exportByFilters failed', { error: e instanceof Error ? e.message : String(e) })
      return { ok: false, error: e }
    }
  }

  async exportAll(): Promise<{ ok: true; path: string; count: number } | { ok: false; error: unknown }> {
    try {
      const { rows } = this.repo.query({}, { field: 'updated_at', dir: 'desc' }, 10000, 0)
      return this.exportGames(rows)
    } catch (e) {
      logger.error('ExportService.exportAll failed', { error: e instanceof Error ? e.message : String(e) })
      return { ok: false, error: e }
    }
  }

  private async exportGames(games: Array<{ id: string; pgn: string }>): Promise<{ ok: true; path: string; count: number } | { ok: false; error: unknown }> {
    if (games.length === 0) {
      return { ok: false, error: new Error('No games to export') }
    }

    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Export Games',
      defaultPath: 'chess-games.pgn',
      filters: [{ name: 'PGN', extensions: ['pgn'] }]
    })

    if (canceled || !filePath) {
      return { ok: false, error: new Error('Save canceled') }
    }

    const pgnText = games.map((g) => g.pgn).filter(Boolean).join('\n\n') + '\n'
    await writeFile(filePath, pgnText, 'utf8')

    logger.info('ExportService.exportGames completed', { path: filePath, count: games.length })
    return { ok: true, path: filePath, count: games.length }
  }
}
