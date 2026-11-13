export type OpeningEntry = {
  eco: string
  name: string
  variation: string | null
  moves: string[]
}

const NORMALIZE_ANNOTATION = /[+#?!]+$/

// Minimum number of plies that must match before an opening is reported.
// Single-move matches are too broad to be meaningful (e.g. just "1.e4" could
// be anything), so they are ignored.
const MIN_MATCH_PLY = 2

function normalizeSAN(san: string): string {
  return san.replace(NORMALIZE_ANNOTATION, '').trim()
}

export class OpeningDetector {
  private openings: OpeningEntry[] = []

  load(entries: OpeningEntry[]): void {
    this.openings = entries
  }

  loadFromTsv(tsv: string): void {
    const lines = tsv.split(/\r?\n/).filter((l) => l.trim().length > 0)
    const entries: OpeningEntry[] = []
    for (const line of lines) {
      const [eco, name, variation, moves] = line.split('\t')
      if (!eco || !name || !moves) continue
      entries.push({
        eco,
        name,
        variation: variation ?? null,
        moves: moves.split(/\s+/).filter(Boolean)
      })
    }
    this.openings = entries
  }

  detect(mainLineSan: string[]): { eco: string; name: string; variation: string | null; ply: number } | null {
    const normalized = mainLineSan.map(normalizeSAN)
    let best: { eco: string; name: string; variation: string | null; ply: number } | null = null

    for (const entry of this.openings) {
      // Only count an entry when the game actually played every move of it.
      // A partial prefix (e.g. "e4 e5 Nf3" matching C60 which needs Bb5 later)
      // must not masquerade as that opening.
      let matchLen = 0
      for (let i = 0; i < entry.moves.length && i < normalized.length; i++) {
        if (normalizeSAN(entry.moves[i]) === normalized[i]) {
          matchLen++
        } else {
          break
        }
      }

      const fullyPlayed = matchLen === entry.moves.length && matchLen > 0

      // Require a minimum match length so one-move matches can't produce a
      // misleading classification, and always prefer the longest (most
      // specific) fully-played opening.
      if (fullyPlayed && matchLen >= MIN_MATCH_PLY && (!best || matchLen > best.ply)) {
        best = {
          eco: entry.eco,
          name: entry.name,
          variation: entry.variation,
          ply: matchLen
        }
      }
    }

    return best
  }
}
