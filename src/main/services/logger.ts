import { app } from 'electron'
import { appendFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'

const LEVEL_ORDER: Record<LogLevel, number> = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 }
const MIN_LEVEL: LogLevel =
  process.env.NODE_ENV === 'production' || process.env.VITE_DEV_SERVER_URL === undefined
    ? 'INFO'
    : 'DEBUG'

const SECRET_RE = /(token|password|secret|api[_-]?key)\s*[:=]\s*\S+/gi

function redact(message: string): string {
  return message.replace(SECRET_RE, '$1: ***')
}

export class Logger {
  private readonly logDir: string
  private readonly logFile: string

  constructor() {
    this.logDir = join(app.getPath('userData'), 'logs')
    this.logFile = join(this.logDir, 'app.log')
    if (!existsSync(this.logDir)) {
      mkdirSync(this.logDir, { recursive: true })
    }
  }

  private write(level: LogLevel, message: string, meta?: unknown) {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[MIN_LEVEL]) return
    const ts = new Date().toISOString()
    const line = JSON.stringify({ ts, level, message: redact(message), meta })
    try {
      appendFileSync(this.logFile, line + '\n')
    } catch {
      // ignore fs errors to avoid throwing from logging
    }
    const method = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log
    method(line)
  }

  debug(message: string, meta?: unknown) {
    this.write('DEBUG', message, meta)
  }

  info(message: string, meta?: unknown) {
    this.write('INFO', message, meta)
  }

  warn(message: string, meta?: unknown) {
    this.write('WARN', message, meta)
  }

  error(message: string, meta?: unknown) {
    this.write('ERROR', message, meta)
  }
}

export const logger = new Logger()
