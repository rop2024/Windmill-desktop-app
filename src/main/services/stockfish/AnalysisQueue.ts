import { EventEmitter } from 'node:events'
import { engineService } from './EngineService'
import { AnalysisCache } from './AnalysisCache'
import { analysisRepository } from '../analysis/AnalysisRepository'
import { classifyMove, type ClassificationResult } from '../analysis/classifyMove'
import { computeAccuracy, type AccuracyInput } from '../analysis/calculateAccuracy'
import { getDB } from '../database/connection'
import { logger } from '../logger'

export type AnalysisJob = {
  gameId: string
  settings: {
    depth: number
    movetime: number
    threads: number
    hash: number
    multiPV: number
  }
}

export type AnalysisProgress = {
  gameId: string
  done: number
  total: number
  currentPly: number
}

export type AnalyzedPly = {
  ply: number
  fenBefore: string
  fenAfter: string
  score: { type: 'cp' | 'mate'; value: number } | null
  centipawnLoss: number | null
  classification: string | null
  bestmove: string | null
  pv: string[]
  depth: number
}

export type GameAnalysisResult = {
  gameId: string
  plies: AnalyzedPly[]
  accuracyWhite: number
  accuracyBlack: number
}

export class AnalysisQueue extends EventEmitter {
  private queue: AnalysisJob[] = []
  private processing = false
  private cancelled = new Set<string>()
  private activeGame: string | null = null
  private cache = new AnalysisCache()

  enqueue(job: AnalysisJob): void {
    this.queue.push(job)
    this.emit('queueChanged', this.queue.length)
    if (!this.processing) {
      void this.processQueue()
    }
  }

  cancel(gameId: string): void {
    this.cancelled.add(gameId)
    if (this.activeGame === gameId) {
      engineService.stop()
    }
    this.queue = this.queue.filter((j) => j.gameId !== gameId)
    this.emit('queueChanged', this.queue.length)
  }

  cancelAll(): void {
    this.queue.forEach((j) => this.cancelled.add(j.gameId))
    engineService.stop()
    this.queue = []
    this.emit('queueChanged', 0)
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) return
    this.processing = true

    while (this.queue.length > 0) {
      const job = this.queue[0]
      if (this.cancelled.has(job.gameId)) {
        this.queue.shift()
        continue
      }

      this.activeGame = job.gameId
      try {
        const result = await this.analyzeGame(job)
        this.emit('gameComplete', result)
      } catch (e) {
        logger.error('Game analysis failed', { gameId: job.gameId, error: String(e) })
        this.emit('gameError', { gameId: job.gameId, error: String(e) })
      } finally {
        this.activeGame = null
        this.queue.shift()
        this.emit('queueChanged', this.queue.length)
      }
    }

    this.processing = false
  }

  private async analyzeGame(job: AnalysisJob): Promise<GameAnalysisResult> {
    const moves = await this.getGameMoves(job.gameId)
    if (moves.length === 0) {
      return { gameId: job.gameId, plies: [], accuracyWhite: 0, accuracyBlack: 0 }
    }

    const engineVersion = 'stockfish-bundled'
    const plies: AnalyzedPly[] = []

    for (let i = 0; i < moves.length; i++) {
      if (this.cancelled.has(job.gameId)) {
        throw new Error('Cancelled')
      }

      const move = moves[i]
      const before = await this.analyzePosition(move.fenBefore, job.settings, engineVersion)
      const after = i + 1 < moves.length ? await this.analyzePosition(move.fenAfter, job.settings, engineVersion) : null

      const classificationResult: ClassificationResult = classifyMove(before.score, after?.score ?? null)
      const centipawnLoss = classificationResult.centipawnLoss
      const classification = classificationResult.classification

      const ply: AnalyzedPly = {
        ply: move.ply,
        fenBefore: move.fenBefore,
        fenAfter: move.fenAfter,
        score: before.score,
        centipawnLoss,
        classification,
        bestmove: before.bestmove,
        pv: before.pv,
        depth: before.depth
      }

      await analysisRepository.storePly(job.gameId, ply)
      plies.push(ply)

      this.emit('progress', {
        gameId: job.gameId,
        done: i + 1,
        total: moves.length,
        currentPly: move.ply
      })
    }

    const whitePlies: AccuracyInput[] = plies.filter((p) => p.ply % 2 === 1).map((p) => ({
      classification: p.classification,
      centipawnLoss: p.centipawnLoss
    }))
    const blackPlies: AccuracyInput[] = plies.filter((p) => p.ply % 2 === 0).map((p) => ({
      classification: p.classification,
      centipawnLoss: p.centipawnLoss
    }))

    return {
      gameId: job.gameId,
      plies,
      accuracyWhite: computeAccuracy(whitePlies),
      accuracyBlack: computeAccuracy(blackPlies)
    }
  }

  private async getGameMoves(gameId: string): Promise<Array<{ ply: number; fenBefore: string; fenAfter: string }>> {
    const db = getDB()
    const rows = db.prepare(
      'SELECT ply, fen_before AS fenBefore, fen_after AS fenAfter FROM game_moves WHERE game_id = ? ORDER BY move_number ASC'
    ).all(gameId) as Array<{ ply: number; fenBefore: string; fenAfter: string }>
    return rows
  }

  private async analyzePosition(
    fen: string,
    settings: AnalysisJob['settings'],
    engineVersion: string
  ): Promise<{
    score: { type: 'cp' | 'mate'; value: number } | null
    bestmove: string | null
    pv: string[]
    depth: number
  }> {
    const cached = this.cache.lookup(fen, engineVersion, settings)
    if (cached) {
      const score = (cached.score_cp !== null
        ? { type: 'cp' as const, value: cached.score_cp }
        : cached.score_mate !== null
          ? { type: 'mate' as const, value: cached.score_mate }
          : null) as { type: 'cp' | 'mate'; value: number } | null
      return { score, bestmove: cached.bestmove, pv: cached.pv ? JSON.parse(cached.pv) : [], depth: cached.depth }
    }

    const result = await engineService.analyzePosition(fen, {
      depth: settings.depth,
      movetime: settings.movetime,
      timeoutMs: (settings.movetime ?? 15000) + 5000
    })

    const score = result.score as { type: 'cp' | 'mate'; value: number } | null
    this.cache.store(fen, engineVersion, settings, {
      score_cp: score?.type === 'cp' ? score.value : null,
      score_mate: score?.type === 'mate' ? score.value : null,
      bestmove: result.bestmove,
      pv: result.pv,
      depth: settings.depth
    })

    return { score, bestmove: result.bestmove, pv: result.pv, depth: settings.depth }
  }
}

export const analysisQueue = new AnalysisQueue()
