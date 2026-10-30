export type AccuracyInput = {
  classification: string | null
  centipawnLoss: number | null
}

export type AccuracyResult = {
  accuracy: number
  totalMoves: number
  byClassification: Record<string, number>
}

/**
 * Map a single move's centipawn loss to an accuracy score (0-100).
 * Piecewise-linear approximation of the Lichess accuracy curve.
 * Lichess uses a non-linear table; this is a close, explainable approximation:
 *   cpl = 0   -> 100
 *   cpl <= 10 -> 100 - cpl*0.75
 *   cpl <= 30 -> 92.5 - (cpl-10)*0.6
 *   cpl <= 60 -> 80.5 - (cpl-30)*0.5
 *   cpl <= 100-> 65.5 - (cpl-60)*0.35
 *   else      -> 51.5 - (cpl-100)*0.2 (floored at 0)
 */
export function accuracyFromCentipawnLoss(cpl: number | null): number {
  if (cpl === null) return 75 // unknown move treated as average
  const c = Math.max(0, cpl)
  if (c <= 10) return 100 - c * 0.75
  if (c <= 30) return 92.5 - (c - 10) * 0.6
  if (c <= 60) return 80.5 - (c - 30) * 0.5
  if (c <= 100) return 65.5 - (c - 60) * 0.35
  return Math.max(0, 51.5 - (c - 100) * 0.2)
}

/**
 * Classification-based accuracy points (simpler, stable).
 */
const CLASSIFICATION_POINTS: Record<string, number> = {
  best: 100,
  excellent: 92,
  good: 82,
  inaccuracy: 65,
  mistake: 45,
  blunder: 20
}

export function accuracyFromClassification(classification: string | null): number {
  if (!classification) return 70
  return CLASSIFICATION_POINTS[classification] ?? 70
}

/**
 * Compute per-color accuracy as the mean of per-move accuracy scores.
 * Uses centipawn loss when available, falls back to classification points.
 */
export function computeAccuracy(inputs: AccuracyInput[]): number {
  if (inputs.length === 0) return 0
  let sum = 0
  for (const input of inputs) {
    const acc = input.centipawnLoss !== null
      ? accuracyFromCentipawnLoss(input.centipawnLoss)
      : accuracyFromClassification(input.classification)
    sum += acc
  }
  return Math.round((sum / inputs.length) * 10) / 10
}

export function computeAccuracyDetailed(inputs: AccuracyInput[]): AccuracyResult {
  const byClassification: Record<string, number> = {}
  const counts: Record<string, number> = {}
  for (const input of inputs) {
    const acc = input.centipawnLoss !== null
      ? accuracyFromCentipawnLoss(input.centipawnLoss)
      : accuracyFromClassification(input.classification)
    const cls = input.classification ?? 'unknown'
    byClassification[cls] = (byClassification[cls] ?? 0) + acc
    counts[cls] = (counts[cls] ?? 0) + 1
  }
  for (const cls of Object.keys(byClassification)) {
    byClassification[cls] = Math.round((byClassification[cls] / counts[cls]) * 10) / 10
  }
  return {
    accuracy: computeAccuracy(inputs),
    totalMoves: inputs.length,
    byClassification
  }
}
