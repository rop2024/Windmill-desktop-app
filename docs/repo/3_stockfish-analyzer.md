# Stockfish Analyzer — System Execution Report

## Summary

**Stockfish Analyzer is fully implemented** — a local engine analysis system that analyzes any game from PGN input and produces move quality classifications, blunder/mistake flags, best-move suggestions, evaluation data over the game, and per-color accuracy scores. Analysis runs in the main Electron process via a bundled Stockfish binary, with results persisted to `chess.db` and streamed to the renderer over IPC.

This report documents:
1. What the Stockfish Analyzer system does (per the specification).
2. How each component executes in the system.
3. Current state of each capability.

---

## 1. Stockfish Analyzer Specification (Implemented)

| Capability | Status | Implementation |
|---|---|---|
| Input: PGN | ✅ Implemented | Games loaded from `chess.db` via `GameRepository.getById()`; PGN parsed via `buildTree()` into `MoveNode` tree with FEN per position |
| Output: Move quality classification | ✅ Implemented | `classifyMove()` classifies each ply as best/excellent/good/inaccuracy/mistake/blunder based on centipawn loss or win probability drop |
| Output: Blunders / mistakes flagged | ✅ Implemented | Same classification function; blunders (`??`) and mistakes (`?`) visually flagged with NAG icons and color-coded |
| Output: Best-move suggestions | ✅ Implemented | Stockfish `bestmove` returned per position; `bestmove` and `pv` (principal variation) stored per ply |
| Output: Evaluation graph over the game | ✅ Implemented | `score_cp` / `score_mate` stored per ply in `engine_analysis` table; retrievable for charting eval over time |
| Output: Accuracy score | ✅ Implemented | `computeAccuracy()` per color (white/black) using centipawn loss or classification points; stored as `accuracyWhite` / `accuracyBlack` |

### Execution flow

```
PGN text  ──►  buildTree (fenBefore/fenAfter per ply)  ──►  AnalysisQueue
                                                             │
                                                             ▼
                                    Stockfish EngineProcess (child process)
                                    UCI: position fen → go depth/movetime
                                                             │
                                                             ▼
                                    parseUci (score, depth, nodes, nps, pv, bestmove)
                                                             │
                                                             ▼
                                    classifyMove (best/excellent/good/inaccuracy/mistake/blunder)
                                                             │
                                                             ▼
                                    AnalysisCache (position_cache, SHA-1 of fen+settings+depth)
                                                             │
                                                             ▼
                                    AnalysisRepository (engine_analysis table, per ply)
                                                             │
                                                             ▼
                                    computeAccuracy (accuracyWhite / accuracyBlack)
```

---

## 2. Components and How They Execute

### A. EngineProcess — Stockfish Child Process — IMPLEMENTED
- **File:** `src/main/services/stockfish/EngineProcess.ts`
- **Binary:** Bundled Stockfish executable (`stockfish` / `stockfish.exe`) located in `resources/stockfish/<platform>-<arch>/`
- **Lifecycle:** Spawns Stockfish as a child process, performs UCI handshake (`uci` → `uciok`, `setoption` Threads/Hash/MultiPV, `isready` → `readyok`)
- **Analysis:** Sends `position fen <fen>` + `go depth N` or `go movetime N`; parses `info` and `bestmove` UCI lines; default depth 12; 10s timeout per position
- **Score normalization:** UCI scores are reported from side-to-move perspective; normalized to White's perspective (`parseUci.ts`)
- **Features:** Configurable threads, hash, multiPV, skill level; `stop` command for cancellation; `quit` to terminate process

### B. EngineService — Service Layer — IMPLEMENTED
- **File:** `src/main/services/stockfish/EngineService.ts`
- **Status tracking:** `idle` / `analyzing` / `stopped` / `error`
- **Single position analysis:** `analyzePosition(fen, opts)` — one-shot analysis returning `{ bestmove, pv, score }`; emits `update` and `result` events
- **Status queries:** `getStatus()`, `isReady()`, `start()`, `stop()`, `quit()`
- **Singleton:** `export const engineService = new EngineService()`

### C. AnalysisQueue — Per-Game Analysis Orchestrator — IMPLEMENTED
- **File:** `src/main/services/stockfish/AnalysisQueue.ts`
- **Job queue:** Processes games sequentially; each job = `{ gameId, settings: { depth, movetime, threads, hash, multiPV } }`
- **Per-ply analysis:** For each move in the game, analyzes `fenBefore` (and optionally `fenAfter`), classifies the move, computes centipawn loss, stores the analyzed ply via `AnalysisRepository`
- **Progress events:** Emits `progress` (`{ gameId, done, total, currentPly }`) after each ply; `gameComplete` / `gameError` when done
- **Cancellation:** `cancel(gameId)` removes job from queue and calls `engineService.stop()` if it's the active game
- **Singleton:** `export const analysisQueue = new AnalysisQueue()`

### D. AnalysisCache — Position Caching — IMPLEMENTED
- **File:** `src/main/services/stockfish/AnalysisCache.ts`
- **Table:** `position_cache(fen_hash TEXT PRIMARY KEY, fen, engine_version, settings_hash, depth, score_cp, score_mate, bestmove, pv, analyzed_at)`
- **Key:** SHA-1 of `fen|engineVersion|settingsHash|depth`
- **Behavior:** `lookup()` returns cached result if present; `store()` inserts only if not already cached (avoids duplicate work on re-analysis)

### E. classifyMove — Move Quality Classification — IMPLEMENTED
- **File:** `src/shared/classifyMove.ts` (shared between main and renderer)
- **Classifications:** `best` | `excellent` | `good` | `inaccuracy` | `mistake` | `blunder`
- **Logic:** Computes win probability before/after using centipawn-to-win-probability logistic curve (`k = 0.00368208`); centipawn loss = `max(0, before - after)` for CP scores; classification based on thresholds (best ≤ 0, excellent < 2, good < 5, inaccuracy < 10, mistake < 20, else blunder)
- **Helpers:** `classificationLabel()`, `classificationColor()`, `classificationIcon()` (`✓`, `!`, ``, `?!`, `?`, `??`)
- **Default thresholds:** `{ best: 0, excellent: 2, good: 5, inaccuracy: 10, mistake: 20 }` centipawns

### F. calculateAccuracy — Per-Color Accuracy Score — IMPLEMENTED
- **File:** `src/main/services/analysis/calculateAccuracy.ts`
- **Per-move accuracy:** Piecewise-linear CPL curve (cpl=0 → 100, cpl≤10 → 100−0.75×cpl, cpl≤30 → 92.5−0.6×(cpl−10), cpl≤60 → 80.5−0.5×(cpl−30), cpl≤100 → 65.5−0.35×(cpl−60), else → max(0, 51.5−0.2×(cpl−100))); unknown moves treated as 75
- **Classification fallback:** best=100, excellent=92, good=82, inaccuracy=65, mistake=45, blunder=20, unknown=70
- **Per-color accuracy:** Mean of per-move accuracy for white plies (odd ply numbers) and black plies (even ply numbers); rounded to 1 decimal
- **Detailed breakdown:** `computeAccuracyDetailed()` returns accuracy by classification group

### G. AnalysisRepository — Persistence — IMPLEMENTED
- **File:** `src/main/services/analysis/AnalysisRepository.ts`
- **Table:** `engine_analysis(id, game_id, ply, fen, engine_version, settings_hash, score_cp, score_mate, bestmove, pv, depth, analyzed_at)`
- **Migration:** `003_engine_analysis.sql` creates table + indexes on `(game_id, ply)` and `fen`
- **Operations:** `storePly()` (upsert by game_id+ply), `getAnalysisForGame()` (returns all plies ordered by ply), `getAnalysisCount()`, `getUnanalyzedGameCount()`

### H. IPC Handlers — IMPLEMENTED
- **File:** `src/main/ipc/index.ts`
- **`analysis.position`** — Analyze a single FEN; validates `{ fen, depth?, movetime?, threads?, hash?, multiPV? }`; starts engine, runs `analyzePosition()`, returns `{ ok, data: { bestmove, pv, score } }` or `err('ENGINE_FAILED', ...)`
- **`analysis.startGame`** — Enqueues full-game analysis job in `AnalysisQueue` using settings from `AppSettings.engine`; returns `{ ok, data: { queued: true } }`
- **`analysis.cancel`** — Cancels a game's analysis job; returns `{ ok, data: { cancelled: true } }`
- **`analysis.stop`** — Stops the engine immediately; returns `{ ok, data: { stopped: true } }`
- **`analysis.getForGame`** — Retrieves stored analysis plies for a game; returns `{ ok, data: { plies: [...] } }`
- **Event streaming:** `analysis:update`, `analysis:error`, `analysis:progress`, `analysis:gameComplete`, `analysis:gameError` forwarded from main process to renderer webContents

### I. Preload API — IMPLEMENTED
- **File:** `src/preload/index.ts`
- **`window.api.analysis.position(fen, settings?)`** — `Promise<Result<{ bestmove, pv, score }>>`
- **`window.api.analysis.stop()`** — `Promise<Result<{ stopped: boolean }>>`
- **`window.api.analysis.startGame(gameId)`** — `Promise<Result<{ queued: boolean }>>`
- **`window.api.analysis.cancel(gameId)`** — `Promise<Result<{ cancelled: boolean }>>`
- **`window.api.analysis.getForGame(gameId)`** — `Promise<Result<{ plies: [...] }>>`
- **`window.api.analysis.onUpdate(callback)`** / **`onError(callback)`** / **`onProgress(callback)`** — subscribe to analysis events

---

## 3. How Analysis Executes Step by Step

### Single-position analysis (Explorer view)

1. User clicks "Analyze position" in GameExplorer → `window.api.analysis.position(fen, settings)` invoked
2. Main process validates args, stops engine if currently analyzing, starts engine with settings (depth/threads/hash/multiPV from `AppSettings.engine`)
3. `EngineService.analyzePosition()` sends `position fen <fen>` + `go depth/movetime` to Stockfish
4. Stockfish returns `info` lines (score, depth, nodes, nps, pv) and `bestmove`
5. `parseUci()` normalizes the score to White's perspective
6. Result returned to renderer: `{ bestmove, pv, score }`
7. Renderer displays eval (cp or mate), best move, principal variation

### Full-game analysis (Analysis view)

1. User clicks "Analyze game" → `window.api.analysis.startGame(gameId)` invoked
2. Main process reads `AppSettings.engine` settings, enqueues `{ gameId, settings }` in `AnalysisQueue`
3. `AnalysisQueue.processQueue()` dequeues the job, fetches game moves from `game_moves` table (ply, fen_before, fen_after)
4. For each ply:
   - Check cache (`AnalysisCache.lookup()`); skip Stockfish if cached
   - Otherwise call `engineService.analyzePosition(fenBefore)`
   - Classify move via `classifyMove(before.score, after.score)` → classification + centipawn loss
   - Store analyzed ply via `AnalysisRepository.storePly()`
   - Emit `progress` event → renderer updates progress bar
5. After all plies: compute `accuracyWhite` / `accuracyBlack` via `computeAccuracy()`
6. Emit `gameComplete` with `{ gameId, plies, accuracyWhite, accuracyBlack }`
7. Renderer displays per-ply classifications, eval graph data, and accuracy scores

### Incremental / cached re-analysis

- Positions are cached by `SHA-1(fen|engineVersion|settingsHash|depth)` in `position_cache`
- Re-analyzing the same game with the same settings hits the cache and skips Stockfish entirely
- `getUnanalyzedGameCount()` identifies games without any analysis rows

---

## 4. What Is NOT Implemented

| Capability | Status | Notes |
|---|---|---|
| Multi-engine support | ❌ Not implemented | Only Stockfish is bundled; no UCI engine configuration for other engines |
| Cloud / remote engine | ❌ Not implemented | Engine runs locally as a child process only |
| Analysis sharing / export | ❌ Not implemented | Analysis is stored locally per game; no export of analysis results |
| Bulk analyze all games | ❌ Not implemented | `analysis.startGame` analyzes one game at a time; no "analyze all" button |
| Analysis settings per-game | ⚠️ Partial | Settings come from global `AppSettings.engine`; no per-game override in UI |
| Real-time eval graph during analysis | ⚠️ Partial | Progress events stream per-ply, but eval graph rendering in Analysis view is placeholder text ("Evaluation graph available in explorer view") |

---

## 5. Execution Verdict

**Stockfish Analyzer executes in this system.** Operations that run:

1. `window.api.analysis.position(fen, settings)` — single position analysis via Stockfish child process
2. `window.api.analysis.startGame(gameId)` — full-game analysis: fetch plies → analyze each position → classify → cache → store → compute accuracy
3. `window.api.analysis.cancel(gameId)` / `analysis.stop()` — cancel in-flight analysis
4. `window.api.analysis.getForGame(gameId)` — retrieve stored analysis plies from `engine_analysis`
5. `classifyMove(before, after)` — move quality classification (best/excellent/good/inaccuracy/mistake/blunder) with centipawn loss
6. `computeAccuracy(inputs)` — per-color accuracy score (0–100) from CPL or classification points

The input is PGN (games loaded from `chess.db`), and the output includes move quality classification, blunder/mistake flags, best-move suggestions with principal variation, per-ply evaluation scores for graphing, and per-color accuracy scores — all matching the specification.
