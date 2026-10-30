# Training Planner — System Execution Report

## Summary

**Training Planner is not implemented in this codebase.**

There is no system that converts weakness data into a concrete daily training plan. The codebase has no weakness data (Weakness Engine not implemented), no daily plan generation, no study-schedule logic, and no output like "Today's Plan — 15 forks, 10 endgames, study Italian, review yesterday."

This report documents:
1. What the Training Planner system should do (per the specification).
2. What infrastructure actually exists today that is related.
3. What is missing and would need to be built.

---

## 1. Training Planner Specification

| Capability | Purpose |
|---|---|
| Input: Weaknesses | Consumes Weakness Engine output (star-rated categories: Opening, Endgame, King Safety, Time Pressure, Calculation) |
| Output: Daily plan | Generates a concrete daily plan (e.g., "15 forks, 10 endgames, study Italian, review yesterday") |
| Plan composition | Combines weakness categories with puzzle types and study topics |
| Daily regeneration | Plan refreshes each day based on progress and weaknesses |

### Dependencies (not implemented)

- **Weakness Engine** — star-rated weakness categories (primary input)
- **Puzzle Trainer** — puzzle database for tactic practice (forks, endgames, etc.)

### Expected execution flow

```
Weakness Engine output (star ratings per category)  ──►  Training Planner
                                                                │
                                                                ▼
                                    Map weak categories to puzzle types + study topics
                                                                │
                                                                ▼
                                    Generate daily plan with counts and topics
                                                                │
                                                                ▼
                                    Output: "Today's Plan — …"
```

---

## 2. What Exists in the System Today

### A. Move Quality Classification — IMPLEMENTED (partial signal)
- **File:** `src/shared/classifyMove.ts`
- **Purpose:** Classifies moves as best/excellent/good/inaccuracy/mistake/blunder
- **Limitation:** Per-move only; no weakness categories, no daily plan generation.

### B. Statistics Aggregation — IMPLEMENTED (partial signal)
- **File:** `src/main/services/statistics/StatisticsService.ts`
- **Purpose:** Win rates, ratings, streaks, openings
- **Limitation:** Game-level stats; no weakness mapping, no training plan output.

---

## 3. What Is Missing

The following capabilities from the specification are **not implemented**:

| Capability | Status | Notes |
|---|---|---|
| Input: Weaknesses | ❌ Missing | Weakness Engine not implemented; no star-rated categories |
| Output: Daily plan | ❌ Missing | No daily plan generation |
| Plan composition | ❌ Missing | No mapping from weaknesses to puzzles/study topics |
| Daily regeneration | ❌ Missing | No daily refresh of plans |
| Training Planner UI | ❌ Missing | No planner page, no plan display |
| Dependency: Weakness Engine | ❌ Missing | No weakness data to consume |
| Dependency: Puzzle Trainer | ❌ Missing | No puzzle database for tactic practice |

---

## 4. Where the Pieces Would Live (if built)

If Training Planner were implemented, the natural integration points are:

- **Route:** `/training` or `/plan` nested inside `AppLayout` (like Statistics, Games, Sync)
- **Service:** `src/main/services/analysis/TrainingPlanner.ts` — queries Weakness Engine output, maps categories to puzzle types, generates daily plan
- **Category-to-plan mapping:** e.g., Calculation (★★☆☆☆) → "15 fork puzzles"; Endgame (★★☆☆☆) → "10 endgame studies"; Opening → "study Italian"
- **Daily plan output:** Text summary like "Today's Plan — 15 forks, 10 endgames, study Italian, review yesterday"
- **Progress tracking:** Mark plan items complete; adjust next day's plan based on completion
- **IPC channel:** `training.dailyPlan` / `training.completeItem` in `src/main/ipc/index.ts`
- **Renderer API:** `window.api.training.{dailyPlan, completeItem}` in `src/preload/index.ts`

---

## 5. Execution Verdict

**Training Planner does not execute in this system.** The only adjacent operations that run are:

1. `classifyMove()` — per-move quality (not rolled up into weaknesses)
2. `StatisticsService.*()` — game stats (not mapped to training needs)

No Weakness Engine exists (no star-rated categories). No daily plan generation exists. No category-to-plan mapping exists. No Training Planner UI exists. Nothing converts weakness data into a concrete daily plan. Output like "Today's Plan — 15 forks, 10 endgames, study Italian, review yesterday" cannot be generated.
