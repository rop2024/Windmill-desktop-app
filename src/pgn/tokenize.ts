export type PgnToken =
  | { type: 'moveNumber'; value: string; moveNum: number; isBlack: boolean }
  | { type: 'san'; value: string }
  | { type: 'comment'; value: string }
  | { type: 'lineComment'; value: string }
  | { type: 'nag'; value: string }
  | { type: 'lparen'; value: '(' }
  | { type: 'rparen'; value: ')' }
  | { type: 'result'; value: string }

const RESULT_RE = /^(1-0|0-1|1\/2-1\/2|\*)\b/
const MOVE_NUM_RE = /^(\d+)(\.{1,3})/
const NAG_RE = /^\$(\d+)|^([!?]{1,2})/
const STRUCTURAL = /[\s(){;]/

function scanUntilStructural(text: string, start: number): number {
  let i = start
  while (i < text.length) {
    const ch = text[i]
    if (STRUCTURAL.test(ch)) break
    i++
  }
  return i
}

export function tokenize(movetext: string): PgnToken[] {
  const tokens: PgnToken[] = []
  let i = 0
  const n = movetext.length

  while (i < n) {
    const ch = movetext[i]

    if (/\s/.test(ch)) {
      i++
      continue
    }

    const tail = movetext.slice(i)

    const resultM = RESULT_RE.exec(tail)
    if (resultM) {
      tokens.push({ type: 'result', value: resultM[1] })
      i += resultM[1].length
      continue
    }

    if (ch === '{') {
      let depth = 1
      let j = i + 1
      while (j < n && depth > 0) {
        if (movetext[j] === '{') depth++
        else if (movetext[j] === '}') depth--
        j++
      }
      const content = movetext.slice(i + 1, depth === 0 ? j - 1 : j)
      tokens.push({ type: 'comment', value: content })
      i = j
      continue
    }

    if (ch === ';') {
      let j = i + 1
      while (j < n && movetext[j] !== '\n' && movetext[j] !== '\r') j++
      tokens.push({ type: 'lineComment', value: movetext.slice(i + 1, j).trim() })
      i = j
      continue
    }

    if (ch === '(') {
      tokens.push({ type: 'lparen', value: '(' })
      i++
      continue
    }

    if (ch === ')') {
      tokens.push({ type: 'rparen', value: ')' })
      i++
      continue
    }

    const moveNumM = MOVE_NUM_RE.exec(tail)
    if (moveNumM) {
      const moveNum = Number(moveNumM[1])
      const suffix = moveNumM[2]
      const isBlack = suffix === '...'
      tokens.push({ type: 'moveNumber', value: moveNumM[0], moveNum, isBlack })
      i += moveNumM[0].length
      continue
    }

    const nagM = NAG_RE.exec(tail)
    if (nagM) {
      tokens.push({ type: 'nag', value: nagM[0] })
      i += nagM[0].length
      continue
    }

    const j = scanUntilStructural(movetext, i)
    if (j === i) {
      i++
      continue
    }
    tokens.push({ type: 'san', value: movetext.slice(i, j) })
    i = j
  }

  return tokens
}
