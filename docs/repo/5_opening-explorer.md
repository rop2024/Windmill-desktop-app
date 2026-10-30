# Opening Explorer — System Execution Report

## Summary

**Opening Explorer is not implemented in this codebase.**

There is no dedicated Opening Explorer page, no drill-down flow (Opening → Games → Win % → Accuracy → Mistakes → Common Positions → Recommendations), and no personalized opening repertoire analysis. The codebase only has opening *detection* (identifying which opening a game belongs to) and opening *statistics* (a flat table of opening names with win rates), but no tool to explore which lines you play well vs. poorly.

This report documents:
1. What the Opening Explorer system should do (per the specification).
2. What opening-related code actually exists today.
3. What is missing and would need to be built.

---

## 1. Opening Explorer Specification

| Capability | Purpose |
|---|---|
| Opening drill-down | Navigate from an opening to its games, win %, accuracy, mistakes, common positions, and recommendations |
| Games per opening | List all games played in a specific opening |
| Win % per opening | Surface which openings you win/lose with |
| Accuracy per opening | Accuracy score for moves played within each opening |
| Mistakes flagged | Blunders/mistakes/inaccuracies surfaced per opening line |
| Common positions | Frequently reached positions within each opening |
| Recommendations | Suggest which lines to play/avoid based on your results |
| Personalized scope | Scoped to *your* games only (like Lichess Opening Explorer, but personal) |

### Expected execution flow

```
Your games (chess.db)  ──►  detect opening per game (ECO/name)
                                                        │
                                                        ▼
                                    Group games by opening
                                                        │
                                                        ▼
                                    Aggregate: win %, accuracy, mistakes per opening
                                                        │
                                                        ▼
                                    Drill-down: opening → games → positions → recommendations
```

---

## 2. What Exists in the System Today

### A. OpeningDetector — IMPLEMENTED (utility only, no UI)
- **File:** `src/openings/OpeningDetector.ts`
- **Purpose:** Detects the ECO code, name, variation, and matched ply from a sequence of SAN moves
- **API:** `loadFromTsv(tsv)`, `detect(mainLineSan: string[])`
- **How it works:** Normalizes SAN (strips `+#?!` annotations), compares move-by-move against loaded opening entries, returns the longest prefix match with `eco`, `name`, `variation`, and `ply`
- **Usage:** Instantiated in `GameExplorer.tsx` with an inline TSV of ~10 openings (King's Pawn, Giuoco Piano, Two Knights, Ruy Lopez, Queen's Gambit, Reti, Sicilian, English)
- **Limitation:** No UI, no drill-down, no persistence, no per-opening aggregation over your games

### B. Opening Statistics Table — IMPLEMENTED (flat table, no drill-down)
- **File:** `src/main/services/statistics/StatisticsService.ts` — `openings(filters)` method
- **How it works:** Parses the `[Opening "..."]` PGN header tag from each game, groups by opening name, aggregates wins/losses/draws, computes win rate, sorts by games desc
- **IPC:** `statistics.openings` channel
- **Renderer:** `src/renderer/pages/Statistics.tsx` — "Openings" view tab shows a table (opening, games, win % with progress bar, W/L/D)
- **Limitation:** Flat table only. No drill-down into individual games, no accuracy per opening, no mistakes flagged, no common positions, no recommendations

### C. Opening Column in Games List — IMPLEMENTED (display only)
- **File:** `src/renderer/pages/Games.tsx`
- **How it works:** Games table shows an "Opening" column with the PGN `[Opening]` tag value
- **Limitation:** Read-only display, no click-to-explore, no aggregation

### D. Opening Info in GameExplorer — IMPLEMENTED (per-game only)
- **File:** `src/renderer/pages/GameExplorer.tsx`
- **How it works:** Detects and displays ECO + opening name for the currently loaded game using `OpeningDetector`
- **Limitation:** Single-game view only, no cross-game analysis

---

## 3. What Is Missing

The following capabilities from the specification are **not implemented**:

| Capability | Status | Notes |
|---|---|---|
| Dedicated Opening Explorer page/route | ❌ Missing | No route, no component, no shell integration |
| Drill-down: Opening → Games → Win % → Accuracy → Mistakes → Common Positions → Recommendations | ❌ Missing | No hierarchical navigation; openings only appear as flat table rows |
| Games per opening (click to see games) | ❌ Missing | No way to list all games within a specific opening |
| Win % per opening | ⚠️ Partial | Flat table shows win rate, but no drill-down or comparison visualization |
| Accuracy per opening | ❌ Missing | No opening-specific accuracy aggregation |
| Mistakes flagged per opening | ❌ Missing | No blunder/mistake/inaccuracy breakdown by opening line |
| Common positions per opening | ❌ Missing | No position frequency analysis within openings |
| Recommendations (play/avoid lines) | ❌ Missing | No suggestion engine based on results |
| Personalized repertoire (your games only) | ⚠️ Partial | Statistics are scoped to your games, but no repertoire management UI |

---

## 4. Where the Pieces Would Live (if built)

If Opening Explorer were implemented, the natural integration points are:

- **Route:** `/openings` or `/openings/:eco` nested inside `AppLayout` (like Statistics, Games, Sync)
- **Opening detection reuse:** Reuse `src/openings/OpeningDetector.ts` or the PGN `[Opening]` header parsing from `StatisticsService.openings()`
- **Per-opening aggregation:** New service, e.g. `src/main/services/statistics/OpeningExplorerService.ts` — groups games by opening, computes win %, accuracy (from `engine_analysis`), mistakes (from classification), common positions (from `game_moves` fen_before grouping)
- **IPC channel:** `openings.explorer` / `openings.drilldown` in `src/main/ipc/index.ts`, guarded by zod validation
- **Renderer API:** `window.api.openings.{list, drilldown, games}` in `src/preload/index.ts`
- **UI:** Windmill-styled page with `// opening explorer` technical label, drill-down panels, KPI cards per opening, accuracy/mistake breakdowns, position frequency table, recommendations panel

---

## 5. Execution Verdict

**Opening Explorer does not execute in this system.** The only opening-related operations that run are:

1. `OpeningDetector.detect(mainLineSan)` — identifies ECO/name for a single game's move sequence (used in GameExplorer)
2. `statisticsService.openings(filters)` — flat table of opening names with win rates (used in Statistics page)
3. Opening column display in Games list

Nothing provides a drill-down flow, per-opening accuracy, mistake flagging, common positions, or recommendations. Nothing lets you see which opening lines you play well vs. poorly.
