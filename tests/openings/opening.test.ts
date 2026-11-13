import { describe, it, expect } from 'vitest'
import { createDefaultOpeningDetector } from '@openings/defaultOpenings'

const detect = (moves: string[]) => createDefaultOpeningDetector().detect(moves)

describe('OpeningDetector ECO correctness', () => {
  it('classifies King\'s Knight Game as C40 (not C20) when Nc6 is played', () => {
    const match = detect(['e4', 'e5', 'Nf3', 'Nc6'])
    expect(match).not.toBeNull()
    expect(match!.eco).toBe('C40')
    expect(match!.name).toContain("Knight")
  })

  it('classifies general Ruy Lopez as C60 (not C65)', () => {
    const match = detect(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'])
    expect(match).not.toBeNull()
    expect(match!.eco).toBe('C60')
    expect(match!.name).toBe("Ruy Lopez")
  })

  it('classifies Ruy Lopez Berlin as C65 when Nf6 follows Bb5', () => {
    const match = detect(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'Nf6'])
    expect(match).not.toBeNull()
    expect(match!.eco).toBe('C65')
    expect(match!.variation).toBe('Berlin')
  })

  it('classifies Giuoco Piano as C50 after Bc4', () => {
    const match = detect(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'])
    expect(match).not.toBeNull()
    expect(match!.eco).toBe('C50')
    expect(match!.name).toBe("Italian Game")
  })

  it('classifies Two Knights as C55 when Nf6 follows Bc4', () => {
    const match = detect(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6'])
    expect(match).not.toBeNull()
    expect(match!.eco).toBe('C55')
    expect(match!.name).toBe("Two Knights Defense")
  })

  it('classifies Sicilian Najdorf as B90', () => {
    const match = detect(['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6', 'Bg5'])
    expect(match).not.toBeNull()
    expect(match!.eco).toBe('B90')
    expect(match!.name).toBe("Sicilian Defense")
  })

  it('classifies Queen\'s Gambit as D20', () => {
    const match = detect(['d4', 'd5', 'c4'])
    expect(match).not.toBeNull()
    expect(match!.eco).toBe('D20')
    expect(match!.name).toBe("Queen's Gambit")
  })

  it('classifies Grünfeld as D80', () => {
    const match = detect(['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'd5', 'cxd5', 'Nxd5', 'e4'])
    expect(match).not.toBeNull()
    expect(match!.eco).toBe('D80')
    expect(match!.name).toBe("Grünfeld Defense")
  })
})

describe('OpeningDetector longest-match preference', () => {
  it('prefers the most specific variation over the general opening', () => {
    const general = detect(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'])
    const berlin = detect(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'Nf6'])
    expect(general!.eco).toBe('C60')
    expect(berlin!.eco).toBe('C65')
  })

  it('requires at least two plies before reporting an opening', () => {
    expect(detect(['e4'])).toBeNull()
    expect(detect(['c4'])).toBeNull()
    expect(detect(['d4'])).toBeNull()
  })

  it('reports King\'s Pawn Opening for e4 e5', () => {
    const match = detect(['e4', 'e5'])
    expect(match).not.toBeNull()
    expect(match!.eco).toBe('C00')
  })

  it('returns null for empty moves', () => {
    expect(detect([])).toBeNull()
  })
})
