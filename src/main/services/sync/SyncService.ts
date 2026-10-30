import { PgnService } from '@pgn/PgnService'
import { GameRepository } from '../database/repositories/GameRepository'
import { settingsService } from '../settings'
import { ChessComService, injectSourceHeader } from './ChessComService'
import { logger } from '../logger'

export type SyncProgress = {
  stage: 'checking' | 'fetching' | 'importing' | 'done' | 'idle' | 'error'
  processed: number
  total: number
  found: number
  imported: number
  duplicates: number
  invalid: number
  currentMonth?: string
  username?: string | null
}

export type SyncStatus = {
  username: string | null
  lastSyncAt: number | null
  totalGames: number
  onlineGames: number
}

export class SyncService {
  private repo: GameRepository
  private pgnService: PgnService
  private sendProgress?: (progress: SyncProgress) => void
  private cancelled = false

  constructor(sendProgress?: (progress: SyncProgress) => void) {
    this.repo = new GameRepository()
    this.pgnService = new PgnService()
    this.sendProgress = sendProgress
  }

  cancel(): void {
    this.cancelled = true
  }

  async status(): Promise<SyncStatus> {
    const settings = await settingsService.get()
    const totalGames = this.repo.count()
    const onlineGames = this.repo.count({ source: 'online' })
    return {
      username: settings.chessComUsername || null,
      lastSyncAt: settings.chessComLastSyncAt ?? null,
      totalGames,
      onlineGames
    }
  }

  async sync(username: string): Promise<{
    ok: true
    imported: number
    duplicates: number
    found: number
  } | { ok: false; error: string }> {
    this.cancelled = false
    const service = new ChessComService(username)

    try {
      await service.getPlayer()

      const archives = await service.getArchives()
      const settings = await settingsService.get()
      const lastSyncAt = settings.chessComLastSyncAt ?? null

      const eligibleArchives: string[] = []
      for (const archiveUrl of archives) {
        const match = archiveUrl.match(/\/games\/(\d{4})\/(\d{1,2})\/?$/)
        if (!match) continue
        const year = parseInt(match[1], 10)
        const month = parseInt(match[2], 10)
        const monthStart = new Date(year, month - 1, 1).getTime()
        if (lastSyncAt && monthStart <= lastSyncAt) continue
        eligibleArchives.push(archiveUrl)
      }

      this.sendProgress?.({
        stage: 'checking',
        processed: 0,
        total: eligibleArchives.length,
        found: 0,
        imported: 0,
        duplicates: 0,
        invalid: 0,
        username
      })

      if (eligibleArchives.length === 0) {
        await settingsService.save({
          chessComUsername: username,
          chessComLastSyncAt: Date.now()
        })
        this.sendProgress?.({
          stage: 'done',
          processed: 0,
          total: 0,
          found: 0,
          imported: 0,
          duplicates: 0,
          invalid: 0,
          username
        })
        return { ok: true, imported: 0, duplicates: 0, found: 0 }
      }

      let totalImported = 0
      let totalDuplicates = 0
      let totalFound = 0
      let processed = 0
      let newestGameTime = lastSyncAt ?? Date.now()

      for (const archiveUrl of eligibleArchives) {
        if (this.cancelled) {
          this.sendProgress?.({
            stage: 'idle',
            processed,
            total: eligibleArchives.length,
            found: totalFound,
            imported: totalImported,
            duplicates: totalDuplicates,
            invalid: 0,
            username
          })
          return { ok: false, error: 'Sync cancelled' }
        }

        const match = archiveUrl.match(/\/games\/(\d{4})\/(\d{1,2})\/?$/)
        if (!match) continue
        const year = parseInt(match[1], 10)
        const month = parseInt(match[2], 10)

        processed++
        const archiveLabel = `${year}-${String(month).padStart(2, '0')}`

        try {
          this.sendProgress?.({
            stage: 'fetching',
            processed,
            total: eligibleArchives.length,
            found: totalFound,
            imported: totalImported,
            duplicates: totalDuplicates,
            invalid: 0,
            currentMonth: archiveLabel,
            username
          })

          const games = await service.getGamesForMonth(year, month)
          const gameList = Array.isArray(games) ? games : []
          totalFound += gameList.length

          if (gameList.length > 0) {
            this.sendProgress?.({
              stage: 'importing',
              processed,
              total: eligibleArchives.length,
              found: totalFound,
              imported: totalImported,
              duplicates: totalDuplicates,
              invalid: 0,
              currentMonth: archiveLabel,
              username
            })

            const pgnText = gameList.map((g) => injectSourceHeader(g.pgn)).join('\n\n')
            const parsed = this.pgnService.parseGames(pgnText)

            for (const g of gameList) {
              if (g.end_time && typeof g.end_time === 'number' && g.end_time > newestGameTime / 1000) {
                newestGameTime = g.end_time * 1000
              }
            }

            const result = this.repo.insertMany(parsed.games)
            if (!result.ok) {
              logger.error(`Sync import failed for ${archiveLabel}`, { error: String(result.error) })
              continue
            }
            totalImported += result.imported
            totalDuplicates += result.duplicates
          }
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e)
          logger.error(`Sync failed for month ${archiveLabel}`, { username, error: message })
          continue
        }
      }

      await settingsService.save({
        chessComUsername: username,
        chessComLastSyncAt: newestGameTime
      })

      this.sendProgress?.({
        stage: 'done',
        processed: eligibleArchives.length,
        total: eligibleArchives.length,
        found: totalFound,
        imported: totalImported,
        duplicates: totalDuplicates,
        invalid: 0,
        username
      })

      return { ok: true, imported: totalImported, duplicates: totalDuplicates, found: totalFound }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      logger.error('SyncService.sync failed', { username, error: message })
      return { ok: false, error: message }
    }
  }
}
