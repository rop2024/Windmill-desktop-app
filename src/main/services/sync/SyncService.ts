import { PgnService } from '@pgn/PgnService'
import { OpeningDetector } from '@openings/OpeningDetector'
import { GameRepository } from '../database/repositories/GameRepository'
import { settingsService } from '../settings'
import { ChessComService, injectSourceHeader } from './ChessComService'
import { logger } from '../logger'
import { type MoveNode } from '@pgn/types'

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
  private abortController: AbortController | null = null
  private openingDetector: OpeningDetector | null

  constructor(sendProgress?: (progress: SyncProgress) => void, openingDetector: OpeningDetector | null = null) {
    this.repo = new GameRepository()
    this.pgnService = new PgnService()
    this.sendProgress = sendProgress
    this.openingDetector = openingDetector
  }

  cancel(): void {
    this.cancelled = true
    this.abortController?.abort()
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
    newGameIds: string[]
  } | { ok: false; error: string }> {
    this.cancelled = false
    this.abortController = new AbortController()
    const service = new ChessComService(username, this.abortController.signal)

    try {
      await service.getPlayer()

      const archives = await service.getArchives()
      const settings = await settingsService.get()
      const onlineGames = this.repo.count({ source: 'online' })
      const hasMatchingSyncCursor = settings.chessComUsername === username && onlineGames > 0
      const lastSyncAt = hasMatchingSyncCursor ? settings.chessComLastSyncAt ?? null : null
      if (settings.chessComLastSyncAt !== null && !hasMatchingSyncCursor) {
        logger.info('Ignoring saved Chess.com sync cursor and performing a recovery scan', {
          username,
          savedUsername: settings.chessComUsername || null,
          onlineGames
        })
      }
      const lastSyncMonth = lastSyncAt ? getTimestampMonthKey(lastSyncAt) : null

      const eligibleArchives: string[] = []
      for (const archiveUrl of archives) {
        const match = archiveUrl.match(/\/games\/(\d{4})\/(\d{1,2})\/?$/)
        if (!match) continue
        const year = parseInt(match[1], 10)
        const month = parseInt(match[2], 10)
        // Re-fetch the month containing the last game so newly added games are seen.
        if (lastSyncMonth !== null && getArchiveMonthKey(year, month) < lastSyncMonth) continue
        eligibleArchives.push(archiveUrl)
      }
      eligibleArchives.sort((a, b) => getArchiveUrlMonthKey(b) - getArchiveUrlMonthKey(a))

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
        return { ok: true, imported: 0, duplicates: 0, found: 0, newGameIds: [] }
      }

      let totalImported = 0
      let totalDuplicates = 0
      let totalFound = 0
      let processed = 0
      let failedArchives = 0
      let newestGameTime = lastSyncAt ?? 0
      let totalInvalid = 0
      const newlyImportedIds: string[] = []

      for (const archiveUrl of eligibleArchives) {
        if (this.cancelled) {
          this.sendProgress?.({
            stage: 'idle',
            processed,
            total: eligibleArchives.length,
            found: totalFound,
            imported: totalImported,
            duplicates: totalDuplicates,
            invalid: totalInvalid,
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
            invalid: totalInvalid,
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
              invalid: totalInvalid,
              currentMonth: archiveLabel,
              username
            })

            let archiveNewestGameTime = newestGameTime
            for (const onlineGame of gameList) {
              try {
                const parsed = this.pgnService.parseGames(injectSourceHeader(onlineGame.pgn))
                const game = parsed.games[0]
                if (!game || game.error) {
                  totalInvalid++
                  continue
                }
                const isWhite = onlineGame.white.username.toLowerCase() === username.toLowerCase()
                game.playerColor = isWhite ? 'w' : 'b'
                game.playerRating = isWhite ? onlineGame.white.rating : onlineGame.black.rating
                game.opponent = isWhite ? onlineGame.black.username : onlineGame.white.username
                game.opponentRating = isWhite ? onlineGame.black.rating : onlineGame.white.rating
                game.outcome = normalizeOutcome(isWhite ? onlineGame.white.result : onlineGame.black.result)
                game.timeClass = timeClassFor(onlineGame.time_control)
                game.playedAt = onlineGame.end_time * 1000

                // Use Chess.com's precomputed opening/ECO data when available,
                // falling back to local detection only when missing.
                if (onlineGame.eco) {
                  game.headers.set('ECO', onlineGame.eco)
                }
                if (onlineGame.opening) {
                  game.headers.set('Opening', onlineGame.opening)
                }
                if (!onlineGame.eco && !onlineGame.opening && this.openingDetector && game.root) {
                  const match = this.openingDetector.detect(extractMainLineSan(game.root))
                  if (match) {
                    game.headers.set('ECO', match.eco)
                    game.headers.set('Opening', match.name)
                    if (match.variation) game.headers.set('Variation', match.variation)
                  }
                }

                // Preserve Chess.com's move accuracies for statistics.
                if (onlineGame.accuracies) {
                  game.accuracies = onlineGame.accuracies
                }
                const result = this.repo.insertGame(game)
                if (!result.ok) throw new Error(String(result.error))
                if (result.duplicate) totalDuplicates++
                else {
                  totalImported++
                  if (result.game) newlyImportedIds.push(result.game.id)
                }
                if (onlineGame.end_time > archiveNewestGameTime / 1000) {
                  archiveNewestGameTime = onlineGame.end_time * 1000
                }
              } catch (e) {
                totalInvalid++
                logger.warn('Invalid Chess.com game skipped', { archiveLabel, error: String(e) })
              }
            }
            newestGameTime = archiveNewestGameTime
          }
        } catch (e) {
          failedArchives++
          const message = e instanceof Error ? e.message : String(e)
          logger.error(`Sync failed for month ${archiveLabel}`, { username, error: message })
          continue
        }
      }

      if (failedArchives === eligibleArchives.length && eligibleArchives.length > 0) {
        const message = 'Chess.com sync failed for every archive. Check your connection and try again.'
        this.sendProgress?.({
          stage: 'error',
          processed,
          total: eligibleArchives.length,
          found: totalFound,
          imported: totalImported,
          duplicates: totalDuplicates,
          invalid: totalInvalid,
          username
        })
        return { ok: false, error: message }
      }

      if (failedArchives === 0 && newestGameTime > 0) {
        await settingsService.save({
          chessComUsername: username,
          chessComLastSyncAt: newestGameTime
        })
      }

      this.sendProgress?.({
        stage: 'done',
        processed: eligibleArchives.length,
        total: eligibleArchives.length,
        found: totalFound,
        imported: totalImported,
        duplicates: totalDuplicates,
        invalid: totalInvalid,
        username
      })

      return { ok: true, imported: totalImported, duplicates: totalDuplicates, found: totalFound, newGameIds: newlyImportedIds }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      logger.error('SyncService.sync failed', { username, error: message })
      return { ok: false, error: message }
    } finally {
      this.abortController = null
    }
  }
}

function extractMainLineSan(root: MoveNode | null): string[] {
  const san: string[] = []
  let node: MoveNode | null = root
  while (node && node.san) {
    san.push(node.san)
    node = node.children[0] ?? null
  }
  return san
}

function getTimestampMonthKey(timestamp: number): number {
  const date = new Date(timestamp)
  return date.getUTCFullYear() * 12 + date.getUTCMonth()
}

function getArchiveMonthKey(year: number, month: number): number {
  return year * 12 + month - 1
}

function getArchiveUrlMonthKey(archiveUrl: string): number {
  const match = archiveUrl.match(/\/games\/(\d{4})\/(\d{1,2})\/?$/)
  if (!match) return Number.MIN_SAFE_INTEGER
  return getArchiveMonthKey(Number(match[1]), Number(match[2]))
}

export function normalizeOutcome(result: string): 'win' | 'loss' | 'draw' | null {
  if (result === 'win') return 'win'
  if (result === 'checkmated' || result === 'timeout' || result === 'resigned' || result === 'abandoned') return 'loss'
  // All Chess.com draw result codes
  if (result === 'draw' || result === 'stalemate' || result === 'repetition' || result === 'insufficient' || result === 'agreed' || result === '50move' || result === 'timevsinsufficient') return 'draw'
  return null
}

function timeClassFor(value: string): 'bullet' | 'blitz' | 'rapid' | 'classical' | 'daily' | null {
  if (value.includes('/')) {
    const dailySeconds = Number.parseInt(value.split('/')[1], 10)
    return dailySeconds >= 86400 ? 'daily' : null
  }
  const seconds = Number.parseInt(value.split(/[+:-]/)[0], 10)
  if (!Number.isFinite(seconds)) return null
  if (seconds < 180) return 'bullet'
  if (seconds < 600) return 'blitz'
  if (seconds < 1800) return 'rapid'
  return 'classical'
}
