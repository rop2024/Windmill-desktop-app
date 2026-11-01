import { EventEmitter } from 'node:events'
import { EngineProcess, type StockfishOptions } from './EngineProcess'
import { logger } from '../logger'

export type AnalysisUpdate = {
  fen: string
  depth: number
  seldepth: number
  multipv: number
  score: { type: 'cp' | 'mate'; value: number } | null
  nodes: number
  nps: number
  pv: string[]
  time: number
  bestmove: string | null
}

export type AnalysisStatus = 'idle' | 'analyzing' | 'stopped' | 'error'

export class EngineService extends EventEmitter {
  private engine: EngineProcess | null = null
  private status: AnalysisStatus = 'idle'
  private abortController: AbortController | null = null
  private started = false

  async start(options: StockfishOptions = {}): Promise<void> {
    if (this.started && this.engine?.isReady()) return

    if (this.engine && !this.engine.isReady()) {
      await this.engine.quit()
      this.engine = null
      this.started = false
    }

    if (!this.engine) {
      this.engine = new EngineProcess()
      this.engine.on('info', (info) => {
        if (this.status === 'analyzing') {
          this.emit('update', { ...info, bestmove: null })
        }
      })
      this.engine.on('error', (err) => {
        logger.error('Engine error', { error: err.message })
        this.status = 'error'
        this.emit('error', err)
      })
    }
    if (!this.started) {
      try {
        await this.engine.start(options)
        this.started = true
      } catch (error) {
        await this.engine.quit()
        this.engine = null
        this.started = false
        throw error
      }
    }
  }

  async analyzePosition(
    fen: string,
    opts: { depth?: number; movetime?: number; timeoutMs?: number } = {}
  ): Promise<{ bestmove: string | null; pv: string[]; score: { type: string; value: number } | null }> {
    if (!this.engine) throw new Error('Engine not started')
    this.status = 'analyzing'
    this.abortController = new AbortController()

    try {
      const result = await this.engine.analyze({ fen, depth: opts.depth, movetime: opts.movetime }, opts.timeoutMs ?? 15000)
      this.status = 'idle'
      this.abortController = null

      const best = result.bestmove.move
      const last = result.infos[result.infos.length - 1]
      if (!last) {
        throw new Error('Stockfish returned no analysis information')
      }
      this.emit('update', { fen, ...last, bestmove: best })
      this.emit('result', { bestmove: best, pv: result.infos.map((i) => i.pv).flat(), score: last.score })
      return { bestmove: best, pv: last.pv, score: last.score }
    } catch (e) {
      this.status = 'error'
      this.emit('error', e)
      throw e
    }
  }

  stop(): void {
    this.engine?.stop()
    this.status = 'idle'
    this.abortController = null
    this.emit('update', { fen: '', depth: 0, seldepth: 0, multipv: 0, score: null, nodes: 0, nps: 0, pv: [], time: 0, bestmove: null })
  }

  async quit(): Promise<void> {
    this.stop()
    if (this.engine) {
      await this.engine.quit()
      this.engine = null
      this.started = false
    }
  }

  getStatus(): AnalysisStatus {
    return this.status
  }

  isReady(): boolean {
    return this.engine?.isReady() ?? false
  }
}

export const engineService = new EngineService()
