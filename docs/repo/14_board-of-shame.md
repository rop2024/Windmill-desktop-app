# Board of Shame — System Execution Report

## Summary

**Board of Shame is not implemented in this codebase.**

There is no fun/humbling counterpart to Board of Fame. The codebase has no worst-blunders list, no largest-throws detection (winning → losing), no fastest-loss tracking, no biggest-missed-mate identification, and no worst-time-trouble flagging. Games are stored in `chess.db` but nothing surfaces the worst performances.

This report documents:
1. What the Board of Shame system should do (per the specification).
2. What analysis infrastructure actually exists today that could feed it.
3. What is missing and would need to be built.

---

## 1. Board of Shame Specification

| Capability | Purpose |
|---|---|
| Worst blunders | Surface highest-centipawn-loss blunders |
| Largest throws | Detect winning position → loss (eval swing) |
| Fastest loss | Shortest game by move count or time |
| Biggest missed mate | Identify missed checkmate in N moves |
| Worst time trouble | Identify games with severe time-pressure collapses |

### Expected execution flow

```
All games + analysis (chess.db)  ──►  Board of Shame
                                                        │
                                                        ▼
                                    Rank by blunder size / throw magnitude
                                                        │
                                                        ▼
                                    Identify fastest losses / missed mates
                                                        │
                                                        ▼
                                    Display shame reel
```

---

## 2. What Exists in the System Today

### A. Game Storage — IMPLEMENTED (raw material)
- **File:** `src/main/services/database/connection.ts`, `GameRepository.ts`
- **Purpose:** `chess.db` with games, results, players, ratings, PGN, createdAt/updatedAt
- **Limitation:** Games stored but never ranked by "worst" criteria.

### B. Move Quality Classification — IMPLEMENTED (partial signal)
- **File:** `src/shared/classifyMove.ts`
- **Purpose:** Classifies moves as best/excellent/good/inaccuracy/mistake/blunder with centipawn loss
- **Limitation:** Per-move only; no "worst blunders" aggregation across games.

### C. Per-Game Analysis — IMPLEMENTED (partial signal)
- **Files:** `src/main/services/stockfish/AnalysisQueue.ts`, `AnalysisRepository.ts`
- **Purpose:** Per-ply eval, classification, centipawn_loss
- **Limitation:** Stored per-game; no throw detection (winning → losing), no missed-mate detection.

### D. Move Count / Timing — PARTIAL (raw fields exist)
- **File:** `src/shared/game.ts` — `createdAt`, `updatedAt`, `timeClass`
- **Limitation:** No per-move time tracking; no fastest-loss calculation; no time-trouble analysis.

---

## 3. What Is Missing

The following capabilities from the specification are **not implemented**:

| Capability | Status | Notes |
|---|---|---|
| Worst blunders | ❌ Missing | No centipawn-loss ranking across games |
| Largest throws | ❌ Missing | No eval-swing throw detection (winning → loss) |
| Fastest loss | ❌ Missing | No shortest-game tracking |
| Biggest missed mate | ❌ Missing | No missed-mate-in-N detection |
| Worst time trouble | ❌ Missing | No time-pressure collapse detection |
| Board of Shame UI | ❌ Missing | No shame reel page |
| Throw detection logic | ❌ Missing | No algorithm to detect winning→losing eval swings |

---

## 4. Where the Pieces Would Live (if built)

If Board of Shame were implemented, the natural integration points are:

- **Route:** `/shame` nested inside `AppLayout` (like Statistics, Games, Sync)
- **Service:** `src/main/services/analysis/BoardOfShame.ts` — queries games + analysis, ranks by negative criteria
- **Ranking algorithms:** Max centipawn loss (worst blunder), eval swing from winning to losing (throw), fewest moves (fastest loss), missed mate detection (mate in N not played), time-pressure collapse (needs time-remaining data — not stored)
- **Data tables:** Reuses `games`, `engine_analysis`; no new tables needed for read-only ranking
- **IPC channel:** `shame.worstBlunders` / `shame.throws` / `shame.fastestLoss` / `shame.missedMates` / `shame.timeTrouble` in `src/main/ipc/index.ts`
- **Renderer API:** `window.api.shame.{worstBlunders, throws, fastestLoss, missedMates, timeTrouble}` in `src/preload/index.ts`

---

## 5. Execution Verdict

**Board of Shame does not execute in this system.** The only adjacent operations that run are:

1. Games stored in `chess.db` (raw material)
2. `classifyMove()` — per-move quality with centipawn loss (not ranked)
3. Stockfish analysis per game (stored but not analyzed for throws/missed mates)

No worst-blunders list exists. No throw detection. No fastest-loss tracking. No missed-mate identification. No time-trouble flagging. No shame reel page. Nothing surfaces the user's worst moments.
