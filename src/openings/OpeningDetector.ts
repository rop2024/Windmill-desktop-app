export type OpeningEntry = {
  eco: string
  name: string
  variation: string | null
  moves: string[]
}

const NORMALIZE_ANNOTATION = /[+#?!]+$/

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
      let matchLen = 0
      for (let i = 0; i < entry.moves.length && i < normalized.length; i++) {
        if (normalizeSAN(entry.moves[i]) === normalized[i]) {
          matchLen++
        } else {
          break
        }
      }

      if (matchLen > 0 && (!best || matchLen > best.ply)) {
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
