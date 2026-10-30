# Chess Statistics — System Execution Report

## Summary

**Chess Statistics is fully implemented** — a pure analytics dashboard over the user's game history stored in `chess.db`. It provides rating trends, win percentage (overall, by color, by time control), opening performance, time-control breakdown, opponent analysis, win/loss streaks, and a calendar heatmap. Accuracy is computed per-game during Stockfish analysis but has no dedicated trend endpoint yet. The Statistics view is accessible via the `/statistics` route (nested inside the `AppLayout` shell with the persistent sidebar) and could be spun off as a standalone app since it only reads from the local SQLite database.

This report documents:
1. What the Chess Statistics system does (per the specification).
2. How each component executes in the system.
3. Current state of each capability.

---

## 1. Chess Statistics Specification (Implemented)

| Capability | Status | Implementation |
|---|---|---|
| Rating trends | ✅ Implemented | `statistics.ratingHistory()` — per-game player rating over time |
| Accuracy trends | ⚠️ Partially | Accuracy computed per-game during analysis; stored in `engine_analysis`; no dedicated accuracy-trend endpoint yet |
| Win % (overall) | ✅ Implemented | `statistics.overview()` — total games, wins, losses, draws, win rate |
| Win % by color | ✅ Implemented | `statistics.resultsByColor()` — white and black win rates |
| Win % by time control | ✅ Implemented | `statistics.timeControls()` — win rate per bullet/blitz/rapid/classical/daily |
| Opening performance | ✅ Implemented | `statistics.openings()` — games, wins, losses, draws, win rate per opening (extracted from PGN `[Opening]` tag) |
| Time-of-day / time-control breakdown | ⚠️ Partial | Time-control breakdown implemented; time-of-day breakdown not implemented |
| Opponent analysis | ✅ Implemented | `statistics.opponents()` — games, wins, losses, draws, win rate per opponent |
| Win/loss streaks | ✅ Implemented | `statistics.streaks()` — current/longest win, loss, and unbeaten streaks |
| Calendar heatmap | ✅ Implemented | `statistics.calendar()` — games per date for a given year |
| Standalone / spun off | ✅ Feasible | Reads only from `chess.db` via `StatisticsService`; no engine or network dependency |

### Execution flow

```
chess.db (games table)  ──►  StatisticsService.fetchGames(filters)
                                                        │
                                                        ▼
                              per-capability aggregation functions
                                                        │
                              overview / ratingHistory / resultsByColor
                              openings / opponents / timeControls
                              streaks / calendar
                                                        │
                                                        ▼
                              IPC: statistics.{overview,rating,resultsByColor,
                              openings,opponents,timeControls,streaks,calendar}
                                                        │
                                                        ▼
                              Renderer: Statistics page (Windmill-styled)
                              KPI cards / charts / tables / calendar heatmap
```

---

## 2. Components and How They Execute

### A. StatisticsService — Core Analytics Engine — IMPLEMENTED
- **File:** `src/main/services/statistics/StatisticsService.ts`
- **Singleton:** `export const statisticsService = new StatisticsService()`
- **Data source:** Reads directly from the `games` table in `chess.db` via `getDB()`; uses `buildWhere()` from `GameRepository` for filter pushdown (source, result, outcome, timeClass, search)
- **Fetch pattern:** All methods call `fetchGames(filters)` which loads all matching games ordered by `played_at ASC`, then aggregates in memory (TypeScript) — no SQL `GROUP BY`/`COUNT` for stats; all aggregation is done in JS

#### Methods:

| Method | Returns | Description |
|---|---|---|
| `overview(filters)` | `OverviewStats` | totalGames, wins, losses, draws, winRate, currentRating (last rated game), bestRating |
| `ratingHistory(filters, timeClass?)` | `RatingPoint[]` | date + playerRating for every rated game, in chronological order |
| `resultsByColor(filters)` | `ResultsByColor` | white and black: games, wins, losses, draws, winRate |
| `openings(filters)` | `OpeningStat[]` | Parses `[Opening "..."]` tag from each game's PGN; aggregates wins/losses/draws; sorted by games desc |
| `opponents(filters)` | `OpponentStat[]` | Groups by `opponent` field; aggregates results; sorted by games desc |
| `timeControls(filters)` | `TimeControlStat[]` | Groups by `time_class` (bullet, blitz, rapid, classical, daily); fixed order; filters zero-game classes |
| `streaks(filters)` | `StreakStat` | currentWin, longestWin, currentLoss, longestLoss, currentUnbeaten, longestUnbeaten — iterates outcomes chronologically |
| `calendar(filters, year?)` | `CalendarDay[]` | Groups games by date (YYYY-MM-DD); optional year filter |

### B. GameFilters — Filtering — IMPLEMENTED
- **File:** `src/shared/game.ts`
- **Fields:** `source` (local\|online\|engine), `result` (win\|loss\|draw), `outcome` (win\|loss\|draw), `timeClass` (bullet\|blitz\|rapid\|classical\|daily), `search` (substring match on white/black/pgn), `limit`, `offset`
- **Applied to:** All statistics endpoints; filters are pushed into the SQL `WHERE` clause via `buildWhere()` before aggregation

### C. IPC Handlers — IMPLEMENTED
- **File:** `src/main/ipc/index.ts`
- All statistics endpoints validate args with zod and return `{ ok: true, data: <result> }`:

| Channel | Input | Output |
|---|---|---|
| `statistics.overview` | `GameFilters` | `OverviewStats` |
| `statistics.rating` | `GameFilters` | `RatingPoint[]` |
| `statistics.resultsByColor` | `GameFilters` | `ResultsByColor` |
| `statistics.openings` | `GameFilters` | `OpeningStat[]` |
| `statistics.opponents` | `GameFilters` | `OpponentStat[]` |
| `statistics.timeControls` | `GameFilters` | `TimeControlStat[]` |
| `statistics.streaks` | `GameFilters` | `StreakStat` |
| `statistics.calendar` | `GameFilters + year?` | `CalendarDay[]` |

### D. Preload API — IMPLEMENTED
- **File:** `src/preload/index.ts`
- **`window.api.statistics.overview(filters?)`** — `Promise<Result<OverviewStats>>`
- **`window.api.statistics.rating(filters?)`** — `Promise<Result<RatingPoint[]>>`
- **`window.api.statistics.resultsByColor(filters?)`** — `Promise<Result<ResultsByColor>>`
- **`window.api.statistics.openings(filters?)`** — `Promise<Result<OpeningStat[]>>`
- **`window.api.statistics.opponents(filters?)`** — `Promise<Result<OpponentStat[]>>`
- **`window.api.statistics.timeControls(filters?)`** — `Promise<Result<TimeControlStat[]>>`
- **`window.api.statistics.streaks(filters?)`** — `Promise<Result<StreakStat>>`
- **`window.api.statistics.calendar(filters?, year?)`** — `Promise<Result<CalendarDay[]>>`

### E. Stats Store (Zustand) — IMPLEMENTED
- **File:** `src/renderer/stats/store.ts`
- **State:** `filters`, `view` (overview\|rating\|color\|openings\|opponents\|timeControls\|streaks\|calendar), `year`, `loading`
- **Actions:** `setFilters`, `setFilter`, `setView`, `setYear`, `setLoading`, `resetFilters`
- **Default view:** `overview`

### F. Statistics Page (UI) — IMPLEMENTED
- **File:** `src/renderer/pages/Statistics.tsx`
- **Route:** `/statistics` (nested inside `AppLayout` shell — persistent sidebar present)
- **Layout:** Windmill-styled with `// statistics` technical label, page title, view tabs as FilterChips, KPI cards (Games, Win rate, Rating, Best streak), and view-specific panels
- **Views:**
  - **Overview:** KPI cards + Streaks panel (current/longest win/loss/unbeaten)
  - **Openings:** Table with opening name, games, win % (segmented progress bar), W/L/D counts
  - **Opponents:** Table with opponent name, games, win %, W/L/D
  - **Time controls:** Per-class (bullet/blitz/rapid/classical/daily) win rate with progress bars
  - **Calendar:** Year selector + GitHub-style heatmap (green intensity scale by game count)
- **Windmill styling:** `bg-background` dark surface, cyan/magenta/yellow/green accent panels, angular clipped corners (`clip-path-panel`), monospace `//` labels, uppercase tracking

---

## 3. How Statistics Executes Step by Step

1. User navigates to `/statistics`
2. `Statistics` page mounts; `loadStats()` calls all 8 statistics IPC endpoints via `Promise.allSettled()` (independent — one failing endpoint doesn't block the others)
3. Each IPC handler:
   - Validates `GameFilters` with zod
   - Calls the corresponding `statisticsService.*()` method
   - `StatisticsService.fetchGames(filters)` queries `chess.db` with `buildWhere()` filters, ordered by `played_at ASC`
   - Aggregates results in TypeScript (counts, win rates, streaks, groupings)
   - Returns `{ ok: true, data: <typed result> }`
4. Renderer updates local state for each capability; `setLoading(false)` when all complete
5. UI renders:
   - KPI cards at top (total games, win rate %, current/best rating, longest streak)
   - View-specific panel based on selected tab (openings table, opponents table, time-control progress bars, calendar heatmap, streaks)
6. User can change filters (time control, result, search) via `setFilter()`; view tabs via `setView()`; calendar year via `setYear()` — each change re-triggers `loadStats()`

### Filter behavior
- Filters are shared across all statistics endpoints — changing the time control filter, for example, applies to overview, rating history, openings, opponents, streaks, and calendar simultaneously
- `search` does a `LIKE` match on white player, black player, and PGN text
- `source` distinguishes local imports vs Chess.com sync vs engine-analyzed games

---

## 4. What Is NOT Implemented

| Capability | Status | Notes |
|---|---|---|
| Accuracy trends over time | ❌ Not implemented | Accuracy is computed per-game during Stockfish analysis and stored in `engine_analysis`, but there's no dedicated endpoint or UI trend chart for accuracy over time |
| Time-of-day breakdown | ❌ Not implemented | Time-control breakdown exists (bullet/blitz/etc.); no hour-of-day or day-of-week analysis |
| ECO code breakdown | ❌ Not implemented | Opening stats use the PGN `[Opening]` tag text, not standardized ECO codes |
| Performance vs rating bands | ❌ Not implemented | No win rate grouped by player rating range (e.g., "1200-1400") |
| Export statistics report | ❌ Not implemented | Statistics are viewed in-app only; no PDF/CSV export |
| Comparative stats (vs opponents, over periods) | ❌ Not implemented | No period-over-period comparison or head-to-head vs specific opponent beyond basic win rate |
| Real-time stats updates | ⚠️ Partial | Stats recalculate on filter/view change, but no automatic refresh when new games are imported |

---

## 5. Execution Verdict

**Chess Statistics executes in this system.** Operations that run:

1. `window.api.statistics.overview(filters)` — total games, W/L/D, win rate, current/best rating
2. `window.api.statistics.rating(filters)` — rating history points for trend chart
3. `window.api.statistics.resultsByColor(filters)` — white/black win rates
4. `window.api.statistics.openings(filters)` — opening performance from PGN `[Opening]` tags
5. `window.api.statistics.opponents(filters)` — per-opponent win rates
6. `window.api.statistics.timeControls(filters)` — per-time-class breakdown
7. `window.api.statistics.streaks(filters)` — current/longest win/loss/unbeaten streaks
8. `window.api.statistics.calendar(filters, year)` — per-date game counts for heatmap

**Input:** Games table in `chess.db` (PGN, result, player color/rating, opponent, time class, played at).
**Output:** All analytics described in the specification except accuracy trends and time-of-day breakdown.

**Standalone viability:** High — `StatisticsService` has zero dependencies on the engine, network, or UI; it only reads `chess.db`. It could be extracted into a standalone analytics app with minimal changes.
