# Timeline — System Execution Report

## Summary

**Timeline is not implemented in this codebase.**

There is no GitHub-contributions-style visual history of rating/progress with milestones. The codebase has no timeline view, no rating-progression chart, no milestone markers, and no chronological visualization of improvement. Games and ratings are stored in `chess.db` but nothing renders them as a contribution-style timeline.

This report documents:
1. What the Timeline system should do (per the specification).
2. What analysis infrastructure actually exists today that could feed it.
3. What is missing and would need to be built.

---

## 1. Timeline Specification

| Capability | Purpose |
|---|---|
| Chronological rating progression | Display rating over time (e.g., 2026: 1200 → 1300 → 1500 → 1700) |
| Milestone markers | Mark rating milestones (first 1000, first 1500, first 2000, etc.) |
| GitHub-contributions-style view | Heatmap/contribution-graph visual of activity over time |
| Progress visualization | Visual history of improvement |

### Expected execution flow

```
Games + ratings (chess.db)  ──►  Timeline
                                                    │
                                                    ▼
                                    Sort games by played_at (chronological)
                                                    │
                                                    ▼
                                    Extract rating at each game
                                                    │
                                                    ▼
                                    Render contribution-style heatmap + rating line
                                                    │
                                                    ▼
                                    Mark milestone markers
```

---

## 2. What Exists in the System Today

### A. Game Storage with Ratings — IMPLEMENTED (raw material)
- **File:** `src/main/services/database/connection.ts`, `GameRepository.ts`, `src/shared/game.ts`
- **Purpose:** `chess.db` with games including `playerRating`, `playedAt` (timestamp)
- **Limitation:** Data stored but never rendered as a timeline or progression chart.

### B. Statistics — Rating History — IMPLEMENTED (partial signal)
- **File:** `src/main/services/statistics/StatisticsService.ts` — `ratingHistory(filters)`
- **Purpose:** Returns `date + playerRating` for every rated game in chronological order
- **Limitation:** Data exists but no timeline visualization component consumes it.

### C. Statistics — Calendar Heatmap — IMPLEMENTED (partial UI pattern)
- **File:** `src/renderer/pages/Statistics.tsx` — "Calendar" view tab
- **Purpose:** GitHub-style heatmap of games per date for a year
- **Limitation:** Shows game count per date, not rating progression; no milestone markers; not a full timeline view.

---

## 3. What Is Missing

The following capabilities from the specification are **not implemented**:

| Capability | Status | Notes |
|---|---|---|
| Chronological rating progression | ❌ Missing | No rating-over-time chart or line |
| Milestone markers | ❌ Missing | No first-1000/1500/2000 rating markers |
| GitHub-contributions-style view | ❌ Missing | No activity heatmap for chess games |
| Progress visualization | ❌ Missing | No improvement visualization |
| Timeline UI | ❌ Missing | No timeline page or component |
| Milestone detection logic | ❌ Missing | No code to detect rating milestones |

---

## 4. Where the Pieces Would Live (if built)

If Timeline were implemented, the natural integration points are:

- **Route:** `/timeline` nested inside `AppLayout` (like Statistics, Games, Sync)
- **Service:** `src/main/services/statistics/TimelineService.ts` — queries games with ratings, sorts chronologically, detects milestones
- **Data source:** `games` table (playerRating, playedAt) — same as `statisticsService.ratingHistory()`
- **Milestone algorithm:** Detect when playerRating crosses round thresholds (1000, 1200, 1400, 1600, 1800, 2000)
- **UI components:** Contribution heatmap (games per day), rating line chart, milestone marker annotations
- **IPC channel:** `timeline.ratingProgression` / `timeline.milestones` in `src/main/ipc/index.ts`
- **Renderer API:** `window.api.timeline.{ratingProgression, milestones}` in `src/preload/index.ts`

---

## 5. Execution Verdict

**Timeline does not execute in this system.** The only adjacent operations that run are:

1. Games stored with `playerRating` and `playedAt` in `chess.db` (raw material)
2. `statisticsService.ratingHistory()` — date + rating pairs (not visualized)
3. Calendar heatmap in Statistics page — game counts per date only (no ratings, no milestones)

No rating-progression chart exists. No milestone markers exist. No GitHub-contributions-style view exists. No timeline page exists. Nothing visualizes rating progression over time.
