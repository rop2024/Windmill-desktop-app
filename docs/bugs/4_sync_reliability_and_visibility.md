# Bug 4: Sync appears broken or silently completes without games

## Investigation

The Chess.com API is reachable and returns the expected responses:

- `/pub/player/{username}/games/archives` returns archive URLs.
- `/pub/player/{username}/games/{year}/{month}` returns a `games` array containing PGN data.
- The Electron production build includes the sync service, IPC handlers, preload API, and renderer page.

The previous archive-filtering bug was also confirmed: comparing a month start with the exact last-game timestamp skipped the month containing the newest game. The implementation now compares archive months at month granularity, so that month is scanned again.

## Additional causes found

### 1. Large accounts were processed oldest-first

Chess.com returns archives in chronological order. Sync fetched every eligible month from oldest to newest, so an account with years of games could spend a long time processing old months before importing any recent games. This made the feature appear stalled and delayed visible results.

### 2. A saved username could not be reused from the Sync page

The page displayed a connected username from settings, but the **Sync now** button was disabled whenever the editable username field was empty. A user had to type the username again even when a valid saved username already existed.

### 3. Complete archive failure was reported as success

Individual archive errors were logged and ignored. If every eligible archive failed, sync still saved a timestamp and returned `{ ok: true, imported: 0, found: 0 }`. That produced a misleading **CONNECTED** state and hid the actual network/API failure from the user.

## Fixes applied

- Re-scan the month containing the last sync timestamp.
- Ignore a saved cursor when switching usernames or when no online games exist, allowing stale zero-game syncs to recover automatically.
- Process eligible archives newest-first.
- Allow the saved connected username to be used when the input is blank.
- Track archive failures and return an explicit sync error if every eligible archive fails.
- Emit an error progress event in the complete-failure case.

## Validation

- Chess.com archive and monthly API requests were tested successfully with a public account.
- `npm run typecheck` passes.
- ESLint passes for the changed sync service.
- `npm run build` passes.

The repository's `npm test` command is not currently a valid sync validation command: Vitest discovers the Playwright E2E file, causing a Playwright/Vitest mismatch and eventually a Node heap failure. No sync-specific automated tests currently exist.

## User-facing behavior after the fix

- A sync starts with the newest available month, so recent games appear sooner.
- Running sync again re-fetches the last-synced month and imports newly added games.
- If all archive requests fail, the UI shows an error instead of claiming a successful zero-game sync.
