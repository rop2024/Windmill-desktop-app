export type MoveClassification =
  | 'best'
  | 'excellent'
  | 'good'
  | 'inaccuracy'
  | 'mistake'
  | 'blunder'

export type ClassificationThresholds = {
  best: number
  excellent: number
  good: number
  inaccuracy: number
  mistake: number
}

export const DEFAULT_THRESHOLDS: ClassificationThresholds = {
  best: 0,
  excellent: 2,
  good: 5,
  inaccuracy: 10,
  mistake: 20
}

export type ClassificationResult = {
  classification: MoveClassification | null
  centipawnLoss: number | null
  winProbabilityBefore: number | null
  winProbabilityAfter: number | null
  winProbabilityDrop: number | null
}

export function centipawnToWinProbability(cp: number): number {
  const k = 0.00368208
  const x = 2 / (1 + Math.exp(-k * cp))
  return 50 * x
}

export function mateToWinProbability(mate: number): number {
  const large = 1000
  return mate > 0 ? 50 + large : 50 - large
}

export function scoreToWinProbability(score: { type: 'cp' | 'mate'; value: number } | null): number | null {
  if (!score) return null
  if (score.type === 'cp') return centipawnToWinProbability(score.value)
  return mateToWinProbability(score.value)
}

export function classifyMove(
  before: { type: 'cp' | 'mate'; value: number } | null,
  after: { type: 'cp' | 'mate'; value: number } | null,
  thresholds: ClassificationThresholds = DEFAULT_THRESHOLDS
): ClassificationResult {
  if (!before || !after) {
    return { classification: null, centipawnLoss: null, winProbabilityBefore: null, winProbabilityAfter: null, winProbabilityDrop: null }
  }

  const wpBefore = scoreToWinProbability(before)
  const wpAfter = scoreToWinProbability(after)

  let centipawnLoss: number | null = null
  let winProbabilityDrop: number | null = null

  if (before.type === 'cp' && after.type === 'cp') {
    centipawnLoss = Math.max(0, before.value - after.value)
    winProbabilityDrop = wpBefore !== null && wpAfter !== null ? Math.max(0, wpBefore - wpAfter) : null
  } else {
    centipawnLoss = null
    winProbabilityDrop = wpBefore !== null && wpAfter !== null ? Math.max(0, wpBefore - wpAfter) : null
  }

  let classification: MoveClassification | null = null
  if (centipawnLoss !== null) {
    if (centipawnLoss <= thresholds.best) classification = 'best'
    else if (centipawnLoss < thresholds.excellent) classification = 'excellent'
    else if (centipawnLoss < thresholds.good) classification = 'good'
    else if (centipawnLoss < thresholds.inaccuracy) classification = 'inaccuracy'
    else if (centipawnLoss < thresholds.mistake) classification = 'mistake'
    else classification = 'blunder'
  } else if (winProbabilityDrop !== null) {
    if (winProbabilityDrop <= 0) classification = 'best'
    else if (winProbabilityDrop < 2) classification = 'excellent'
    else if (winProbabilityDrop < 5) classification = 'good'
    else if (winProbabilityDrop < 10) classification = 'inaccuracy'
    else if (winProbabilityDrop < 20) classification = 'mistake'
    else classification = 'blunder'
  }

  return { classification, centipawnLoss, winProbabilityBefore: wpBefore, winProbabilityAfter: wpAfter, winProbabilityDrop }
}

export function classificationLabel(c: MoveClassification | null): string {
  switch (c) {
    case 'best': return 'Best'
    case 'excellent': return 'Excellent'
    case 'good': return 'Good'
    case 'inaccuracy': return 'Inaccuracy'
    case 'mistake': return 'Mistake'
    case 'blunder': return 'Blunder'
    default: return '—'
  }
}

export function classificationColor(c: MoveClassification | null): string {
  switch (c) {
    case 'best': return '#10b981'
    case 'excellent': return '#34d399'
    case 'good': return '#60a5fa'
    case 'inaccuracy': return '#fbbf24'
    case 'mistake': return '#f97316'
    case 'blunder': return '#ef4444'
    default: return '#94a3b8'
  }
}

export function classificationIcon(c: MoveClassification | null): string {
  switch (c) {
    case 'best': return '✓'
    case 'excellent': return '!'
    case 'good': return ''
    case 'inaccuracy': return '?!'
    case 'mistake': return '?'
    case 'blunder': return '??'
    default: return ''
  }
}
