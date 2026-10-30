import { readFile } from 'node:fs/promises'
import { PgnService } from '@pgn/PgnService'
import { OpeningDetector } from '@openings/OpeningDetector'
import { GameRepository } from './database/repositories/GameRepository'
import { logger } from './logger'
import { type ParsedGame, type ParsedGames, type MoveNode } from '@pgn/types'

export type ImportProgress = {
  stage: 'parsing' | 'importing' | 'done'
  processed: number
  total: number
  found: number
  imported: number
  duplicates: number
  invalid: number
}

export type ImportReport = {
  found: number
  imported: number
  duplicates: number
  invalid: number
  errors: Array<{ gameIndex: number; message: string }>
}

const CHUNK_SIZE = 200

export class ImportService {
  private repo: GameRepository
  private pgnService: PgnService
  private openingDetector: OpeningDetector | null
  private sendProgress?: (progress: ImportProgress) => void

  constructor(sendProgress?: (progress: ImportProgress) => void, openingDetector: OpeningDetector | null = null) {
    this.repo = new GameRepository()
    this.pgnService = new PgnService()
    this.openingDetector = openingDetector
    this.sendProgress = sendProgress
  }

  async importFile(filePath: string): Promise<ImportReport> {
    let text: string
    try {
      const buf = await readFile(filePath)
      text = Buffer.from(buf).toString('utf8')
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      logger.error('ImportService.readFile failed', { path: filePath, error: message })
      throw new Error(`Failed to read file: ${message}`)
    }

    const parsed: ParsedGames = this.pgnService.parseGames(text)
    const found = parsed.games.length
    const invalid = parsed.errors.length

    this.sendProgress?.({
      stage: 'parsing',
      processed: 0,
      total: found,
      found,
      imported: 0,
      duplicates: 0,
      invalid
    })

    let imported = 0
    let duplicates = 0
    const errors: Array<{ gameIndex: number; message: string }> = [...parsed.errors]

    const games = parsed.games
    for (let i = 0; i < games.length; i += CHUNK_SIZE) {
      const chunk = games.slice(i, i + CHUNK_SIZE)
      const toInsert: ParsedGame[] = []

      for (const game of chunk) {
        if (game.error) {
          errors.push({ gameIndex: i + chunk.indexOf(game), message: game.error.message })
          continue
        }
        if (this.openingDetector && game.root) {
          const mainLineSan = extractMainLineSan(game.root)
          const match = this.openingDetector.detect(mainLineSan)
          if (match) {
            game.headers.set('ECO', match.eco)
            game.headers.set('Opening', match.name)
            if (match.variation) game.headers.set('Variation', match.variation)
          }
        }
        toInsert.push(game)
      }

      const result = this.repo.insertMany(toInsert)
      if (!result.ok) {
        errors.push({ gameIndex: i, message: String(result.error) })
        continue
      }
      imported += result.imported
      duplicates += result.duplicates

      this.sendProgress?.({
        stage: 'importing',
        processed: Math.min(i + CHUNK_SIZE, games.length),
        total: games.length,
        found,
        imported,
        duplicates,
        invalid
      })
    }

    this.sendProgress?.({
      stage: 'done',
      processed: games.length,
      total: games.length,
      found,
      imported,
      duplicates,
      invalid
    })

    return { found, imported, duplicates, invalid, errors }
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
