# Puzzle Generator — System Execution Report

## Summary

**Puzzle Generator is not implemented in this codebase.**

There is no pipeline that mines games for training material. The codebase has no puzzle database, no position extraction, no difficulty rating, and no solution generation. Games are stored in `chess.db` but nothing turns them into puzzles.

This report documents:
1. What the Puzzle Generator system should do (per the specification).
2. What analysis infrastructure actually exists today that could feed it.
3. What is missing and would need to be built.

---

## 1. Puzzle Generator Specification

| Capability | Purpose |
|---|---|
| Pipeline: Game → Interesting Position → Save Position → Solution → Difficulty Rating → Puzzle Database | End-to-end puzzle creation from user's own games |
| Interesting position detection | Identify positions with tactical motifs, blunders, sharp eval swings |
| Save position | Store FEN + context (game, ply, players, result) |
| Solution generation | Stockfish-computed best move + principal variation |
| Difficulty rating | Assign rating based on eval swing, tactic type, ply depth |
| Puzzle database | Persist puzzles for later consumption by Puzzle Trainer |

### Expected execution flow

```
Your games (chess.db)  ──►  scan positions for interesting moments
                                                        │
                                                        ▼
                                    Extract FEN + solution (Stockfish)
                                                        │
                                                        ▼
                                    Rate difficulty (eval swing, tactic type, ply)
                                                        │
                                                        ▼
                                    Save to Puzzle Database
```

---

## 2. What Exists in the System Today

### A. Game Storage — IMPLEMENTED (raw material)
- **File:** `src/main/services/database/connection.ts`, `GameRepository.ts`
- **Purpose:** `chess.db` with `games` table (PGN, result, players, time class, played at)
- **Limitation:** Games are stored but never scanned for puzzle-worthy positions.

### B. Per-Move FEN — IMPLEMENTED (partial data)
- **File:** `src/main/services/database/migrations/` — `game_moves` table (ply, san, fen_before, fen_after)
- **Purpose:** Every move has FEN before/after, enabling position extraction
- **Limitation:** No logic identifies which positions are "interesting" or puzzle-worthy.

### C. Stockfish Analysis — IMPLEMENTED (partial solver)
- **Files:** `src/main/services/stockfish/EngineProcess.ts`, `EngineService.ts`, `AnalysisQueue.ts`
- **Purpose:** Stockfish computes best move, eval, PV per position
- **Limitation:** Analysis is per-game for quality classification; no puzzle-specific extraction (tactical motifs, sharp swings).

### D. Move Quality Classification — IMPLEMENTED (partial signal)
- **File:** `src/shared/classifyMove.ts`
- **Purpose:** Classifies moves as blunder/mistake/inaccuracy — could flag puzzle-worthy positions
- **Limitation:** Classification is stored but never used to generate puzzles.

---

## 3. What Is Missing

The following capabilities from the specification are **not implemented**:

| Capability | Status | Notes |
|---|---|---|
| Interesting position detection | ❌ Missing | No code scans positions for tactical motifs or eval swings |
| Position extraction | ❌ Missing | No FEN + context extraction for puzzle creation |
| Solution generation | ❌ Missing | No Stockfish call specifically to generate puzzle solution + PV |
| Difficulty rating | ❌ Missing | No difficulty algorithm (eval swing, tactic type, ply depth) |
| Puzzle database | ❌ Missing | No `puzzles` table; no puzzle storage |
| End-to-end pipeline | ❌ Missing | No Game → Position → Solution → Rating → DB flow |

---

## 4. Where the Pieces Would Live (if built)

If Puzzle Generator were implemented, the natural integration points are:

- **Service:** `src/main/services/puzzle/PuzzleGenerator.ts` — scans games, extracts positions, calls Stockfish, rates difficulty, saves puzzles
- **Database table:** `puzzles(id, game_id, ply, fen_before, fen_after, solution_san, solution_pv, difficulty, tactic_type, created_at)`
- **Interesting position detection:** Heuristics on `engine_analysis` (blunder/mistake classifications, eval swings) + tactical motifs (from future Tactical Detector)
- **Difficulty rating:** Based on centipawn loss, tactic complexity, ply number, whether the correct move was found in analysis
- **IPC channel:** `puzzle.generate` / `puzzle.list` / `puzzle.get` in `src/main/ipc/index.ts`
- **Renderer API:** `window.api.puzzle.{generate, list, get}` in `src/preload/index.ts`

---

## 5. Execution Verdict

**Puzzle Generator does not execute in this system.** The only adjacent operations that run are:

1. Games stored in `chess.db` with per-move FEN (`game_moves` table)
2. Stockfish analysis per game (`engine_analysis` table with classifications)
3. Move quality classification (blunder/mistake/inaccuracy)

Nothing scans positions for puzzle-worthy moments. Nothing generates solutions. Nothing rates difficulty. No puzzle database exists. The pipeline Game → Interesting Position → Save Position → Solution → Difficulty Rating → Puzzle Database does not run.
