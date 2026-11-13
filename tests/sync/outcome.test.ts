import { describe, it, expect, vi } from 'vitest'

vi.mock('@main/services/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }
}))

vi.mock('@main/services/database/connection', () => ({
  getDB: vi.fn()
}))

vi.mock('@main/services/settings', () => ({
  settingsService: { get: vi.fn(), save: vi.fn() }
}))

import { normalizeOutcome } from '@main/services/sync/SyncService'

describe('normalizeOutcome', () => {
  it.each([
    ['win', 'win'],
    ['checkmated', 'loss'],
    ['timeout', 'loss'],
    ['resigned', 'loss'],
    ['abandoned', 'loss'],
    ['draw', 'draw'],
    ['stalemate', 'draw'],
    ['repetition', 'draw'],
    ['insufficient', 'draw'],
    ['agreed', 'draw'],
    ['50move', 'draw'],
    ['timevsinsufficient', 'draw'],
    ['unknown', null],
    ['', null],
  ])('normalizes %s to %s', (input, expected) => {
    expect(normalizeOutcome(input)).toBe(expected)
  })
})
