# Puzzle Trainer — System Execution Report

## Summary

**Puzzle Trainer is not implemented in this codebase.**

There is no training experience that consumes a puzzle database. The codebase has no puzzle database, no daily puzzle delivery, no spaced repetition, no stats tracking, no streaks, no timed mode, and no weakness-targeted puzzle selection. Puzzle Generator itself is not implemented, so there is no data for a trainer to consume.

This report documents:
1. What the Puzzle Trainer system should do (per the specification).
2. What infrastructure actually exists today that is related.
3. What is missing and would need to be built.

---

## 1. Puzzle Trainer Specification

| Capability | Purpose |
|---|---|
| Daily puzzles | Serve a curated puzzle each day |
| Spaced repetition | Resurface puzzles based on user performance (forgotten → show sooner) |
| Stats tracking | Track solve rate, time-to-solve, correct/incorrect per puzzle |
| Streaks | Consecutive days solved, current solve streak |
| Timed mode | Solve puzzles under a clock |
| Weakness mode | Select puzzles targeting the user's weak areas (from Weakness Engine) |

### Expected execution flow

```
Puzzle Database  ──►  select puzzle (daily / weakness mode / spaced repetition)
                                                                │
                                                                ▼
                                                    Present position + clock (timed mode)
                                                                │
                                                                ▼
                                                    User enters solution
                                                                │
                                                                ▼
                                                    Grade solution → update stats / streaks
                                                                │
                                                                ▼
                                                    Reschedule for spaced repetition
```

---

## 2. What Exists in the System Today

### A. ChessBoard Component — IMPLEMENTED (partial UI)
- **File:** `src/renderer/components/ChessBoard.tsx`
- **Purpose:** Renders chess positions, handles square clicks, shows pieces
- **Limitation:** No puzzle interface, no move-entry validation against a solution, no clock, no timing.

### B. Move Quality Classification — IMPLEMENTED (partial grading logic)
- **File:** `src/shared/classifyMove.ts`
- **Purpose:** Classifies moves as blunder/mistake/etc. — could grade puzzle solutions
- **Limitation:** No puzzle solution comparison; no solve/incorrect tracking.

### C. Statistics Aggregation — IMPLEMENTED (partial stats model)
- **File:** `src/main/services/statistics/StatisticsService.ts`
- **Purpose:** Aggregates games into win rates, streaks, ratings
- **Limitation:** Game-level stats only; no puzzle-solving stats, no solve streaks, no solve rate.

---

## 3. What Is Missing

The following capabilities from the specification are **not implemented**:

| Capability | Status | Notes |
|---|---|---|
| Daily puzzles | ❌ Missing | No puzzle selection, no daily rotation |
| Spaced repetition | ❌ Missing | No scheduling algorithm, no review intervals |
| Stats tracking | ❌ Missing | No solve rate, time-to-solve, correct/incorrect tracking |
| Streaks | ❌ Missing | No consecutive-solve tracking |
| Timed mode | ❌ Missing | No clock, no time-limit solving |
| Weakness mode | ❌ Missing | No weakness-targeted puzzle selection (Weakness Engine not implemented) |
| Puzzle Trainer UI | ❌ Missing | No trainer page, no solve interface |
| Puzzle database dependency | ❌ Missing | Puzzle Generator not implemented; no data to consume |

---

## 4. Where the Pieces Would Live (if built)

If Puzzle Trainer were implemented, the natural integration points are:

- **Route:** `/puzzles` or `/trainer` nested inside `AppLayout` (like Statistics, Games, Sync)
- **Service:** `src/main/services/puzzle/PuzzleTrainer.ts` — selects puzzles, tracks solves, manages spaced repetition
- **Database tables:** `puzzle_solves(puzzle_id, user_id, correct, time_ms, solved_at)`, `puzzle_schedule(puzzle_id, next_review, interval, ease_factor)`
- **Selection algorithms:** Daily (random unplayed), weakness mode (filter by Weakness Engine categories), spaced repetition (SM-2 or similar)
- **UI components:** PuzzleBoard (ChessBoard variant with solution entry), timer display, stats panel, streak counter
- **IPC channel:** `puzzle.trainer.select` / `puzzle.trainer.solve` / `puzzle.trainer.stats` in `src/main/ipc/index.ts`
- **Renderer API:** `window.api.puzzleTrainer.{select, solve, stats}` in `src/preload/index.ts`

---

## 5. Execution Verdict

**Puzzle Trainer does not execute in this system.** The only adjacent operations that run are:

1. ChessBoard renders positions (no puzzle-solving interface)
2. classifyMove() grades move quality (no puzzle solution comparison)
3. StatisticsService aggregates game stats (no puzzle-solving stats)

No puzzle database exists (Puzzle Generator not implemented). No trainer UI exists. No spaced repetition, no timed mode, no weakness mode, no solve streaks. Nothing consumes puzzles to deliver a training experience.
