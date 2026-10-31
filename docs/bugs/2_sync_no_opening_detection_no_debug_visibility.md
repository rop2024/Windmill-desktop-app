# Bug 2: Sync (Sync now) does not surface activity in the system, and synced games lack opening detection

## What happens when "Sync now" is tapped

1. **User enters a Chess.com username** and clicks "Sync now" on the Sync page (`src/renderer/pages/Sync.tsx`).
2. `handleSync()` calls `window.api.sync.start(user)` → IPC channel `sync.start`.
3. The main process creates a `SyncService` and calls `sync.sync(username)`:
   - Calls Chess.com API `getPlayer()` to validate the user.
   - Calls `getArchives()` to list all monthly game archive URLs.
   - Filters archives newer than `chessComLastSyncAt` (stored in `settings` table).
   - For each eligible archive month:
     - Fetches games via `getGamesForMonth(year, month)`.
     - Calls `injectSourceHeader(g.pgn)` to add `[Source "online"]` to each game's PGN.
     - Parses PGN via `PgnService.parseGames`.
     - Stores via `GameRepository.insertMany()` → writes to `chess.db` tables `games` + `game_moves`.
   - Saves `chessComUsername` and `chessComLastSyncAt` (newest game timestamp) into the `settings` table.
   - Returns `{ imported, duplicates, found }`.

## Where data is stored

| Data | Table | Notes |
|------|-------|-------|
| Synced games | `games` | Includes `source = 'online'`, `source` header injected as `[Source "online"]` |
| Game moves (FEN, SAN, ply) | `game_moves` | Stored per-ply during import |
| Sync metadata | `settings` | `chessComUsername`, `chessComLastSyncAt` (newest game time) |

Database location: `C:\Users\HP\AppData\Roaming\chess-desktop\chess.db` (Electron user data directory).

## What is NOT happening (the issue)

**Opening detection is NOT run during sync import.**

Compare the two import paths:

| Step | PGN Import (`ImportService`) | Sync Import (`SyncService`) |
|------|------------------------------|-----------------------------|
| OpeningDetector used | ✅ Yes (wired in IPC handler) | ❌ No |
| `[Opening]` / `[ECO]` headers set | ✅ Yes | ❌ No |
| Appears in Opening Explorer | ✅ Yes | ❌ No |

Because `SyncService.sync()` never instantiates or calls `OpeningDetector`, synced games are stored **without** `[Opening]` and `[ECO]` PGN headers. The Opening Explorer (`OpeningExplorerService.list()` → `StatisticsService.openings()`) reads games by parsing the `[Opening "..."]` PGN header. Since synced games never get that header, **they never appear in the Opening Explorer**, even though they are successfully stored in `chess.db`.

Additionally, there is **no debug visibility** into sync activity. The `DebugPanel` only tracks `pgn.import` progress. When "Sync now" is tapped, no sync events (stage, month, imported count, errors) flow into the debug panel, so there is no way to observe what the sync is doing or diagnose why games may not appear.

## Fix required

1. **Wire `OpeningDetector` into `SyncService.sync()`** so each imported game gets `[Opening]` / `[ECO]` headers detected and stored, same as PGN import.
2. **Expose sync progress events to the `DebugContext`** so the DebugPanel can show sync stage, current month, imported count, and errors — making sync activity visible and debuggable.
