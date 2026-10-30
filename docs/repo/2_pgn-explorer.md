# PGN Explorer — System Execution Report

## Summary

**PGN Explorer is implemented as the Game Explorer feature** — a "VS Code for PGNs" that loads, browses, and inspects individual games in detail. It is accessible via the `/explorer/:gameId` route and combines a chessboard, move list, FEN viewer, variation tree, comment/annotation support, engine analysis, and opening detection into a single view.

This report documents:
1. What the PGN Explorer system does (per the specification).
2. How each component executes in the system.
3. Current state of each capability.

---

## 1. PGN Explorer Specification (Implemented)

| Capability | Status | Implementation |
|---|---|---|
| Load PGN files | ✅ Implemented | PGN parsed from `chess.db` via `GameRepository.getById()` |
| Navigate moves | ✅ Implemented | Forward/back, jump to first/last/jump-to-move via `explorerStore` |
| FEN viewer | ✅ Implemented | FEN display, edit, load, and copy in the explorer page |
| Variations support | ✅ Implemented | Variation tree rendered indented in move list; `selectVariation` action |
| Comments/annotations | ✅ Implemented | Move comments (`{comment}`) and NAGs (`!!`, `!?`, `?!`, `?`) displayed inline; `setComment` action |
| Search across games | ❌ Not implemented | No cross-game search UI; filtering exists only in Games list |
| Opening detection | ✅ Implemented | ECO/opening name detected via `OpeningDetector` and displayed |
| Standalone / usable without ecosystem | ⚠️ Partially | Can load any game from `chess.db`, but route is not nested in the `AppLayout` shell (sidebar missing) |

### Execution flow

```
PGN text in chess.db  ──►  extractHeaders  ──►  buildTree  ──►  MoveNode tree
                                                        │
                                                        ▼
                                    ChessBoard (render position) ◄── current node
                                                        │
                                                        ▼
                                    WindmillMoveList (render moves + variations)
                                                        │
                                                        ▼
                                    FEN viewer / editor (current position)
                                                        │
                                                        ▼
                                    Opening detection (ECO + name)
                                                        │
                                                        ▼
                                    Engine analysis (score, bestmove, PV)
```

---

## 2. Components and How They Execute

### A. GameExplorer Page — IMPLEMENTED
- **File:** `src/renderer/pages/GameExplorer.tsx`
- **Route:** `/explorer/:gameId` (top-level route in `App.tsx`, NOT nested inside `AppLayout`)
- **Layout:** Two-panel Windmill layout:
  - **Left region** (1/3 width): evaluation strip (green/pink gradient), chessboard, navigation controls (first/prev/next/last), FEN input + Load/Copy buttons, engine analyze/stop button
  - **Right region** (2/3 width): game info panel (result, ECO, opening, date, time control, termination, players), moves panel (WindmillMoveList), engine analysis panel (depth, nodes, NPS, best move, PV)
- **Windmill styling:** `// explorer` technical label, cyan/magenta/yellow accent panels, dark charcoal board (`#232331` light, `#14141C` dark), yellow/black pieces, yellow current-square highlight, `clip-path-panel` angular corners

### B. ChessBoard Component — IMPLEMENTED
- **File:** `src/renderer/components/ChessBoard.tsx`
- **Technology:** SVG-based 8×8 board rendered with `chess.js` for move validation
- **Visuals:** Dark charcoal checkerboard (`#232331` light squares, `#14141C` dark squares), white pieces = yellow (`#FCEE09`), black pieces = pink (`#FF2A6D`), `2px solid #2A2A36` outline
- **Features:**
  - Square click to select/move
  - Selected square highlighted with translucent yellow (`rgba(252,238,9,0.35)`)
  - Last-move highlight, check highlight
  - Engine best-move arrow (green/pink based on eval)
  - Board flip toggle
  - Configurable square size (default 64px in explorer)
  - Keyboard navigation (arrow keys, Home/End, PageUp/PageDown)

### C. WindmillMoveList Component — IMPLEMENTED
- **File:** `src/renderer/components/WindmillMoveList.tsx`
- **Features:**
  - Mainline move list with move numbers (white: `N.`, black: `N…`)
  - Current move highlighted with yellow background + dark text
  - Variations rendered as indented nested lists with `(` … `)` grouping
  - Comments shown as `{comment}` in italic muted text
  - NAGs (`!!`, `!?`, `?!`, `?`) shown after SAN
  - Clickable moves to jump to position
  - Hover states on rows
  - Monospace uppercase styling per Windmill design guide

### D. explorerStore (Zustand) — IMPLEMENTED
- **File:** `src/renderer/store/explorerStore.ts`
- **State:** `game`, `headers`, `roots` (MoveNode tree), `currentNodeId`, `orientation`, `fen`, `sanAtCurrent`, `ply`, `loading`, `error`, `dirty`, `analysis`
- **Actions:**
  - `loadGame(game)` — parses PGN via `extractHeaders` + `buildTree`, sets up initial position
  - `goNext()` / `goPrev()` — navigate mainline forward/backward
  - `goFirst()` / `goLast()` — jump to start/end of mainline
  - `goToNode(nodeId)` / `selectVariation(nodeId)` — jump to any node in the tree
  - `setOrientation('w' \| 'b')` — flip board
  - `setComment(nodeId, comment)` — edit move comment, marks dirty
  - `save()` — serializes roots back to PGN, calls `window.api.pgn.updatePgn()`
  - `reset()` — clears all state
  - **Engine analysis:** `analyzeCurrent()` / `stopAnalysis()` / `setAnalysis()` — calls Stockfish via IPC, tracks score/bestmove/PV/depth/nps/time

### E. PGN Parsing Pipeline — IMPLEMENTED
- **Files:** `src/pgn/splitGames.ts`, `src/pgn/parseHeaders.ts`, `src/pgn/buildTree.ts`, `src/pgn/PgnService.ts`, `src/pgn/flattenMainLine.ts`, `src/pgn/serialize.ts`
- **Pipeline:** raw PGN text → `splitGames()` → `extractHeaders()` → `detectResult()` → `buildTree()` (SAN→UCI→FEN move tree) → `ParsedGame[]`
- **MoveNode structure:** `id`, `parentId`, `ply`, `san`, `uci`, `fenBefore`, `fenAfter`, `comment`, `nags`, `children[]`
- **SAN validation:** Each move validated against `chess.js` legal move set
- **Serialization:** `serialize()` converts MoveNode tree back to PGN text for save

### F. Opening Detection — IMPLEMENTED
- **File:** `src/main/services/sync/ChessComService.ts` uses `OpeningDetector` from `@openings/OpeningDetector`
- **Explorer integration:** `GameExplorer.tsx` instantiates `OpeningDetector`, loads TSV data (ECO codes, opening names, move sequences), detects opening from mainline SAN, displays ECO + name in game info panel
- **Sample openings:** King's Pawn, Giuoco Piano, Two Knights, Ruy Lopez, Queen's Gambit, Reti, Sicilian, English

### F. PGN IPC (Preload API) — IMPLEMENTED
- **File:** `src/preload/index.ts`
- **`window.api.pgn.import(filePath)`** — import PGN file from disk
- **`window.api.pgn.importPick()`** — open file picker and import
- **`window.api.pgn.export(ids, all)`** — export games to PGN file
- **`window.api.pgn.exportAll()`** — export all games
- **`window.api.pgn.updatePgn(id, pgn)`** — update a game's PGN (used by explorer save)
- **IPC handlers:** `pgn.import`, `pgn.import.pick`, `pgn.export`, `pgn.export.all`, `games.updatePgn` in `src/main/ipc/index.ts`

### G. ImportService — IMPLEMENTED
- **File:** `src/main/services/ImportService.ts`
- **Behavior:** Reads PGN file, parses via `PgnService`, deduplicates by SHA-1 of normalized headers + movetext, runs opening detection, writes to `chess.db` via `GameRepository.insertMany()`
- **Progress reporting:** `stage` (`parsing`/`importing`/`done`), `processed`/`total`, `found`/`imported`/`duplicates`/`invalid`, sent via `pgn:import:progress` IPC channel

---

## 3. How the Explorer Executes Step by Step

1. User navigates to `/explorer/:gameId` (from Games list or Game Detail page)
2. `GameExplorer` mounts, calls `window.api.games.getById(id)` to fetch the game from `chess.db`
3. `loadGame(game)` in `explorerStore`:
   - Parses PGN headers via `extractHeaders()`
   - Builds move tree via `buildTree()` using `chess.js` for SAN validation and FEN generation
   - Sets initial position to the first move's `fenAfter`
4. Render cycle:
   - **ChessBoard** renders current position from `fen`
   - **WindmillMoveList** renders mainline moves from `roots[0]` down the `children[0]` chain
   - **FEN viewer** shows current `fen` with edit/load/copy
   - **Opening detector** analyzes mainline SAN for ECO + name match
   - **Engine analysis** auto-starts on position change via `analyzeCurrent()`
5. User interactions:
   - Click a move → `goToNode(nodeId)` → board + FEN update
   - Click variation → `selectVariation(nodeId)` → jumps to that variation
   - Click Next/Prev/First/Last → navigate mainline
   - Edit FEN + Load → validates via `validateFen()`, loads custom position
   - Edit comment → `setComment()` → marks dirty, enables Save
   - Click Save → `serialize()` → `window.api.pgn.updatePgn()` → persists to `chess.db`

---

## 4. What Is NOT Implemented

| Capability | Status | Notes |
|---|---|---|
| Search across games | ❌ Not implemented | No cross-game PGN search; the Games list has a search filter but the Explorer has no "find in games" feature |
| Standalone / sidebar shell | ⚠️ Partial | Route `/explorer/:gameId` is a top-level route in `App.tsx`, NOT nested inside `AppLayout` — the sidebar/nav rail is missing on explorer pages |
| PGN file drag-and-drop | ❌ Not implemented | PGN import requires file picker dialog; no drag-and-drop target in Explorer |
| Export current game | ❌ Not implemented | Export exists at Games list level only; Explorer can save edits but not export a single game to file |
| Board arrows (manual) | ⚠️ Partial | Engine best-move arrows supported; no manual arrow drawing |
| PGN snippet search within game | ❌ Not implemented | No "find move sequence" within a loaded game |

---

## 5. Execution Verdict

**PGN Explorer executes in this system.** Operations that run:

1. `window.api.games.getById(id)` — loads game + PGN from `chess.db`
2. `extractHeaders()` + `buildTree()` — parses PGN into a navigable `MoveNode` tree with FEN per position
3. `ChessBoard` — renders the current position as a dark charcoal SVG board with unicode pieces
4. `WindmillMoveList` — renders moves, variations, comments, NAGs with current-move highlighting
5. `OpeningDetector` — matches mainline SAN to ECO opening codes
6. `analyzeCurrent()` — sends FEN to Stockfish via IPC, displays score/bestmove/PV
7. `setComment()` + `save()` — edits move comments and serializes the tree back to PGN, persisted via `window.api.pgn.updatePgn()`

**Known issue:** The `/explorer/:gameId` route is not nested inside the `AppLayout` shell (see `App.tsx:74`), so the persistent sidebar, brand, and navigation rail are absent on explorer pages. This should be moved inside the `AppLayout` route group like Dashboard, Games, Settings, Sync, and Statistics.
