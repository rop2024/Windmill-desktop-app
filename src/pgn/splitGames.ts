export function splitGames(text: string): string[] {
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1)
  }
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  const lines = text.split('\n')
  const games: string[] = []
  const current: string[] = []
  let inMovetext = false
  let seenContent = false

  const flush = () => {
    const game = current.join('\n').trim()
    if (game.length > 0) {
      games.push(game)
    }
    current.length = 0
    inMovetext = false
    seenContent = false
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.length === 0) {
      if (inMovetext && seenContent) {
        flush()
      }
      continue
    }

    const isHeader = trimmed.startsWith('[') && trimmed.endsWith(']')

    if (isHeader) {
      if (inMovetext && seenContent) {
        flush()
      }
      current.push(line)
      seenContent = true
    } else {
      inMovetext = true
      current.push(line)
      seenContent = true
    }
  }

  flush()
  return games
}
