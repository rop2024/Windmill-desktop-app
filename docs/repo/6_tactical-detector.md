# Tactical Detector — System Execution Report

## Summary

**Tactical Detector is not implemented in this codebase.**

There is no automated tactic recognition system. The codebase has move quality classification (best/excellent/good/inaccuracy/mistake/blunder based on centipawn loss) and engine analysis (eval scores, best moves), but nothing that detects specific tactical motifs like forks, pins, skewers, hanging pieces, double attacks, clearance, deflection, or discovered attacks. There is no output like "Player missed 14 forks, created 21 forks, defended 8 forks."

This report documents:
1. What the Tactical Detector system should do (per the specification).
2. What analysis infrastructure actually exists today that could be reused.
3. What is missing and would need to be built.

---

## 1. Tactical Detector Specification

| Capability | Purpose |
|---|---|
| Fork detection | Identify when a single piece attacks two+ enemy pieces simultaneously |
| Pin detection | Identify when a piece cannot move without exposing a more valuable piece behind it |
| Skewer detection | Identify when a high-value piece is attacked and moving it exposes a lower-value piece |
| Hanging piece detection | Identify pieces left en prise (attacked and undefended) |
| Double attack detection | Identify when one move creates two threats simultaneously |
| Clearance detection | Identify moves that clear a line/square for another piece |
| Deflection detection | Identify moves that lure a defending piece away from its duty |
| Discovered attack detection | Identify when moving one piece reveals an attack by another |
| Per-player tally | Count tactics created, missed, and defended per player per game |
| Output example | "Player missed 14 forks, created 21 forks, defended 8 forks" |

### Expected execution flow

```
All games (chess.db)  ──►  every move of every game
                                                        │
                                                        ▼
                                    Reconstruct board state before/after each move
                                                        │
                                                        ▼
                                    Tactical pattern detection (fork, pin, skewer, etc.)
                                                        │
                                                        ▼
                                    Tally: created / missed / defended per tactic type
                                                        │
                                                        ▼
                                    Per-player aggregate report
```

---

## 2. What Exists in the System Today

### A. Move Quality Classification — IMPLEMENTED (related, but not tactical detection)
- **File:** `src/shared/classifyMove.ts`
- **Purpose:** Classifies each move as `best` / `excellent` / `good` / `inaccuracy` / `mistake` / `blunder`
- **Logic:** Based on centipawn loss (CPL) between the position before and after the move, using win probability drop thresholds (best ≤ 0cp, excellent < 2cp, good < 5cp, inaccuracy < 10cp, mistake < 20cp, else blunder)
- **Helpers:** `classificationLabel()`, `classificationColor()`, `classificationIcon()` (`✓`, `!`, ``, `?!`, `?`, `??`)
- **Limitation:** This is eval-based quality, not tactical motif detection. It cannot distinguish a fork from a pin, or detect that a piece is hanging.

### B. Engine Analysis Pipeline — IMPLEMENTED (provides raw data, not tactics)
- **Files:** `src/main/services/stockfish/EngineProcess.ts`, `EngineService.ts`, `AnalysisQueue.ts`, `AnalysisCache.ts`
- **Purpose:** Runs Stockfish on every position of a game, stores `score_cp`, `score_mate`, `bestmove`, `pv`, `depth`, `centipawn_loss`, `classification` per ply in `engine_analysis` table
- **Migration:** `003_engine_analysis.sql` — `engine_analysis(id, game_id, ply, fen, engine_version, settings_hash, score_cp, score_mate, bestmove, pv, depth, analyzed_at)`
- **IPC:** `analysis.startGame`, `analysis.cancel`, `analysis.getForGame`, `analysis.position`
- **Limitation:** Provides eval scores and best moves, but no tactical pattern recognition

### C. Game Moves Table — IMPLEMENTED (provides board states)
- **File:** `src/main/services/database/migrations/` — `game_moves` table (ply, san, fen_before, fen_after)
- **Purpose:** Stores every move of every game with FEN before/after, enabling board state reconstruction
- **Limitation:** Just data storage; no tactical analysis on top

### D. ChessBoard Component — IMPLEMENTED (visualization only)
- **File:** `src/renderer/components/ChessBoard.tsx`
- **Purpose:** Renders chess positions, highlights selected squares, shows engine arrows
- **Limitation:** No tactical overlay (no highlighting of pinned pieces, hanging pieces, fork targets, etc.)

---

## 3. What Is Missing

The following capabilities from the specification are **not implemented**:

| Capability | Status | Notes |
|---|---|---|
| Fork detection | ❌ Missing | No code identifies two+ pieces attacked by one piece |
| Pin detection | ❌ Missing | No code identifies immobilized pieces |
| Skewer detection | ❌ Missing | No code identifies high-value piece attacked, exposing lower-value piece |
| Hanging piece detection | ❌ Missing | No code identifies en prise pieces |
| Double attack detection | ❌ Missing | No code identifies double threats from one move |
| Clearance detection | ❌ Missing | No code identifies line/square clearing moves |
| Deflection detection | ❌ Missing | No code identifies luring of defending pieces |
| Discovered attack detection | ❌ Missing | No code identifies revealed attacks |
| Per-player tally (created/missed/defended) | ❌ Missing | No aggregation of tactics by player and outcome |
| Dedicated Tactical Detector page/route | ❌ Missing | No route, no component, no shell integration |
| Output summary (e.g., "missed 14 forks...") | ❌ Missing | No tactical summary report exists |

---

## 4. Where the Pieces Would Live (if built)

If Tactical Detector were implemented, the natural integration points are:

- **Route:** `/tactics` or `/tactics/:gameId` nested inside `AppLayout` (like Statistics, Games, Sync)
- **Tactical engine:** New service, e.g. `src/main/services/analysis/TacticalDetector.ts` — takes FEN before/after each move, uses `chess.js` for move generation and attack detection to identify tactical motifs
- **Detection logic per motif:**
  - **Fork:** A piece attacks ≥2 enemy pieces of equal/higher value after the move
  - **Pin:** A line piece attacks a piece that cannot move without exposing a more valuable piece behind it to attack
  - **Skewer:** A line piece attacks a high-value piece that must move, exposing a lower-value piece behind it
  - **Hanging piece:** A piece is attacked by an enemy piece and not defended by any friendly piece (or defended insufficiently)
  - **Double attack:** One move creates two simultaneous threats (e.g., attack + check, attack + fork)
  - **Clearance:** Moving a piece opens a square/line for another friendly piece
  - **Deflection:** A move forces a defending piece away from protecting another piece/square
  - **Discovered attack:** Moving a piece reveals an attack by another friendly piece on an enemy piece
- **Data source:** `game_moves` table (fen_before/fen_after per ply) + `engine_analysis` table (to correlate tactical moments with eval drops)
- **IPC channel:** `tactics.analyze` / `tactics.getForGame` in `src/main/ipc/index.ts`
- **Renderer API:** `window.api.tactics.{analyze, getForGame}` in `src/preload/index.ts`
- **Storage:** New table `game_tactics(game_id, ply, tactic_type, tactic_subtype, created_by, missed_by, fen, san)` or extend `engine_analysis`
- **UI:** Windmill-styled page with `// tactics` technical label, tactic breakdown by type, created/missed/defended tallies, per-game drill-down

---

## 5. Execution Verdict

**Tactical Detector does not execute in this system.** The only adjacent operations that run are:

1. `classifyMove(before, after)` — move quality classification (best/excellent/good/inaccuracy/mistake/blunder) based on centipawn loss, NOT tactical motif detection
2. `engineService.analyzePosition(fen)` — Stockfish eval per position (scores, best moves, PV)
3. `AnalysisQueue.analyzeGame()` — per-game analysis pipeline storing eval + classification per ply

Nothing detects forks, pins, skewers, hanging pieces, double attacks, clearance, deflection, or discovered attacks. Nothing tallies "created / missed / defended" per tactic type. Nothing produces output like "Player missed 14 forks, created 21 forks, defended 8 forks."
