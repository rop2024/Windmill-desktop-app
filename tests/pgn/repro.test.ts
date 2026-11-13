import { describe, it, expect } from 'vitest'
import { PgnService } from '@pgn/PgnService'

function pgn(white: string, black: string, result: string, extraHeaders: Record<string, string> = {}): string {
  const lines: string[] = [`[White "${white}"]`, `[Black "${black}"]`, `[Result "${result}"]`]
  for (const [k, v] of Object.entries(extraHeaders)) lines.push(`[${k} "${v}"]`)
  lines.push('', `1. e4 e5 ${result}`)
  return lines.join('\n')
}

const svc = new PgnService()

describe('outcome-from-my-perspective (no inversion)', () => {
  it('White win with no Player header does not assume White', () => {
    const { games } = svc.parseGames(pgn('ropXD', 'Bouncing_Back', '1-0'))
    expect(games[0].playerColor).toBeNull()
    expect(games[0].outcome).toBeNull()
  })

  it('Black win with no Player header is not inverted to a loss', () => {
    const { games } = svc.parseGames(pgn('dmr000', 'ropXD', '0-1'))
    expect(games[0].playerColor).toBeNull()
    expect(games[0].outcome).toBeNull()
  })

  it('Player header identifies White correctly', () => {
    const { games } = svc.parseGames(pgn('ropXD', 'Bouncing_Back', '1-0', { Player: 'ropXD' }))
    expect(games[0].playerColor).toBe('w')
    expect(games[0].outcome).toBe('win')
  })

  it('Player header identifies Black correctly', () => {
    const { games } = svc.parseGames(pgn('dmr000', 'ropXD', '0-1', { Player: 'ropXD' }))
    expect(games[0].playerColor).toBe('b')
    expect(games[0].outcome).toBe('win')
  })

  it('draws are still draws without a Player header', () => {
    const { games } = svc.parseGames(pgn('ropXD', 'Bouncing_Back', '1/2-1/2'))
    expect(games[0].playerColor).toBeNull()
    expect(games[0].outcome).toBe('draw')
  })
})
