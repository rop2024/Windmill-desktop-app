import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getDB } from '../../src/main/services/database/connection'
import type { Database } from 'better-sqlite3'
import { buildWhere } from '../../src/main/services/database/repositories/GameRepository'

vi.mock('../../src/main/services/database/connection', () => ({
  getDB: vi.fn()
}))
vi.mock('../../src/main/services/database/repositories/GameRepository', () => ({
  buildWhere: vi.fn(() => ({ where: '', params: [] }))
}))

const mockGetDB = vi.mocked(getDB)
const mockBuildWhere = vi.mocked(buildWhere)
type MockDb = {
  prepare: ReturnType<typeof vi.fn>
}
let mockDb: MockDb

beforeEach(() => {
  vi.resetAllMocks()
  mockDb = { prepare: vi.fn() }
  mockGetDB.mockReturnValue(mockDb as unknown as Database)
  mockBuildWhere.mockReturnValue({ where: '', params: [] })
})

import { weaknessEngine } from '../../src/main/services/analysis/WeaknessEngine'

describe('WeaknessEngine', () => {
  it('returns No data when there are no games', () => {
    mockDb.prepare.mockImplementation((sql: string) => {
      if (String(sql).includes('SELECT id, played_at, player_color, outcome, result FROM games')) {
        return { all: vi.fn(() => []), get: vi.fn(() => undefined), run: vi.fn(() => ({ changes: 0 })) }
      }
      return { all: vi.fn(() => []), get: vi.fn(() => undefined), run: vi.fn(() => ({ changes: 0 })) }
    })
    const profile = weaknessEngine.profile()
    expect(profile.gamesAnalyzed).toBe(0)
    expect(profile.categories.every((c) => c.label === 'No data' && c.score === 0)).toBe(true)
    expect(profile.topWeakness).toBeNull()
    expect(profile.topStrength).toBeNull()
  })

  it('returns No data when games exist but no engine analysis rows', () => {
    mockDb.prepare.mockImplementation((sql: string) => {
      if (String(sql).includes('SELECT id, played_at, player_color, outcome, result FROM games')) {
        return {
          all: vi.fn(() => [
            { id: 'g1', played_at: 1000, player_color: 'w', outcome: 'win', result: 'win' },
            { id: 'g2', played_at: 2000, player_color: 'b', outcome: 'loss', result: 'loss' }
          ]),
          get: vi.fn(() => undefined),
          run: vi.fn(() => ({ changes: 0 }))
        }
      }
      if (String(sql).includes('engine_analysis')) {
        return { all: vi.fn(() => []), get: vi.fn(() => undefined), run: vi.fn(() => ({ changes: 0 })) }
      }
      return { all: vi.fn(() => []), get: vi.fn(() => undefined), run: vi.fn(() => ({ changes: 0 })) }
    })
    const profile = weaknessEngine.profile()
    expect(profile.gamesAnalyzed).toBe(0)
    expect(profile.categories.every((c) => c.label === 'No data' && c.score === 0)).toBe(true)
    expect(profile.categories.every((c) => c.moves === 0 && c.errors === 0)).toBe(true)
  })

  it('computes real scores when engine analysis exists', () => {
    mockDb.prepare.mockImplementation((sql: string) => {
      if (String(sql).includes('SELECT id, played_at, player_color, outcome, result FROM games')) {
        return {
          all: vi.fn(() => [{ id: 'g1', played_at: 1000, player_color: 'w', outcome: 'win', result: 'win' }]),
          get: vi.fn(() => undefined),
          run: vi.fn(() => ({ changes: 0 }))
        }
      }
      if (String(sql).includes('engine_analysis')) {
        return {
          all: vi.fn(() => [{ ply: 1, classification: null, centipawn_loss: null }]),
          get: vi.fn(() => undefined),
          run: vi.fn(() => ({ changes: 0 }))
        }
      }
      return { all: vi.fn(() => []), get: vi.fn(() => undefined), run: vi.fn(() => ({ changes: 0 })) }
    })
    const profile = weaknessEngine.profile()
    expect(profile.gamesAnalyzed).toBe(1)
    const opening = profile.categories.find((c) => c.category === 'opening')!
    expect(opening.label).not.toBe('No data')
    expect(opening.score).toBeGreaterThan(0)
  })
})
