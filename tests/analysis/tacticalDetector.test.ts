import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getDB } from '../../src/main/services/database/connection'
import type { Database } from 'better-sqlite3'

vi.mock('../../src/main/services/database/connection', () => ({
  getDB: vi.fn()
}))

const mockGetDB = vi.mocked(getDB)
type MockDb = {
  prepare: ReturnType<typeof vi.fn>
  transaction: ReturnType<typeof vi.fn>
}
let mockDb: MockDb

beforeEach(() => {
  vi.resetAllMocks()
  mockDb = { prepare: vi.fn(), transaction: vi.fn((fn: () => unknown) => fn) }
  mockGetDB.mockReturnValue(mockDb as unknown as Database)
})

import { tacticalDetector } from '../../src/main/services/analysis/TacticalDetector'

function mockMoves(rows: unknown[]): void {
  mockDb.prepare.mockImplementation((sql: string) => {
    if (String(sql).includes('SELECT ply, san, fen FROM game_moves')) {
      return { all: vi.fn(() => rows), get: vi.fn(() => undefined), run: vi.fn(() => ({ changes: 0 })) }
    }
    if (String(sql).includes('engine_analysis')) {
      return { all: vi.fn(() => []), get: vi.fn(() => undefined), run: vi.fn(() => ({ changes: 0 })) }
    }
    return { all: vi.fn(() => []), get: vi.fn(() => undefined), run: vi.fn(() => ({ changes: 0 })) }
  })
}

describe('TacticalDetector dedup', () => {
  it('counts each distinct tactic event once per game, not once per ply', () => {
    const moves = [
      { ply: 1, san: 'e4', fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1' },
      { ply: 2, san: 'e5', fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2' },
      { ply: 3, san: 'Nf3', fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2' },
      { ply: 4, san: 'Nc6', fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3' }
    ]
    mockMoves(moves)

    const result = tacticalDetector.analyzeGame('g1')

    const tacticKeys = result.tactics.map((t) => `${t.tacticType}|${t.targetSquare ?? ''}`)
    const uniqueKeys = new Set(tacticKeys)
    expect(uniqueKeys.size).toBe(tacticKeys.length)
  })
})
