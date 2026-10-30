import { type PgnHeaders } from './types'

const TAG_RE = /^\[([A-Za-z][A-Za-z0-9]*)\s+"((?:[^"\\]|\\.)*)"\]\s*$/

function unescapePGN(s: string): string {
  const out: string[] = []
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\' && i + 1 < s.length) {
      out.push(s[++i])
    } else {
      out.push(s[i])
    }
  }
  return out.join('')
}

export function parseHeaders(headerBlock: string): PgnHeaders {
  const map = new Map<string, string>()
  for (const line of headerBlock.split('\n')) {
    const trimmed = line.trim()
    if (trimmed.length === 0) continue
    const m = TAG_RE.exec(trimmed)
    if (m) {
      map.set(m[1], unescapePGN(m[2]))
    }
  }
  return map
}

export function extractHeaders(gameText: string): { headers: PgnHeaders; rest: string } {
  const lines = gameText.split('\n')
  const headerLines: string[] = []
  let movetextStart = 0
  let inHeaders = true

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim()
    if (inHeaders && trimmed.startsWith('[') && trimmed.endsWith(']')) {
      headerLines.push(lines[i])
      movetextStart = i + 1
    } else {
      inHeaders = false
      break
    }
  }

  const headers = parseHeaders(headerLines.join('\n'))
  const rest = lines.slice(movetextStart).join('\n')
  return { headers, rest }
}
