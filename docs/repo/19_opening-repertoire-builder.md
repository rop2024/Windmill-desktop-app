# Opening Repertoire Builder — System Execution Report

## Summary

**Opening Repertoire Builder is not implemented in this codebase.**

There is no system that manages and tracks the user's personal opening repertoire as a distinct project. The codebase detects openings per game (via `OpeningDetector`) and shows opening statistics in a flat table, but nothing stores a repertoire, tracks coverage, flags weak/forgotten lines, or generates study schedules.

This report documents:
1. What the Opening Repertoire Builder system should do (per the specification).
2. What opening infrastructure actually exists today that could feed it.
3. What is missing and would need to be built.

---

## 1. Opening Repertoire Builder Specification

| Capability | Purpose |
|---|---|
| Stores your repertoire | Persist the user's chosen openings (as White and as Black) |
| Tracks coverage | Measure how often repertoire lines are actually played |
| Flags weak lines | Identify repertoire lines with poor results |
| Flags forgotten lines | Identify repertoire lines not played recently |
| Study schedule generation | Create study plan for weak/forgotten lines |

### Expected execution flow

```
User's games (chess.db)  ──►  detect openings per game
                                                        │
                                                        ▼
                                    Compare against stored repertoire
                                                        │
                                                        ▼
                                    Track coverage, flag weak/forgotten lines
                                                        │
                                                        ▼
                                    Generate study schedule
```

---

## 2. What Exists in the System Today

### A. Opening Detection — IMPLEMENTED (partial signal)
- **File:** `src/openings/OpeningDetector.ts`
- **Purpose:** Detects ECO code, name, variation from move sequence
- **Usage:** Instantiated in `GameExplorer.tsx` with inline TSV of ~10 openings
- **Limitation:** Per-game detection only; no repertoire storage, no coverage tracking, no weak/forgotten flags.

### B. Opening Statistics — IMPLEMENTED (partial signal)
- **File:** `src/main/services/statistics/StatisticsService.ts` — `openings(filters)`
- **Purpose:** Parses `[Opening "..."]` PGN tag, groups by name, win rate, games
- **Limitation:** Flat table only; no repertoire concept, no coverage, no weak/forgotten flags.

### C. Opening Column in Games — IMPLEMENTED (display only)
- **File:** `src/renderer/pages/Games.tsx`
- **Purpose:** Shows `[Opening]` tag in games table
- **Limitation:** Read-only display; no repertoire management.

---

## 3. What Is Missing

The following capabilities from the specification are **not implemented**:

| Capability | Status | Notes |
|---|---|---|
| Stores your repertoire | ❌ Missing | No repertoire table; no user-defined opening lines |
| Tracks coverage | ❌ Missing | No measurement of repertoire line usage |
| Flags weak lines | ❌ Missing | No result-based weakness flagging per line |
| Flags forgotten lines | ❌ Missing | No recency-based forgotten-line detection |
| Study schedule generation | ❌ Missing | No study plan for weak/forgotten lines |
| Repertoire UI | ❌ Missing | No repertoire management page |
| Repertoire vs game comparison | ❌ Missing | No logic to compare played games against repertoire |

---

## 4. Where the Pieces Would Live (if built)

If Opening Repertoire Builder were implemented, the natural integration points are:

- **Route:** `/repertoire` nested inside `AppLayout` (like Statistics, Games, Sync)
- **Service:** `src/main/services/openings/RepertoireBuilder.ts` — manages repertoire, computes coverage, flags lines, generates study schedule
- **Database tables:** `repertoire_lines(id, color, eco, name, moves, priority, added_at)`, `repertoire_coverage(line_id, games_played, last_played, win_rate)`
- **Coverage algorithm:** Compare played games' openings against stored repertoire lines; compute percentage of repertoire covered
- **Weak line detection:** Low win rate on repertoire lines → flag as weak
- **Forgotten line detection:** Lines not played in N months → flag as forgotten
- **Study schedule:** Prioritize weak + forgotten lines; generate study topics
- **IPC channel:** `repertoire.list` / `repertoire.add` / `repertoire.coverage` / `repertoire.studyPlan` in `src/main/ipc/index.ts`
- **Renderer API:** `window.api.repertoire.{list, add, coverage, studyPlan}` in `src/preload/index.ts`

---

## 5. Execution Verdict

**Opening Repertoire Builder does not execute in this system.** The only adjacent operations that run are:

1. `OpeningDetector.detect()` — per-game opening identification (no storage)
2. `statisticsService.openings()` — flat opening stats table (no repertoire concept)
3. Opening column in Games list (read-only display)

No repertoire storage exists. No coverage tracking exists. No weak/forgotten line flagging exists. No study schedule generation exists. No repertoire management UI exists. Nothing manages the user's personal opening repertoire as a distinct project.
