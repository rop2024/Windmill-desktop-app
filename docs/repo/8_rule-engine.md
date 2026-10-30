# Rule Engine — System Execution Report

## Summary

**Rule Engine is not implemented in this codebase.**

There is no headless logic layer that converts detected events into counters/triggers. The codebase has no rule engine, no counter system, no trigger mechanism, and no scalable rule framework. Event detection (tactics, classifications) exists only as raw per-game data with no downstream rule processing.

This report documents:
1. What the Rule Engine system should do (per the specification).
2. What analysis infrastructure actually exists today that could feed it.
3. What is missing and would need to be built.

---

## 1. Rule Engine Specification

| Capability | Purpose |
|---|---|
| Headless logic layer | No UI; runs in the main Electron process or as a standalone service |
| Event-to-counter conversion | Detected events increment named counters (e.g., Missed Fork → Fork Counter++) |
| Trigger/flag generation | Counter thresholds set flags (e.g., Fork Counter ≥ 10 → Flag "Need Training") |
| Scale to hundreds of rules | Rule definitions are data-driven; new rules added without code changes |
| Reusable across projects | Logic is decoupled from Windmill UI; importable as a library/module |

### Example rule logic

```
Missed Fork  ──►  Fork Counter++  ──►  Fork Counter >= 10  ──►  Flag: NEED_TRAINING (tactics)
Blunder × 3  ──►  Blunder Counter++  ──►  Blunder Counter >= 5  ──►  Flag: REVIEW_OPENING
```

### Expected execution flow

```
Detected events (tactics, classifications, analysis)  ──►  Rule Engine
                                                                │
                                                                ▼
                                                    Match event against rule definitions
                                                                │
                                                                ▼
                                                    Increment counters / set flags
                                                                │
                                                                ▼
                                                    Emit flag events to UI / other services
```

---

## 2. What Exists in the System Today

### A. Move Quality Classification — IMPLEMENTED (partial event source)
- **File:** `src/shared/classifyMove.ts`
- **Purpose:** Classifies each move as `best` / `excellent` / `good` / `inaccuracy` / `mistake` / `blunder`
- **Limitation:** Per-move classification only. No counters, no triggers, no rule processing downstream.

### B. Per-Game Analysis — IMPLEMENTED (partial event source)
- **Files:** `src/main/services/stockfish/AnalysisQueue.ts`, `AnalysisRepository.ts`, `EngineService.ts`
- **Purpose:** Stockfish analysis of every ply, stored in `engine_analysis` (score, bestmove, classification)
- **Limitation:** Raw analysis data only. No rule engine consumes it to generate counters or flags.

### C. Statistics Aggregation — IMPLEMENTED (partial event source)
- **File:** `src/main/services/statistics/StatisticsService.ts`
- **Purpose:** Aggregates games into win rates, streaks, ratings, openings
- **Limitation:** Read-only statistics; no rule-based flag generation or counter system.

### D. IPC Event Streaming — IMPLEMENTED (partial infrastructure)
- **File:** `src/main/ipc/index.ts`
- **Purpose:** `analysis:update`, `analysis:progress`, `analysis:gameComplete` events streamed to renderer
- **Limitation:** Events are forwarded raw; no rule engine subscribes to them to apply logic.

---

## 3. What Is Missing

The following capabilities from the specification are **not implemented**:

| Capability | Status | Notes |
|---|---|---|
| Headless logic layer | ❌ Missing | No rule engine service or module exists |
| Event-to-counter conversion | ❌ Missing | No counter system; no code increments named counters from events |
| Trigger/flag generation | ❌ Missing | No flag system; no code sets "Need Training" or similar flags |
| Scale to hundreds of rules | ❌ Missing | No rule definition format; no rule registry or engine |
| Reusable across projects | ❌ Missing | No decoupled logic library; all logic is embedded in UI components |

---

## 4. Where the Pieces Would Live (if built)

If Rule Engine were implemented, the natural integration points are:

- **Service:** `src/main/services/analysis/RuleEngine.ts` — headless, no UI dependencies
- **Rule definition format:** JSON/YAML — e.g., `{ id: "missed_fork", when: "tactic.missed.fork", action: "increment_counter", counter: "fork_missed", threshold: 10, flag: "need_tactics_training" }`
- **Rule registry:** Loads rule definitions, evaluates events against them, maintains counter state
- **Event subscription:** Subscribes to `analysis:update`, `analysis:gameComplete`, `sync:progress`, etc.
- **Counter store:** In-memory or SQLite-backed counters keyed by counter name
- **Flag emitter:** Emits `rule:flag` events when thresholds are crossed
- **IPC channel:** `rule.engine.evaluate` / `rule.engine.getFlags` in `src/main/ipc/index.ts`
- **Renderer API:** `window.api.rules.{getFlags, getCounters}` in `src/preload/index.ts`

---

## 5. Execution Verdict

**Rule Engine does not execute in this system.** The only adjacent operations that run are:

1. `classifyMove(before, after)` — per-move quality classification (raw event, no rule processing)
2. `AnalysisQueue.analyzeGame()` — per-game analysis (raw data, no rule engine consumes it)
3. `StatisticsService.*()` — read-only statistics aggregation (no counters, no flags)

Nothing converts detected events into counters/triggers. Nothing scales to hundreds of rules. Nothing is reusable across projects. No rule-defined flag like "Need Training" can be generated.
