# Weakness Engine — System Execution Report

## Summary

**Weakness Engine is not implemented in this codebase.**

There is no rolled-up player skill profile, no star-rated weakness categories (Opening, Endgame, King Safety, Time Pressure, Calculation), and no aggregation of signal from Tactical Detector or Stockfish Analyzer over time. The codebase analyzes individual games and positions, but nothing synthesizes those signals into a player-level weakness profile.

This report documents:
1. What the Weakness Engine system should do (per the specification).
2. What analysis infrastructure actually exists today that could feed it.
3. What is missing and would need to be built.

---

## 1. Weakness Engine Specification

| Capability | Purpose |
|---|---|
| Player skill profile | Rolled-up analysis of *the player*, not individual games |
| Star-rated weakness categories | Rate each weakness category (Opening, Endgame, King Safety, Time Pressure, Calculation) by severity |
| Aggregates Tactical Detector signal | Uses tactic tallies (missed forks, pins, blunders) to infer calculation/tactical weaknesses |
| Aggregates Stockfish Analyzer signal | Uses classification (mistakes/blunders), accuracy scores, and eval drops to infer skill gaps |
| Time-based aggregation | Rolls up signal across games over time to show improvement/decline |

### Categories (specified)

| Category | Signal sources |
|---|---|
| Opening | Opening accuracy, early-game blunders, opening win % |
| Endgame | Late-game accuracy, endgame mistakes, conversion rate |
| King Safety | King attacks, unsafe castling, king exposure blunders |
| Time Pressure | Mistakes/blunders in time trouble, accuracy drop vs time remaining |
| Calculation | Missed tactics (forks, pins, etc.), evaluation drops on own moves |

### Expected execution flow

```
All games + analysis (chess.db)  ──►  per-game signals (classification, accuracy, tactics)
                                                           │
                                                           ▼
                                                    Aggregate by category per game
                                                           │
                                                           ▼
                                                    Roll up across all games over time
                                                           │
                                                           ▼
                                                    Star rating per category
                                                    Output: player weakness profile
```

---

## 2. What Exists in the System Today

### A. Move Quality Classification — IMPLEMENTED (partial signal)
- **File:** `src/shared/classifyMove.ts`
- **Purpose:** Classifies each move as `best` / `excellent` / `good` / `inaccuracy` / `mistake` / `blunder`
- **Limitation:** Per-move, per-game only. No player-level rollup, no category mapping (e.g., "this blunder = king safety weakness").

### B. Per-Game Analysis — IMPLEMENTED (partial signal)
- **Files:** `src/main/services/stockfish/AnalysisQueue.ts`, `AnalysisRepository.ts`, `EngineService.ts`, `EngineProcess.ts`
- **Purpose:** Stockfish analysis of every ply, stored in `engine_analysis` (score_cp, score_mate, bestmove, pv, depth, centipawn_loss, classification)
- **IPC:** `analysis.startGame`, `analysis.getForGame`
- **Limitation:** Per-game data only. No cross-game aggregation, no player profile, no weakness categories.

### C. Accuracy Computation — IMPLEMENTED (partial signal)
- **File:** `src/main/services/analysis/calculateAccuracy.ts`
- **Purpose:** `computeAccuracy()` — per-color accuracy score (0–100) from centipawn loss or classification points
- **Limitation:** Per-game only. No accuracy-over-time tracking, no accuracy-by-category.

### D. Statistics Aggregation — IMPLEMENTED (partial signal)
- **File:** `src/main/services/statistics/StatisticsService.ts`
- **Purpose:** `overview()`, `ratingHistory()`, `streaks()`, `openings()`, `opponents()`, `timeControls()`, `calendar()`
- **Limitation:** Win rates, ratings, streaks, openings — none of these map to the five weakness categories (Opening, Endgame, King Safety, Time Pressure, Calculation).

### E. Game Data — IMPLEMENTED (raw material)
- **File:** `src/shared/game.ts` — `Game` type with `playedAt`, `timeClass`, `result`, `outcome`, `playerColor`, `playerRating`, `opponentRating`
- **Limitation:** No time-pressure tracking (no time-remaining-per-move data), no king-safety tracking, no endgame detection.

---

## 3. What Is Missing

The following capabilities from the specification are **not implemented**:

| Capability | Status | Notes |
|---|---|---|
| Player skill profile | ❌ Missing | No player-level aggregation; everything is per-game |
| Star-rated weakness categories | ❌ Missing | No 1–5 star ratings for Opening, Endgame, King Safety, Time Pressure, Calculation |
| Aggregation from Tactical Detector | ❌ Missing | Tactical Detector itself is not implemented |
| Aggregation from Stockfish Analyzer | ⚠️ Partial | Per-game analysis exists but is never rolled up into player-level weakness categories |
| Opening weakness | ❌ Missing | No opening-specific accuracy or weakness scoring |
| Endgame weakness | ❌ Missing | No endgame phase detection or analysis |
| King Safety weakness | ❌ Missing | No king safety evaluation or tracking |
| Time Pressure weakness | ❌ Missing | No time-remaining data; no time-trouble mistake detection |
| Calculation weakness | ❌ Missing | No tactic-miss tally (Tactical Detector not implemented) |
| Dedicated Weakness Engine page/route | ❌ Missing | No route, no component, no shell integration |
| Time-based rollup (improvement/decline) | ❌ Missing | No historical trend analysis of weakness categories |

---

## 4. Where the Pieces Would Live (if built)

If Weakness Engine were implemented, the natural integration points are:

- **Route:** `/weaknesses` or `/profile` nested inside `AppLayout` (like Statistics, Games, Sync)
- **Weakness engine service:** New service, e.g. `src/main/services/analysis/WeaknessEngine.ts` — queries `engine_analysis`, `game_moves`, and (future) `game_tactics` tables, aggregates by category, computes star ratings
- **Category detection logic:**
  - **Opening:** Accuracy/mistakes in first N plies, opening win %
  - **Endgame:** Accuracy/mistakes in late-game plies (low piece count), conversion rate
  - **King Safety:** King-adjacent blunders, unsafe castling, king exposure errors (requires king-safety eval heuristics)
  - **Time Pressure:** Mistakes/accuracy drop when time remaining is low (requires `time_remaining` per move — not currently stored)
  - **Calculation:** Missed tactics from Tactical Detector (not implemented), eval drops on own moves
- **Star rating:** 1–5 stars per category based on percentile or threshold bands (e.g., 1★ = critical weakness, 5★ = strength)
- **Storage:** New table `player_weaknesses(category, star_rating, signal_strength, games_analyzed, last_updated)` or computed on demand
- **IPC channel:** `weakness.profile` in `src/main/ipc/index.ts`
- **Renderer API:** `window.api.weakness.getProfile()` in `src/preload/index.ts`
- **UI:** Windmill-styled page with `// weakness engine` technical label, 5 star-rated category cards, trend over time, contribution breakdown (which games/signals drove each rating)

---

## 5. Execution Verdict

**Weakness Engine does not execute in this system.** The only adjacent operations that run are:

1. `classifyMove(before, after)` — per-move quality classification (best/mistake/blunder), not rolled up
2. `AnalysisQueue.analyzeGame()` — per-game Stockfish analysis, stored per-ply in `engine_analysis`
3. `computeAccuracy()` — per-game accuracy score, not aggregated across games
4. `StatisticsService.*()` — per-game statistics (ratings, streaks, openings), not mapped to weakness categories

Nothing aggregates signal from Tactical Detector (not implemented) or Stockfish Analyzer into player-level weakness categories. No star-rated weakness profile exists. No output like "Opening: ★★☆☆☆ (weak)" or "Calculation: ★★★★☆ (strong)" is possible.
