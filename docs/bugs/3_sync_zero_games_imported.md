# Bug 2: Sync shows "CONNECTED" but 0 games found/imported

## Symptom

After clicking "Sync now" with a valid Chess.com username:
- Status shows **CONNECTED** with the correct username
- **Total games: 0**, **From Chess.com: 0**
- Sync result: **Found: 0, Imported: 0, Duplicates: 0**
- Debug panel shows **No sync events yet**
- Games are never stored in `chess.db`, so Opening Explorer shows nothing

## Root Cause

The bug is in `src/main/services/sync/SyncService.ts`, in the archive filtering logic (lines 71-79):

```typescript
for (const archiveUrl of archives) {
  const match = archiveUrl.match(/\/games\/(\d{4})\/(\d{1,2})\/?$/)
  if (!match) continue
  const year = parseInt(match[1], 10)
  const month = parseInt(match[2], 10)
  const monthStart = new Date(year, month - 1, 1).getTime()
  if (lastSyncAt && monthStart <= lastSyncAt) continue
  eligibleArchives.push(archiveUrl)
}
```

`lastSyncAt` is stored as the **exact millisecond timestamp of the newest game** (line 215: `chessComLastSyncAt: newestGameTime`). 

When filtering archives, **any archive whose month-start is on or before `lastSyncAt` is skipped**. Since `monthStart` is the 1st of the month (e.g., October 1 at 00:00:00) and `lastSyncAt` is sometime during that same month (e.g., October 31 at 10:59 AM), the condition `monthStart <= lastSyncAt` is **always true** for the current month. The entire current month's archive is skipped, even though it contains games newer than the last sync.

**Result:** No archives are eligible → `eligibleArchives.length === 0` → `found: 0, imported: 0` → games never reach `chess.db`.

## Why the UI shows "CONNECTED"

`SyncService.status()` (used by the Sync page) only checks:
- `settings.chessComUsername` — set during the first successful sync
- `settings.chessComLastSyncAt` — set during the first successful sync

These get saved even when zero games are imported (line 93-97 in the empty-archives branch), so the UI thinks sync "worked" even though no games were actually fetched.

## Why the Debug Panel shows nothing

The `SyncService` calls `this.sendProgress?.()` with progress updates, and the IPC `sync.start` handler forwards them via `syncProgressSender`. The `DebugContext` listens to `window.api.sync.onProgress()`. However:

1. **No sync events fire** because `eligibleArchives.length === 0` — the code returns early at line 107 with `found: 0` before any per-archive progress events are emitted.
2. Even if events fired, the dev server must be restarted to load the new `DebugContext`/`DebugPanel` files.

## Fix Required

**Option A** — Store `lastSyncAt` as the start of the *next* month after the newest game, not the exact game timestamp:

```typescript
// In SyncService.sync(), after finding newestGameTime:
const newestDate = new Date(newestGameTime)
const nextMonthStart = new Date(newestDate.getFullYear(), newestDate.getMonth() + 1, 1).getTime()
await settingsService.save({
  chessComUsername: username,
  chessComLastSyncAt: nextMonthStart
})
```

**Option B** — Compare archive months by month granularity, not exact timestamp:

```typescript
if (lastSyncAt) {
  const lastSyncDate = new Date(lastSyncAt)
  const lastSyncMonthStart = new Date(lastSyncDate.getFullYear(), lastSyncDate.getMonth(), 1).getTime()
  if (monthStart <= lastSyncMonthStart) continue
}
```

Either approach ensures the current month's archive is always re-scanned on the next sync, picking up any new games played since the last sync.
