import { spawn, type ChildProcess } from 'node:child_process'
import { join } from 'node:path'
import { app } from 'electron'
import { EventEmitter } from 'node:events'
import { parseUciLine, type UciLine, type UciBestMove } from './parseUci'
import { logger } from '../logger'

export type StockfishOptions = {
  threads?: number
  hash?: number
  multiPV?: number
  skillLevel?: number
}

export type AnalyzeRequest = {
  fen: string
  depth?: number
  movetime?: number
}

export type AnalysisInfo = {
  depth: number
  seldepth: number
  multipv: number
  score: { type: 'cp' | 'mate'; value: number } | null
  nodes: number
  nps: number
  pv: string[]
  time: number
}

const BINARY_NAME = process.platform === 'win32' ? 'stockfish.exe' : 'stockfish'

function binaryPath(): string {
  if (app.isPackaged) {
    const arch = process.arch === 'arm64' ? 'arm64' : 'x64'
    return join(process.resourcesPath, 'stockfish', `${process.platform}-${arch}`, BINARY_NAME)
  }
  return join(__dirname, '..', '..', 'resources', 'stockfish', `${process.platform}-${process.arch}`, BINARY_NAME)
}

export class EngineProcess extends EventEmitter {
  private proc: ChildProcess | null = null
  private buffer = ''
  private ready = false
  private initializing = false
  private initResolve: (() => void) | null = null
  private pending: Array<{ resolve: (v: unknown) => void; reject: (e: Error) => void }> = []
  private analyzeTimer: ReturnType<typeof setTimeout> | null = null
  private currentResolve: ((v: UciBestMove) => void) | null = null
  private currentReject: ((e: Error) => void) | null = null
  private sideToMove: 'w' | 'b' = 'w'
  private options: StockfishOptions = {}

  constructor(private readonly binary: string = binaryPath()) {
    super()
  }

  async start(options: StockfishOptions = {}): Promise<void> {
    if (this.proc) return
    this.options = options
    this.initializing = true

    const proc = spawn(this.binary, [], { windowsHide: true })
    this.proc = proc

    proc.stdout.on('data', (chunk: Buffer) => this.onData(chunk.toString('utf8')))
    proc.stderr.on('data', (chunk: Buffer) => {
      logger.warn('Stockfish stderr', { data: chunk.toString('utf8') })
    })
    proc.on('error', (e) => {
      logger.error('Stockfish spawn error', { error: e.message })
      this.handleError(new Error(`Failed to start Stockfish: ${e.message}`))
    })
    proc.on('exit', (code) => {
      logger.info('Stockfish exited', { code })
      this.proc = null
      this.ready = false
      if (this.initializing) {
        this.initializing = false
        this.initResolve = null
        this.handleError(new Error(`Stockfish exited with code ${code} during startup`))
      }
    })

    this.send('uci')
    await this.waitFor('uciok')

    this.send('setoption name Threads ' + (this.options.threads ?? 1))
    this.send('setoption name Hash ' + (this.options.hash ?? 256))
    this.send('setoption name MultiPV ' + (this.options.multiPV ?? 1))
    this.send('isready')
    await this.waitFor('readyok')

    this.ready = true
    this.initializing = false
    logger.info('Stockfish ready', { options: this.options })
  }

  private onData(data: string): void {
    this.buffer += data
    let idx: number
    while ((idx = this.buffer.indexOf('\n')) !== -1) {
      const line = this.buffer.slice(0, idx).replace(/\r$/, '')
      this.buffer = this.buffer.slice(idx + 1)
      this.handleLine(line)
    }
  }

  private handleLine(line: string): void {
    const side = this.sideToMove
    const parsed = parseUciLine(line, side)
    if (!parsed) return

    switch (parsed.type) {
      case 'uciok':
        this.emit('line', parsed)
        if (this.initResolve) this.initResolve()
        break
      case 'readyok':
        this.emit('line', parsed)
        if (this.initResolve) this.initResolve()
        else if (this.currentResolve) {
          // spurious readyok mid-analysis - ignore
        }
        break
      case 'info':
        this.emit('info', parsed.data as AnalysisInfo)
        break
      case 'bestmove': {
        if (this.currentResolve) {
          this.currentResolve(parsed.data)
          this.currentResolve = null
          this.currentReject = null
        }
        if (this.analyzeTimer) {
          clearTimeout(this.analyzeTimer)
          this.analyzeTimer = null
        }
        break
      }
      case 'error':
        logger.warn('Stockfish error line', { line })
        break
    }
  }

  private waitFor(expected: 'uciok' | 'readyok'): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup()
        reject(new Error(`Timed out waiting for Stockfish ${expected}`))
      }, 10000)
      const cleanup = () => {
        clearTimeout(timeout)
        this.off('line', listener)
        this.off('error', errorListener)
      }
      const resolver = () => {
        cleanup()
        resolve()
      }
      const listener = (line: UciLine) => {
        if (line.type === expected) resolver()
      }
      const errorListener = (error: Error) => {
        cleanup()
        reject(error)
      }
      this.on('line', listener)
      this.on('error', errorListener)
    })
  }

  private handleError(err: Error): void {
    this.emit('error', err)
    if (this.currentReject) {
      this.currentReject(err)
      this.currentReject = null
      this.currentResolve = null
    }
    if (this.initResolve) {
      this.initResolve = null
    }
  }

  private send(cmd: string): void {
    const proc = this.proc
    if (!proc) throw new Error('Engine not started')
    proc.stdin!.write(cmd + '\n')
  }

  async analyze(req: AnalyzeRequest, timeoutMs = 10000): Promise<{ bestmove: UciBestMove; infos: AnalysisInfo[] }> {
    if (!this.ready) throw new Error('Engine not ready')
    const chessSide = req.fen.split(' ')[1] as 'w' | 'b'
    this.sideToMove = chessSide === 'b' ? 'b' : 'w'

    const infos: AnalysisInfo[] = []
    const infoHandler = (info: AnalysisInfo) => infos.push(info)
    this.on('info', infoHandler)

    return new Promise<{ bestmove: UciBestMove; infos: AnalysisInfo[] }>((resolve, reject) => {
      this.currentResolve = (bm) => {
        this.off('info', infoHandler)
        resolve({ bestmove: bm, infos })
      }
      this.currentReject = reject

      if (req.depth) this.send(`position fen ${req.fen}\ngo depth ${req.depth}`)
      else if (req.movetime) this.send(`position fen ${req.fen}\ngo movetime ${req.movetime}`)
      else this.send(`position fen ${req.fen}\ngo depth 12`)

      this.analyzeTimer = setTimeout(() => {
        this.analyzeTimer = null
        this.send('stop')
        reject(new Error('Engine analysis timed out'))
      }, timeoutMs)
    })
  }

  stop(): void {
    if (this.proc) this.send('stop')
    if (this.analyzeTimer) {
      clearTimeout(this.analyzeTimer)
      this.analyzeTimer = null
    }
    if (this.currentReject) {
      this.currentReject(new Error('Analysis stopped'))
      this.currentReject = null
      this.currentResolve = null
    }
  }

  async quit(): Promise<void> {
    this.stop()
    if (this.proc) {
      try {
        this.proc.kill()
      } catch {
        // ignore
      }
      this.proc = null
    }
    this.ready = false
    this.removeAllListeners()
  }

  isReady(): boolean {
    return this.ready
  }
}
