# Coach — System Execution Report

## Summary

**Coach is not implemented in this codebase.**

There is no synthesis layer that consumes analysis data to generate guidance. The codebase analyzes individual games and positions, but nothing produces weekly/monthly reports, daily advice, focus areas, or personalized training plans. The Coach depends on Tactical Detector, Weakness Engine, and Puzzle Trainer — none of which are implemented.

This report documents:
1. What the Coach system should do (per the specification).
2. What analysis infrastructure actually exists today that could feed it.
3. What is missing and would need to be built.

---

## 1. Coach Specification

| Capability | Purpose |
|---|---|
| Weekly report | Summarize past week's performance, blunders, improvements |
| Monthly report | Summarize past month's trends, rating progression, weakness changes |
| Daily advice | One actionable recommendation per day based on recent games |
| Focus areas | Identify top 2–3 areas to work on (from Weakness Engine) |
| Personalized training plan | Combine Weakness Engine + Puzzle Trainer into a plan |

### Dependencies (not implemented)

- **Tactical Detector** — tactic tallies (missed forks, pins, etc.)
- **Weakness Engine** — star-rated weakness categories
- **Puzzle Trainer** — solve stats, streaks, weakness-mode data

### Expected execution flow

```
All analysis data (games, tactics, weaknesses, puzzles)  ──►  Coach
                                                                │
                                                                ▼
                                                    Synthesize into guidance
                                                                │
                                                                ▼
                                                    Weekly / Monthly / Daily reports
                                                                │
                                                                ▼
                                                    Focus areas + training plan
```

---

## 2. What Exists in the System Today

### A. Move Quality Classification — IMPLEMENTED (partial signal)
- **File:** `src/shared/classifyMove.ts`
- **Purpose:** Classifies moves as best/excellent/good/inaccuracy/mistake/blunder
- **Limitation:** Per-move only; no synthesis into advice or reports.

### B. Statistics Aggregation — IMPLEMENTED (partial signal)
- **File:** `src/main/services/statistics/StatisticsService.ts`
- **Purpose:** Win rates, ratings, streaks, openings, calendar
- **Limitation:** Read-only stats; no coaching advice, no focus areas, no training plans.

### C. Per-Game Analysis — IMPLEMENTED (partial signal)
- **Files:** `src/main/services/stockfish/AnalysisQueue.ts`, `AnalysisRepository.ts`
- **Purpose:** Per-ply eval, classification, accuracy
- **Limitation:** Stored per-game; never synthesized into coaching output.

---

## 3. What Is Missing

The following capabilities from the specification are **not implemented**:

| Capability | Status | Notes |
|---|---|---|
| Weekly report | ❌ Missing | No report generation, no weekly summary |
| Monthly report | ❌ Missing | No monthly summary, no trend analysis |
| Daily advice | ❌ Missing | No actionable daily recommendations |
| Focus areas | ❌ Missing | No weakness-based focus identification |
| Personalized training plan | ❌ Missing | No plan combining weaknesses + puzzles |
| Coach UI | ❌ Missing | No coach page, no report display |
| Dependency: Tactical Detector | ❌ Missing | No tactic data to synthesize |
| Dependency: Weakness Engine | ❌ Missing | No weakness categories to focus on |
| Dependency: Puzzle Trainer | ❌ Missing | No puzzle stats to incorporate |

---

## 4. Where the Pieces Would Live (if built)

If Coach were implemented, the natural integration points are:

- **Route:** `/coach` nested inside `AppLayout` (like Statistics, Games, Sync)
- **Service:** `src/main/services/analysis/Coach.ts` — queries game stats, weakness data, puzzle stats; generates reports and advice
- **Report templates:** Weekly report, monthly report, daily advice — Markdown/HTML templates
- **Focus area algorithm:** Rank Weakness Engine categories by star rating; select top 2–3
- **Training plan algorithm:** Map weakness categories to puzzle types and study topics
- **IPC channel:** `coach.weeklyReport` / `coach.monthlyReport` / `coach.dailyAdvice` / `coach.trainingPlan` in `src/main/ipc/index.ts`
- **Renderer API:** `window.api.coach.{weeklyReport, monthlyReport, dailyAdvice, trainingPlan}` in `src/preload/index.ts`

---

## 5. Execution Verdict

**Coach does not execute in this system.** The only adjacent operations that run are:

1. `classifyMove()` — per-move quality (not synthesized into advice)
2. `StatisticsService.*()` — read-only stats (no coaching output)
3. `AnalysisQueue.analyzeGame()` — per-game analysis (not rolled up into guidance)

No synthesis layer exists. No weekly/monthly/daily reports. No focus areas. No training plan. The Coach depends on Tactical Detector, Weakness Engine, and Puzzle Trainer — none of which are implemented. Nothing generates guidance.
