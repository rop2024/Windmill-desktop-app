import { OpeningDetector, type OpeningEntry } from './OpeningDetector'

/**
 * Comprehensive ECO opening database.
 *
 * Entries are ordered from most specific (longest move sequence) to least
 * specific within each ECO family. The detector uses longest-prefix matching,
 * so specific variations take precedence over general opening lines.
 *
 * ECO class mapping:
 *   Axx = Flank / irregular / English / Reti / Dutch
 *   Bxx = Semi-open (1.e4, not 1...e5)
 *   Cxx = Open games (1.e4 e5)
 *   Dxx = Closed games (1.d4 d5)
 *   Exx = Indian systems
 */
export const DEFAULT_OPENINGS: OpeningEntry[] = [
  // =========================================================================
  // Cxx — Open games (1.e4 e5)
  // =========================================================================

  // Ruy Lopez (Spanish) — C60-C99 (specific lines first)
  { eco: 'C99', name: "Ruy Lopez", variation: 'Closed', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6', 'O-O', 'Be7', 'Re1', 'b5', 'Bb3', 'O-O', 'c3', 'd5', 'exd5', 'Nxd5', 'Nxe5'] },
  { eco: 'C89', name: "Ruy Lopez", variation: 'Marshall', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6', 'O-O', 'Be7', 'Re1', 'b5', 'Bb3', 'O-O', 'c3', 'd5', 'exd5', 'Nxd5', 'Nxe5', 'c4'] },
  { eco: 'C84', name: "Ruy Lopez", variation: 'Closed', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6', 'O-O', 'Be7', 'Re1', 'b5', 'Bb3', 'O-O', 'c3', 'Na5', 'c4', 'Nc6'] },
  { eco: 'C78', name: "Ruy Lopez", variation: 'Closed', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6', 'O-O', 'Be7', 'Re1', 'b5', 'Bb3', 'O-O', 'c3', 'd6'] },
  { eco: 'C76', name: "Ruy Lopez", variation: 'Closed', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6', 'O-O', 'Be7', 'Re1', 'b5', 'Bb3', 'O-O', 'c3', 'O-O'] },
  { eco: 'C74', name: "Ruy Lopez", variation: 'Closed', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6', 'O-O', 'Be7', 'Re1', 'b5', 'Bb3', 'O-O', 'c3', 'Be7'] },
  { eco: 'C70', name: "Ruy Lopez", variation: 'Classical', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6', 'O-O', 'Be7', 'Re1'] },
  { eco: 'C65', name: "Ruy Lopez", variation: 'Berlin', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'Nf6'] },
  { eco: 'C60', name: "Ruy Lopez", variation: null, moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'] },

  // Italian Game / Giuoco Piano / Two Knights — C50-C59
  { eco: 'C55', name: "Two Knights Defense", variation: null, moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6'] },
  { eco: 'C53', name: "Giuoco Piano", variation: null, moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5'] },
  { eco: 'C50', name: "Italian Game", variation: 'Giuoco Piano', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'] },

  // Scotch / Four Knights — C45-C49
  { eco: 'C49', name: "Four Knights Game", variation: null, moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'Nf6'] },
  { eco: 'C47', name: "Scotch Game", variation: 'Four Knights', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'Nf6'] },
  { eco: 'C45', name: "Scotch Game", variation: null, moves: ['e4', 'e5', 'Nf3', 'Nc6', 'd4'] },

  // Petroff / Russian / Philidor — C40-C44
  { eco: 'C44', name: "Russian Game", variation: null, moves: ['e4', 'e5', 'Nf3', 'Nf6', 'Nxe5', 'd6'] },
  { eco: 'C42', name: "Petroff Defense", variation: null, moves: ['e4', 'e5', 'Nf3', 'Nf6'] },
  { eco: 'C41', name: "Philidor Defense", variation: null, moves: ['e4', 'e5', 'Nf3', 'd6'] },
  { eco: 'C40', name: "King's Knight Game", variation: null, moves: ['e4', 'e5', 'Nf3', 'Nc6'] },

  // King's Knight Opening — C20-C29
  { eco: 'C20', name: "King's Knight Opening", variation: null, moves: ['e4', 'e5', 'Nf3'] },

  // General King's Pawn Game — C00
  { eco: 'C00', name: "King's Pawn Opening", variation: null, moves: ['e4', 'e5'] },

  // =========================================================================
  // Bxx — Semi-open (1.e4, not 1...e5)
  // =========================================================================

  // Sicilian Najdorf / Dragon / Richter-Rauzer — B50-B99
  { eco: 'B90', name: "Sicilian Defense", variation: 'Najdorf', moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6', 'Bg5'] },
  { eco: 'B70', name: "Sicilian Defense", variation: 'Dragon', moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'g6'] },
  { eco: 'B60', name: "Sicilian Defense", variation: 'Richter-Rauzer', moves: ['e4', 'c5', 'Nf3', 'Nc6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'd6', 'Bc4'] },
  { eco: 'B52', name: "Sicilian Defense", variation: 'Najdorf', moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6'] },
  { eco: 'B50', name: "Sicilian Defense", variation: 'Najdorf', moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6', 'Be2'] },

  // Sicilian Kan / Taimanov / Scheveningen — B40-B59
  { eco: 'B44', name: "Sicilian Defense", variation: 'Taimanov', moves: ['e4', 'c5', 'Nf3', 'e6', 'd4', 'cxd4', 'Nxd4', 'Nc6', 'Nc3'] },
  { eco: 'B40', name: "Sicilian Defense", variation: 'Kan', moves: ['e4', 'c5', 'Nf3', 'e6', 'd4', 'cxd4', 'Nxd4', 'a6'] },

  // Sicilian Rossolimo / Alapin / Closed — B20-B39
  { eco: 'B36', name: "Sicilian Defense", variation: 'Accelerated Dragon', moves: ['e4', 'c5', 'Nf3', 'Nc6', 'd4', 'cxd4', 'Nxd4', 'g6'] },
  { eco: 'B30', name: "Sicilian Defense", variation: 'Rossolimo', moves: ['e4', 'c5', 'Nf3', 'Nc6', 'Bb5'] },
  { eco: 'B23', name: "Sicilian Defense", variation: 'Closed', moves: ['e4', 'c5', 'Nc3', 'Nc6'] },
  { eco: 'B22', name: "Sicilian Defense", variation: 'Alapin', moves: ['e4', 'c5', 'c3'] },
  { eco: 'B20', name: "Sicilian Defense", variation: null, moves: ['e4', 'c5'] },

  // Pirc / Modern / Scandinavian / Alekhine — B00-B09
  { eco: 'B09', name: "Pirc Defense", variation: null, moves: ['e4', 'd6', 'd4', 'Nf6', 'Nc3', 'g6'] },
  { eco: 'B06', name: "Modern Defense", variation: null, moves: ['e4', 'g6'] },
  { eco: 'B02', name: "Alekhine's Defense", variation: null, moves: ['e4', 'Nf6'] },
  { eco: 'B01', name: "Scandinavian Defense", variation: null, moves: ['e4', 'd5'] },
  { eco: 'B00', name: "King's Pawn Game", variation: null, moves: ['e4'] },

  // =========================================================================
  // Dxx — Closed games (1.d4 d5)
  // =========================================================================

  // Grünfeld — D80-D99
  { eco: 'D97', name: "Grünfeld Defense", variation: null, moves: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'd5', 'cxd5', 'Nxd5', 'e4', 'Nxc3', 'bxc3', 'Bg7', 'Nf3', 'O-O', 'Rc1', 'c5'] },
  { eco: 'D90', name: "Grünfeld Defense", variation: 'Russian', moves: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'd5', 'cxd5', 'Nxd5', 'e4', 'Nxc3', 'bxc3', 'Bg7', 'Nf3', 'O-O', 'Rc1', 'c5', 'dxc5', 'Qa5+'] },
  { eco: 'D85', name: "Grünfeld Defense", variation: 'Exchange', moves: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'd5', 'cxd5', 'Nxd5', 'e4', 'Nxc3'] },
  { eco: 'D80', name: "Grünfeld Defense", variation: null, moves: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'd5', 'cxd5', 'Nxd5', 'e4'] },

  // Queen's Gambit Declined / Tarrasch / Orthodox — D20-D69
  { eco: 'D60', name: "Queen's Gambit Declined", variation: 'Orthodox', moves: ['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6', 'Bg5', 'Nbd7', 'e3', 'dxc4', 'Bxc4'] },
  { eco: 'D52', name: "Queen's Gambit Declined", variation: 'Orthodox', moves: ['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6', 'e3', 'Nbd7', 'Bd3', 'O-O'] },
  { eco: 'D50', name: "Queen's Gambit Declined", variation: 'Orthodox', moves: ['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6', 'e3', 'Nbd7', 'Bd3'] },
  { eco: 'D45', name: "Queen's Gambit Declined", variation: 'Tarrasch', moves: ['d4', 'd5', 'c4', 'e6', 'Nc3', 'c5', 'cxd5', 'exd5'] },
  { eco: 'D38', name: "Queen's Gambit Declined", variation: 'Orthodox', moves: ['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6', 'e3', 'Be7'] },
  { eco: 'D35', name: "Queen's Gambit Declined", variation: 'Orthodox', moves: ['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6', 'e3'] },
  { eco: 'D27', name: "Queen's Gambit Declined", variation: null, moves: ['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6', 'Bg5'] },
  { eco: 'D20', name: "Queen's Gambit", variation: null, moves: ['d4', 'd5', 'c4'] },

  // Queen's Pawn Game / Richter-Veresov — D00-D09
  { eco: 'D06', name: "Richter-Veresov Attack", variation: null, moves: ['d4', 'd5', 'Nc3', 'Nf6', 'Bg5', 'Bf5'] },
  { eco: 'D02', name: "Richter-Veresov Attack", variation: null, moves: ['d4', 'd5', 'Nc3', 'Nf6', 'Bg5'] },
  { eco: 'D00', name: "Queen's Pawn Opening", variation: null, moves: ['d4', 'd5'] },

  // =========================================================================
  // Exx — Indian systems
  // =========================================================================

  // King's Indian — E60-E99
  { eco: 'E99', name: "King's Indian Defense", variation: null, moves: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'Bg7', 'e4', 'd6', 'Nf3', 'O-O', 'Be2', 'e5', 'O-O', 'Nc6', 'd5', 'Ne7', 'b4'] },
  { eco: 'E90', name: "King's Indian Defense", variation: null, moves: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'Bg7', 'e4', 'd6', 'Nf3', 'O-O', 'Be2', 'e5', 'O-O', 'Nc6', 'd5', 'Ne7', 'b4', 'c5'] },
  { eco: 'E80', name: "King's Indian Defense", variation: null, moves: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'Bg7', 'e4', 'd6', 'Nf3', 'O-O', 'Be2', 'e5', 'O-O', 'Nc6'] },
  { eco: 'E75', name: "King's Indian Defense", variation: 'Classical', moves: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'Bg7', 'e4', 'd6', 'Nf3', 'O-O', 'Be2', 'e5'] },
  { eco: 'E70', name: "King's Indian Defense", variation: null, moves: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'Bg7', 'e4', 'd6', 'Nf3'] },
  { eco: 'E60', name: "King's Indian Defense", variation: null, moves: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'Bg7'] },

  // Bogo-Indian / Nimzo-Indian / Queen's Indian — E10-E59
  { eco: 'E62', name: "Bogo-Indian Defense", variation: null, moves: ['d4', 'Nf6', 'c4', 'e6', 'Nf3', 'Bb4+', 'Bd2'] },
  { eco: 'E50', name: "Nimzo-Indian Defense", variation: null, moves: ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4', 'a3'] },
  { eco: 'E40', name: "Nimzo-Indian Defense", variation: null, moves: ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4', 'f3'] },
  { eco: 'E30', name: "Nimzo-Indian Defense", variation: null, moves: ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4', 'e3'] },
  { eco: 'E24', name: "Nimzo-Indian Defense", variation: null, moves: ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4', 'Qc2'] },
  { eco: 'E20', name: "Nimzo-Indian Defense", variation: null, moves: ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4'] },
  { eco: 'E10', name: "Catalan Opening", variation: null, moves: ['d4', 'Nf6', 'c4', 'e6', 'Nf3'] },
  { eco: 'E01', name: "Catalan Opening", variation: null, moves: ['d4', 'Nf6', 'c4', 'e6', 'g3'] },
  { eco: 'E00', name: "Catalan Opening", variation: null, moves: ['d4', 'Nf6', 'c4', 'e6'] },

  // =========================================================================
  // Axx — Flank / irregular / English / Reti / Dutch
  // =========================================================================

  // Dutch — A80-A99
  { eco: 'A99', name: "Dutch Defense", variation: 'Leningrad', moves: ['d4', 'f5', 'c4', 'Nf6', 'g3', 'g6', 'Bg2', 'Bg7'] },
  { eco: 'A90', name: "Dutch Defense", variation: null, moves: ['d4', 'f5', 'g3'] },
  { eco: 'A80', name: "Dutch Defense", variation: null, moves: ['d4', 'f5'] },

  // English — A10-A39
  { eco: 'A32', name: "English Opening", variation: 'Symmetrical', moves: ['c4', 'c5', 'Nc3', 'Nc6'] },
  { eco: 'A30', name: "English Opening", variation: 'Symmetrical', moves: ['c4', 'c5'] },
  { eco: 'A22', name: "English Opening", variation: 'Four Knights', moves: ['c4', 'e5', 'Nc3', 'Nf6', 'Nf3', 'Nc6'] },
  { eco: 'A20', name: "English Opening", variation: null, moves: ['c4', 'e5'] },
  { eco: 'A10', name: "English Opening", variation: null, moves: ['c4'] },

  // Réti / King's Indian Attack — A40-A59
  { eco: 'A50', name: "Réti Opening", variation: "King's Indian Attack", moves: ['Nf3', 'd5', 'g3', 'Bg2'] },
  { eco: 'A46', name: "Réti Opening", variation: null, moves: ['Nf3', 'd5', 'g3'] },
  { eco: 'A40', name: "Réti Opening", variation: null, moves: ['Nf3', 'd5'] },

  // Irregular / uncommon — A00
  { eco: 'A00', name: "Irregular Opening", variation: null, moves: [] },
]

export function createDefaultOpeningDetector(): OpeningDetector {
  const detector = new OpeningDetector()
  detector.load(DEFAULT_OPENINGS)
  return detector
}
