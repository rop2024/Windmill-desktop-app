# Search Engine — System Execution Report

## Summary

**Search Engine is not implemented in this codebase.**

There is no natural-language or structured search across the user's game history. The codebase has a simple `search` filter (substring match on white/black player names and PGN text) in the Games list, but no query parser, no tactical search (rook sacrifice + win), no endgame search (blundered in rook endgames), and no full-text search engine.

This report documents:
1. What the Search Engine system should do (per the specification).
2. What search infrastructure actually exists today.
3. What is missing and would need to be built.

---

## 1. Search Engine Specification

| Capability | Purpose |
|---|---|
| Natural-language search | Parse queries like "show games where I sacrificed a rook and won" |
| Structured search | Filter by criteria (result, opening, time class, tactic, material) |
| Full-game-history scope | Search across all games in `chess.db` |
| Example queries | "show games where I sacrificed a rook and won", "show games where I blundered in rook endgames" |

### Example query parsing

```
"show games where I sacrificed a rook and won"
  ───►  filter: result = win AND sacrifice_detected = rook

"show games where I blundered in rook endgames"
  ───►  filter: endgame = rook AND classification = blunder
```

### Expected execution flow

```
Natural-language query  ──►  Search Engine (query parser)
                                                        │
                                                        ▼
                                    Parse into structured filters
                                                        │
                                                        ▼
                                    Query games table + analysis tables
                                                        │
                                                        ▼
                                    Return matching games
```

---

## 2. What Exists in the System Today

### A. Games List Search — IMPLEMENTED (basic substring filter)
- **File:** `src/renderer/pages/Games.tsx` — search input + `filters.search`
- **File:** `src/main/services/database/repositories/GameRepository.ts` — `buildWhere(filters)`
- **Purpose:** Simple substring match on white player, black player, and PGN text
- **Limitation:** Only matches player names and PGN text; no tactical/endgame/result logic; no natural-language parsing.

### B. IPC Search Filter — IMPLEMENTED (basic)
- **File:** `src/main/ipc/index.ts` — `games.query` with `search` field
- **Purpose:** Passes search string to `buildWhere()` as SQL `LIKE`
- **Limitation:** Substring only; no query language, no tactical filters.

### C. Game Storage — IMPLEMENTED (raw material)
- **File:** `src/main/services/database/connection.ts`
- **Purpose:** `chess.db` with games, PGN, results, time class, opening
- **Limitation:** No full-text search index; no tactical metadata index.

---

## 3. What Is Missing

The following capabilities from the specification are **not implemented**:

| Capability | Status | Notes |
|---|---|---|
| Natural-language search | ❌ Missing | No query parser; no intent extraction |
| Structured search | ❌ Missing | No filter syntax beyond simple substring |
| Tactical search | ❌ Missing | Cannot search "sacrificed a rook" (Tactical Detector not implemented) |
| Endgame search | ❌ Missing | Cannot search "blundered in rook endgames" (no endgame detection) |
| Full-game-history scope | ⚠️ Partial | Games list search covers all games but is substring-only |
| Query parser | ❌ Missing | No NLP or grammar-based query parsing |
| Search UI | ❌ Missing | No dedicated search page; only Games list filter |

---

## 4. Where the Pieces Would Live (if built)

If Search Engine were implemented, the natural integration points are:

- **Route:** `/search` nested inside `AppLayout` (like Statistics, Games, Sync)
- **Service:** `src/main/services/search/SearchEngine.ts` — parses queries, builds structured filters, queries database
- **Query parser:** Grammar-based or NLP — converts natural language to structured filters (result, tactic, endgame, material, opening, rating range)
- **Database queries:** SQL with `LIKE`, joins to `engine_analysis` (classifications), future `game_tactics` table (tactic types), future opening ECO codes
- **Full-text search:** Optional SQLite FTS or external index (Lunr.js, Elasticsearch) for PGN text search
- **IPC channel:** `search.query` in `src/main/ipc/index.ts`
- **Renderer API:** `window.api.search.{query}` in `src/preload/index.ts`

---

## 5. Execution Verdict

**Search Engine does not execute in this system.** The only adjacent operations that run are:

1. Games list search input — substring match on player names and PGN text
2. `buildWhere(filters)` — SQL `WHERE` clause with basic `LIKE` filters
3. `games.query` IPC — passes filters to database

No natural-language parser exists. No tactical search exists. No endgame search exists. No structured query language exists. No dedicated search page exists. Queries like "show games where I sacrificed a rook and won" cannot be parsed or executed.
