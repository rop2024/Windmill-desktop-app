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
