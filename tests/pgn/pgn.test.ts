import { describe, it, expect } from 'vitest'
import { splitGames } from '@pgn/splitGames'
import { parseHeaders, extractHeaders } from '@pgn/parseHeaders'
import { tokenize } from '@pgn/tokenize'
import { buildTree } from '@pgn/buildTree'
import { serialize } from '@pgn/serialize'
import { flattenMainLine } from '@pgn/flattenMainLine'
import { PgnService } from '@pgn/PgnService'
import { OpeningDetector } from '@openings/OpeningDetector'
import { DEFAULT_FEN } from '@pgn/types'

describe('splitGames', () => {
  it('splits a single game', () => {
    const games = splitGames(`[Event "X"]\n\n1. e4 e5 1-0`)
    expect(games).toHaveLength(1)
    expect(games[0]).toContain('1. e4 e5 1-0')
  })

  it('splits multiple games', () => {
    const text = `[Event "A"]\n\n1. e4 1-0\n\n[Event "B"]\n\n1. d4 0-1`
    const games = splitGames(text)
    expect(games).toHaveLength(2)
  })

  it('handles games with no headers', () => {
    const games = splitGames(`1. e4 e5 1-0`)
    expect(games).toHaveLength(1)
  })

  it('strips BOM', () => {
    const games = splitGames(`\uFEFF[Event "X"]\n\n1. e4 1-0`)
    expect(games).toHaveLength(1)
  })

  it('handles CRLF line endings', () => {
    const games = splitGames(`[Event "X"]\r\n\r\n1. e4 1-0\r\n`)
    expect(games).toHaveLength(1)
  })
})

describe('parseHeaders', () => {
  it('parses all standard tags', () => {
    const text = `[Event "WCC"]
[Site "London"]
[Date "2024.01.01"]
[Round "10"]
[White "Carlsen, Magnus"]
[Black "Anand, Viswanathan"]
[WhiteElo "2830"]
[BlackElo "2780"]
[Result "1-0"]
[TimeControl "90+30"]
[ECO "C50"]
[Opening "Giuoco Piano"]
[Termination "Normal"]`

    const headers = parseHeaders(text)
    expect(headers.get('Event')).toBe('WCC')
    expect(headers.get('White')).toBe('Carlsen, Magnus')
    expect(headers.get('WhiteElo')).toBe('2830')
    expect(headers.get('ECO')).toBe('C50')
  })

  it('extracts headers and movetext', () => {
    const { headers, rest } = extractHeaders(`[Event "X"]\n\n1. e4 e5 1-0`)
    expect(headers.get('Event')).toBe('X')
    expect(rest).toContain('1. e4 e5 1-0')
  })
})

describe('tokenize', () => {
  it('does not loop on a structural character at token start', () => {
    expect(tokenize(')')).toEqual([{ type: 'rparen', value: ')' }])
  })

  it('tokenizes movetext with comments, variations, NAGs, result', () => {
    const tokens = tokenize(`1. e4 {good move} e5!$ (2. Nf3) 1-0`)
    const types = tokens.map((t) => t.type)
    expect(types).toContain('moveNumber')
    expect(types).toContain('san')
    expect(types).toContain('comment')
    expect(types).toContain('nag')
    expect(types).toContain('lparen')
    expect(types).toContain('rparen')
    expect(types).toContain('result')
  })

  it('handles Chess.com clock comments', () => {
    const tokens = tokenize(`1. e4 {[%clk 0:10:00]} e5`)
    const comments = tokens.filter((t) => t.type === 'comment')
    expect(comments[0].value).toContain('[%clk')
  })
})

describe('buildTree', () => {
  it('builds a main-line tree with FENs and UCI', () => {
    const { nodes, errors } = buildTree('1. e4 e5 2. Nf3 Nc6')
    expect(errors).toHaveLength(0)
    expect(nodes).toHaveLength(2) // ply 1 and ply 2
    expect(nodes[0].san).toBe('e4')
    expect(nodes[0].uci).toBe('e2e4')
    expect(nodes[0].fenBefore).toBe(DEFAULT_FEN)
    expect(nodes[1].san).toBe('e5')
    expect(nodes[1].uci).toBe('e7e5')
  })

  it('supports castling', () => {
    const { nodes, errors } = buildTree('1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O')
    expect(errors).toHaveLength(0)
    const castle = nodes.find((n) => n.san === 'O-O')
    expect(castle).toBeDefined()
  })

  it('supports promotion and underpromotion', () => {
    const { errors } = buildTree('1. e4 e5 2. Nf3 Nc6 3. d4 exd4 4. Nxd4 Nf6 5. e5 dxe5 6. Nxe5 Qe7 7. a4 b5 8. axb5 axb5 9. b6 axb6 10. a7 b1=N 11. a8=Q')
    expect(errors).toHaveLength(0)
  })

  it('supports en passant', () => {
    const { errors } = buildTree('1. e4 e5 2. Nf3 Nf6 3. d4 exd4 4. e5 Ne4 5. Qxd4 d5 6. exd6 e.p.')
    expect(errors).toHaveLength(0)
  })

  it('records illegal SAN as an error without throwing', () => {
    const { errors } = buildTree('1. a3 a6 2. Ra3')
    expect(errors.length).toBeGreaterThan(0)
  })

  it('builds variations as sibling children', () => {
    const { nodes } = buildTree('1. e4 e5 2. Nf3 (2. Nc3) Nc6')
    // find the 2. Nf3 node
    const nf3Node = nodes.find((n) => n.san === 'Nf3' && n.ply === 3)
    expect(nf3Node).toBeDefined()
    const variations = nf3Node!.children.filter((c) => c.san === 'Nc3')
    expect(variations).toHaveLength(1)
  })
})

describe('serialize', () => {
  it('round-trips a simple game', () => {
    const { nodes } = buildTree('1. e4 e5 2. Nf3 Nc6 1-0')
    const headers = new Map([['Event', 'T'], ['Result', '1-0']])
    const out = serialize(headers, nodes, '1-0')
    expect(out).toContain('[Event "T"]')
    expect(out).toContain('1. e4 e5 2. Nf3 Nc6')
    expect(out).toContain('1-0')
  })

  it('includes comments and variations', () => {
    const { nodes } = buildTree('1. e4 {comment} e5 (2. Nf3) 1-0')
    const out = serialize(new Map(), nodes, null)
    expect(out).toContain('{comment}')
    expect(out).toContain('(2. Nf3)')
  })
})

describe('flattenMainLine', () => {
  it('flattens main line to move rows', () => {
    const { nodes } = buildTree('1. e4 e5 2. Nf3')
    const rows = flattenMainLine('game-1', nodes)
    expect(rows).toHaveLength(3)
    expect(rows[0].san).toBe('e4')
    expect(rows[1].san).toBe('e5')
    expect(rows[2].san).toBe('Nf3')
    expect(rows[0].uci).toBe('e2e4')
    expect(rows.every((r) => r.gameId === 'game-1')).toBe(true)
  })
})

describe('PgnService', () => {
  it('parses multiple games and isolates errors', () => {
    const service = new PgnService()
    const text = `[Event "Good"]\n\n1. e4 e5 1-0\n\n[Event "Bad"]\n\n1. a3 a6 2. Ra3 1-0`
    const { games, errors } = service.parseGames(text)
    expect(games).toHaveLength(2)
    // good game has no error, bad game has an error
    expect(games[0].error).toBeNull()
    expect(games[1].error).not.toBeNull()
    expect(errors.length).toBeGreaterThan(0)
  })
})

describe('OpeningDetector', () => {
  it('detects Ruy Lopez from ECO TSV', () => {
    const detector = new OpeningDetector()
    detector.loadFromTsv(`C65\tRuy Lopez\t\t1. e4 e5 2. Nf3 Nc6 3. Bb5
C50\tGiuoco Piano\t\t1. e4 e5 2. Nf3 Nc6 3. Bc4`)
    const match = detector.detect(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'])
    expect(match).not.toBeNull()
    expect(match!.eco).toBe('C65')
    expect(match!.name).toBe('Ruy Lopez')
  })

  it('returns null when no opening matches', () => {
    const detector = new OpeningDetector()
    detector.loadFromTsv(`C65\tRuy Lopez\t\t1. e4 e5 2. Nf3 Nc6 3. Bb5`)
    const match = detector.detect(['d4', 'd5'])
    expect(match).toBeNull()
  })
})
