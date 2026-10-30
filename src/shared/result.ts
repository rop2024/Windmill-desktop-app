export type ErrorCode =
  | 'DATABASE_ERROR'
  | 'PGN_INVALID'
  | 'PGN_DUPLICATE'
  | 'SYNC_FAILED'
  | 'AUTH_FAILED'
  | 'ENGINE_FAILED'
  | 'ENGINE_TIMEOUT'
  | 'FILE_READ_FAILED'
  | 'FILE_WRITE_FAILED'

export class AppError extends Error {
  readonly code: ErrorCode
  readonly cause?: unknown

  constructor(code: ErrorCode, message: string, cause?: unknown) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.cause = cause
  }
}

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: AppError }

export function ok<T>(data: T): Result<T> {
  return { ok: true, data }
}

export function err(code: ErrorCode, message: string, cause?: unknown): Result<never> {
  return { ok: false, error: new AppError(code, message, cause) }
}

export function isResult<T>(value: unknown): value is Result<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'ok' in value &&
    (value as Result<T>).ok !== undefined
  )
}
