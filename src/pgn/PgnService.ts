import { splitGames } from './splitGames'
import { extractHeaders } from './parseHeaders'
import { buildTree } from './buildTree'
import { flattenMainLine, type GameMoveRow } from './flattenMainLine'
import {
  type ParsedGame,
  PgnError,
  type ParsedGames,
  DEFAULT_FEN
} from './types'

const RESULT_AT_END = /\s+(1-0|0-1|1\/2-1\/2|\*)\s*$/

function detectResult(movetext: string): { result: string | null; clean: string } {
  const m = RESULT_AT_END.exec(movetext)
  if (m) {
    return { result: m[1], clean: movetext.slice(0, m.index).trim() }
  }
  return { result: null, clean: movetext.trim() }
}

export class PgnService {
  parseGames(text: string): ParsedGames {
    const rawGames = splitGames(text)
    const games: ParsedGame[] = []
    const errors: PgnError[] = []

    rawGames.forEach((raw, index) => {
      const { headers, rest } = extractHeaders(raw)
      const { result, clean } = detectResult(rest)
      const startFen = headers.get('SetUp') === '1' && headers.get('FEN') ? headers.get('FEN')! : DEFAULT_FEN

      const { nodes, errors: treeErrors } = buildTree(clean, startFen)

      const game: ParsedGame = {
        id: crypto.randomUUID(),
        headers,
        movetext: clean,
        result: result as '1-0' | '0-1' | '1/2-1/2' | '*' | null,
        root: nodes[0] ?? null,
        error: null
      }
      populateStatistics(game)

      if (treeErrors.length > 0) {
        const pgnError: PgnError = {
          gameIndex: index,
          message: treeErrors.join('; '),
          fatal: false
        }
        game.error = pgnError
        errors.push(pgnError)
      }

      games.push(game)
    })

    return { games, errors }
  }

  flatten(gameId: string, game: ParsedGame): GameMoveRow[] {
    return game.root ? flattenMainLine(gameId, [game.root]) : []
  }
}

function populateStatistics(game: ParsedGame): void {
  const white = game.headers.get('White') ?? ''
  const black = game.headers.get('Black') ?? ''
  const player = game.headers.get('Player') ?? game.headers.get('Username') ?? game.headers.get('User') ?? ''
  const playerColor = game.headers.get('PlayerColor')?.toLowerCase()
  const normalizedPlayer = player.toLowerCase()

  if (playerColor === 'w' || playerColor === 'b') game.playerColor = playerColor
  else if (normalizedPlayer && white.toLowerCase() === normalizedPlayer) game.playerColor = 'w'
  else if (normalizedPlayer && black.toLowerCase() === normalizedPlayer) game.playerColor = 'b'
  else game.playerColor = null

  const playerElo = game.playerColor === 'w' ? game.headers.get('WhiteElo') : game.headers.get('BlackElo')
  const opponentElo = game.playerColor === 'w' ? game.headers.get('BlackElo') : game.headers.get('WhiteElo')
  game.playerRating = parseRating(playerElo)
  game.opponentRating = parseRating(opponentElo)
  game.opponent = game.playerColor === 'w' ? black || null : white || null
  game.outcome = outcomeFor(game.result, game.playerColor)
  game.timeClass = game.headers.get('TimeClass')?.toLowerCase() || timeClassFor(game.headers.get('TimeControl'))
  game.playedAt = parsePlayedAt(game.headers.get('UTCDate') ?? game.headers.get('Date'), game.headers.get('UTCTime'))
}

function parseRating(value: string | undefined): number | null {
  if (!value) return null
  const rating = Number.parseInt(value, 10)
  return Number.isFinite(rating) ? rating : null
}

function outcomeFor(result: ParsedGame['result'], color: string | null | undefined): string | null {
  if (result === '1/2-1/2') return 'draw'
  if (result !== '1-0' && result !== '0-1') return null
  if (color !== 'w' && color !== 'b') return null
  return (result === '1-0') === (color === 'w') ? 'win' : 'loss'
}

function timeClassFor(value: string | undefined): string | null {
  if (!value) return null
  if (value.includes('/')) {
    const dailySeconds = Number.parseInt(value.split('/')[1], 10)
    return dailySeconds >= 86400 ? 'daily' : null
  }
  const seconds = Number.parseInt(value.split(/[+:-]/)[0], 10)
  if (!Number.isFinite(seconds)) return null
  if (seconds < 180) return 'bullet'
  if (seconds < 600) return 'blitz'
  if (seconds < 1800) return 'rapid'
  return 'classical'
}

function parsePlayedAt(date: string | undefined, time: string | undefined): number | null {
  if (!date || !/^\d{4}[.-]\d{2}[.-]\d{2}$/.test(date)) return null
  const normalizedDate = date.replace(/\./g, '-')
  const normalizedTime = time && /^\d{2}:\d{2}:\d{2}$/.test(time) ? `T${time}Z` : 'T00:00:00Z'
  const timestamp = Date.parse(`${normalizedDate}${normalizedTime}`)
  return Number.isFinite(timestamp) ? timestamp : null
}
