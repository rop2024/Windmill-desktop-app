# Bug 1: PGN Import does not populate Opening Explorer

## Symptom
After importing games via PGN file through the Games page, the Opening Explorer page shows "No opening data. Import games to populate your opening explorer." even though games were imported successfully.

## Root Cause
In `src/main/ipc/index.ts`, the `ImportService` is instantiated without passing an `OpeningDetector`:

```typescript
handle('pgn.import', z.object({ filePath: z.string() }), async (_event, { filePath }) => {
  const service = new ImportService(emitProgress)  // <-- openingDetector is null
  const report = await service.importFile(filePath)
  return { ok: true, data: report }
})
```

The `ImportService` constructor accepts an optional `openingDetector` parameter (defaults to `null`). When null, the `OpeningDetector.detect()` call is skipped inside `importFile()`:

```typescript
if (this.openingDetector && game.root) {
  const mainLineSan = extractMainLineSan(game.root)
  const match = this.openingDetector.detect(mainLineSan)
  if (match) {
    game.headers.set('ECO', match.eco)
    game.headers.set('Opening', match.name)
    ...
  }
}
```

Most PGN files do not include an `[Opening "..."]` header tag (it's a non-standard extension). Without the `OpeningDetector` running during import, imported games are stored with no opening information.

The `OpeningExplorerService.list()` method groups games by parsing the `[Opening "..."]` PGN header via `StatisticsService.openings()`. With no `[Opening]` header stored, no openings are detected, and the explorer shows empty.

## Fix
Wire the `OpeningDetector` into the `ImportService` when creating it in the IPC handler:

```typescript
import { OpeningDetector } from '@openings/OpeningDetector'

handle('pgn.import', z.object({ filePath: z.string() }), async (_event, { filePath }) => {
  const detector = new OpeningDetector()
  // Load opening definitions (ECO/name/variation TSV) into the detector
  // ... loadFromTsv(openingData) ...
  const service = new ImportService(emitProgress, detector)
  const report = await service.importFile(filePath)
  return { ok: true, data: report }
})
```

## Additional Notes
- The `OpeningDetector` needs opening entry data (ECO codes, names, variations) loaded via `loadFromTsv()` before `detect()` can match moves. Without opening data loaded, detection will return no matches.
- Even after fixing import detection, games imported before this fix will not have opening headers. They would need to be re-imported or the opening data backfilled by running detection over existing games.
