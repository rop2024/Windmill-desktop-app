import { OpeningDetector, type OpeningEntry } from './OpeningDetector'

export const DEFAULT_OPENINGS: OpeningEntry[] = [
  { eco: 'C00', name: "King's Pawn Opening", variation: null, moves: ['e4'] },
  { eco: 'C20', name: "King's Knight Opening", variation: null, moves: ['e4', 'e5', 'Nf3'] },
  { eco: 'C50', name: 'Giuoco Piano', variation: null, moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'] },
  { eco: 'C55', name: 'Two Knights Defense', variation: null, moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6'] },
  { eco: 'C65', name: 'Ruy Lopez', variation: null, moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'] },
  { eco: 'C78', name: 'Ruy Lopez Closed', variation: null, moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6', 'O-O', 'Be7'] },
  { eco: 'D20', name: "Queen's Gambit", variation: null, moves: ['d4', 'd5', 'c4'] },
  { eco: 'A00', name: 'Reti Opening', variation: null, moves: ['Nf3'] },
  { eco: 'B20', name: 'Sicilian Defense', variation: null, moves: ['e4', 'c5'] },
  { eco: 'A10', name: 'English Opening', variation: null, moves: ['c4'] }
]

export function createDefaultOpeningDetector(): OpeningDetector {
  const detector = new OpeningDetector()
  detector.load(DEFAULT_OPENINGS)
  return detector
}
