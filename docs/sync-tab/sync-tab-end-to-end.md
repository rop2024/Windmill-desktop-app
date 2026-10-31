# Sync Tab: End-to-End Behavior

This document describes what every control and displayed value in the Sync tab does, from the renderer through Electron IPC, the Chess.com API, settings storage, PGN parsing, and the SQLite database.

## Files involved

| Layer | File | Responsibility |
|---|---|---|
| Renderer page | `src/renderer/pages/Sync.tsx` | Displays the Sync tab and handles user actions. |
| Preload bridge | `src/preload/index.ts` | Exposes `window.api.sync` to the renderer. |
| IPC registration | `src/main/ipc/index.ts` | Validates IPC arguments and invokes sync services. |
| Sync orchestration | `src/main/services/sync/SyncService.ts` | Coordinates validation, archive selection, downloading, parsing, deduplication, and progress. |
| Chess.com client | `src/main/services/sync/ChessComService.ts` | Calls Chess.com's public API. |
| Settings | `src/main/services/settings.ts` | Reads and writes the saved username and last-sync timestamp. |
| Game repository | `src/main/services/database/repositories/GameRepository.ts` | Reads and writes games and game moves. |
| Database connection | `src/main/services/database/connection.ts` | Opens the per-user `chess.db` SQLite database. |
| PGN parser | `src/pgn/PgnService.ts` | Converts downloaded PGN text into parsed games and move trees. |
| Main process startup | `src/main/index.ts` | Initializes the database, migrations, IPC handlers, and progress event sender. |

## What happens when the Sync tab opens

`Sync.tsx` initializes local renderer state:

- `status`: username, last sync timestamp, total games, and online games.
- `progress`: the latest sync progress event.
- `username`: the text currently in the username input.
- `syncing`: whether the page considers a sync active.
- `error`: the latest user-visible error.

The page then calls:

```text
window.api.sync.status()
```

The preload bridge invokes the `sync.status` IPC channel. The main process creates a `SyncService`, which:

1. Reads `chess-settings.json` through `settingsService.get()`.
2. Counts all rows in the SQLite `games` table.
3. Counts rows in `games` where `source = 'online'`.
4. Returns the values to the renderer.

The saved username is not a live Chess.com connection. It is only a value previously written to settings. The UI displays `CONNECTED` when a saved username exists.

## Username input

The username field is a normal controlled React input:

```text
username state <- input value
```

Typing does not contact Chess.com, update settings, or access SQLite. It only changes renderer memory.

When Sync now is clicked, the input is trimmed. If it is empty, the page uses `status.username`, which is the username saved by a previous successful sync. If both are empty, no IPC request is made and the page displays:

```text
Enter a Chess.com username first
```

## Sync now button

### Enabled/disabled state

The button is disabled when:

- a sync is already running; or
- the username input is empty and no saved username exists.

It is enabled when a username is available either in the input or in saved status.

### Renderer action

Clicking the button runs `handleSync()`:

1. Clears the previous renderer error.
2. Clears the previous progress object.
3. Chooses `username.trim()` or the saved username.
4. Sets `syncing = true`.
5. Calls:

```text
window.api.sync.start(username)
```

### Preload and IPC

The preload bridge invokes:

```text
ipcRenderer.invoke('sync.start', { username })
```

The main-process IPC handler validates `{ username }` with a Zod schema requiring a non-empty string.

If another `SyncService` is active, it is cancelled before a new service is created. The handler also creates an `OpeningDetector`, loads its built-in opening patterns, and creates a `SyncService` with:

- a progress callback that sends progress to the renderer; and
- the opening detector used during import.

### Backend sync sequence

`SyncService.sync(username)` performs the following sequence.

#### 1. Validate the Chess.com player

The service calls:

```text
GET https://api.chess.com/pub/player/{username}
```

The request uses a 30-second timeout and a User-Agent header. A 404 becomes `Chess.com player not found`; a 429 becomes a rate-limit error; other non-2xx responses become an API error.

This step does not write settings or the database.

#### 2. Load archive URLs

The service calls:

```text
GET https://api.chess.com/pub/player/{username}/games/archives
```

Chess.com returns URLs such as:

```text
https://api.chess.com/pub/player/{username}/games/2026/10
```

The service extracts the year and month from each URL.

#### 3. Read previous sync state

The service reads settings from the per-user settings file:

```text
chess-settings.json
```

The relevant fields are:

| Setting | Meaning |
|---|---|
| `chessComUsername` | Username displayed as connected. |
| `chessComLastSyncAt` | Millisecond timestamp used to select the earliest archive to scan next time. |

These values are not stored in `chess.db`; they are stored in the Electron user-data settings file.

#### 4. Select eligible archives

If a previous sync timestamp exists, its UTC year-month is calculated. Archives strictly older than that month are skipped.

The month containing the previous sync is deliberately retained. This is required because a player can add more games to the current month after the previous sync.

Eligible archives are sorted newest-first. This makes recent games appear sooner for accounts with many years of history.

The first progress event has:

```text
stage: checking
processed: 0
total: number of eligible archives
```

#### 5. Download each month

For every eligible archive, the service calls:

```text
GET https://api.chess.com/pub/player/{username}/games/{year}/{month}
```

The month is zero-padded in the request, for example `/2026/10`.

Before each request, the renderer receives a `fetching` progress event containing the current month, processed count, archive total, and current totals for found/imported/duplicates.

The API response is expected to contain a `games` array. The service adds the array length to `found`.

#### 6. Convert downloaded PGN

For each downloaded game, the service takes its `pgn` field and adds:

```pgn
[Source "online"]
```

unless that header already exists.

All monthly PGNs are joined and passed to `PgnService.parseGames()`. The parser:

1. Splits multiple PGNs.
2. Extracts headers.
3. Detects the result.
4. Tokenizes the movetext.
5. Builds a move tree.
6. Annotates moves with FEN and UCI data.

The sync progress stage changes to `importing` before database insertion.

#### 7. Detect openings

For each parsed game with a move tree, the opening detector examines the main line. If a match is found, the parser headers receive:

- `ECO`
- `Opening`
- `Variation`, when available

These headers are serialized into the stored PGN.

#### 8. Insert games into SQLite

`GameRepository.insertMany(parsed.games)` uses the already-open SQLite connection.

The database path is:

```text
Electron userData/chess.db
```

On Windows, this is normally under the application user's Electron user-data directory, not the repository folder.

For every parsed game:

1. Headers and movetext are hashed into an `external_id`.
2. The repository checks `(source, external_id)` in `games`.
3. Existing rows are counted as duplicates.
4. New rows are inserted into `games`.
5. Parsed main-line moves are inserted into `game_moves`.

The source is read from the injected `Source` header, so synced rows use:

```text
source = 'online'
```

The relevant `games` columns include:

- `id`
- `white_player`
- `black_player`
- `result`
- `pgn`
- `source`
- `external_id`
- `played_at`
- statistics and analysis metadata columns added by migrations

The repository returns `imported` and `duplicates`. These totals are accumulated across all months.

#### 9. Save sync state

After processing, the service saves:

```text
chessComUsername = username
chessComLastSyncAt = newest downloaded game's end time
```

If no game has a newer `end_time`, the previous timestamp is retained, or the current time is used for the first sync.

Settings are written to `chess-settings.json`, not to the SQLite `sync_metadata` table. The `sync_metadata` table exists in the schema but is not used by the current Sync tab implementation.

#### 10. Finish

The renderer receives a `done` progress event containing:

- total archives processed;
- total games found;
- total games imported;
- total duplicates;
- invalid count.

The IPC call also returns the same final totals. The page then reloads status, causing fresh counts from SQLite and fresh settings values.

## Cancel button

### Enabled/disabled state

Cancel is disabled when `syncing` is false. It is enabled while the page believes a sync is active.

### Renderer action

Clicking Cancel calls:

```text
window.api.sync.cancel()
```

The page immediately:

1. Sets `syncing = false`.
2. Clears the visible progress.

### Backend action

The preload bridge invokes `sync.cancel`. The IPC handler calls `activeSyncService.cancel()` and clears the active service reference.

The service does not abort an already-running `fetch()` because the current `ChessComService` does not expose a shared abort controller. Cancellation is checked at the start of each archive iteration. Therefore:

- a request already in progress may finish;
- the next archive is not started;
- the service emits an `idle` progress event;
- the sync returns `{ ok: false, error: 'Sync cancelled' }`.

Cancel does not delete games already inserted before cancellation. It also does not roll back earlier months.

## Status display

### Status label

The label is based on renderer state:

- `SYNCING…` when `syncing = true`;
- `CONNECTED` when `syncing = false` and `status.username` exists;
- `DISCONNECTED` otherwise.

`CONNECTED` means that a username is saved in settings. It does not independently verify that Chess.com is reachable.

### Last sync

This is `status.lastSyncAt` formatted with the local system timezone. The source value is `chessComLastSyncAt` from settings.

### Source

The text `Chess.com → chess.db` describes the intended data flow. The actual settings state is kept separately in `chess-settings.json`.

### Progress bar

The page displays progress for every stage except `done` and `idle`. The percentage is:

```text
processed / total * 100
```

The current month is shown while a monthly archive is being fetched or imported.

## KPI cards

### Total games

Returned by `GameRepository.count()` and backed by:

```sql
SELECT COUNT(*) FROM games
```

This includes local and online games.

### From Chess.com

Returned by:

```sql
SELECT COUNT(*) FROM games WHERE source = 'online'
```

This counts imported online games, not the number of games currently available on Chess.com.

### Chess.com user

The saved `chessComUsername` setting. It does not query the network.

### Last sync

The saved `chessComLastSyncAt` setting formatted for display.

## Sync result panel

The panel appears when progress is `done`, or when imported/duplicate totals are nonzero.

| Value | Meaning |
|---|---|
| Found | Number of games returned by Chess.com monthly API responses. |
| Imported | Number of new parsed games inserted into `games`. |
| Duplicates skipped | Number of parsed games whose `(source, external_id)` already existed. |
| Invalid | Reserved progress field; current sync code does not increment it. |

`Found` can be greater than `Imported` because games may already exist, or because parsing/insertion does not produce a new row for every API game.

## Error behavior

Errors before monthly processing, such as invalid usernames, API errors, timeouts, and rate limits, are returned through the IPC result. The page displays the returned message.

Errors for individual monthly downloads or database imports are logged, counted as failed archives, and processing continues with the next archive. If every eligible archive fails, the service emits an `error` progress event and returns an explicit failure instead of saving a successful zero-game sync.

The renderer treats `error` as a terminal progress stage: it stops the syncing state, hides the progress bar, reloads status, and displays the returned IPC error message in the Sync error panel. A failed sync does not update the saved username or last-sync timestamp.

The application log is stored under the Electron user-data directory in:

```text
logs/app.log
```

The logger records sync failures, database insertion failures, settings failures, and database startup information.

## Database startup and migrations

Before the Sync tab can use the database, Electron startup runs:

1. `initDB()`, which opens `chess.db`.
2. `runMigrations()`, which creates or upgrades tables and indexes.
3. IPC handler registration.
4. Window creation.

If the database has not been initialized, `GameRepository` throws `Database not initialized. Call initDB() first.` The normal Electron startup sequence prevents this during normal use.

## Complete data-flow summary

```text
Sync.tsx
  -> window.api.sync.start(username)
  -> preload ipcRenderer.invoke('sync.start', ...)
  -> main IPC handler
  -> SyncService.sync()
  -> ChessComService
  -> Chess.com REST API
  -> PGN injection and PgnService parsing
  -> OpeningDetector
  -> GameRepository.insertMany()
  -> SQLite userData/chess.db
  -> settingsService.save()
  -> userData/chess-settings.json
  -> sync:progress IPC events
  -> Sync.tsx progress/status/result UI
```
