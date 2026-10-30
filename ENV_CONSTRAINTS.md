# Environment Constraints & Test Execution

## Container memory limitation

The sandbox container used to validate this project is severely memory-constrained.
During development, Node.js processes repeatedly hit `FATAL ERROR:
Ineffective mark-compacts near heap limit — Allocation failed — JavaScript heap out of memory`,
even for trivial commands such as `node -e` and the vitest worker.

### Impacted validations

- `npm run test` (vitest) — could not complete; the worker OOMs at setup/transform
- Runtime assertions for the PGN engine (`buildTree`, `serialize`, `PgnService`, `OpeningDetector`)
  — could not be executed because `node` OOMs before reaching user code

### What WAS verified

- `npm run typecheck` (`tsc --noEmit`) — **pass**, strict mode, full project
- `npm run lint` (`eslint . --ext ts,tsx --max-warnings 0`) — **pass**
- `npm run build` (`electron-vite build`) — **pass**, main/preload/renderer bundles produced
- Type-level correctness of chess.js API usage (`move`/`fen`/`undo`/`load`) — validated by `tsc`
- Path aliases (`@pgn`, `@openings`, `@shared`, `@renderer`, `@main`) resolve correctly in `tsc`

### What remains to verify (on a machine with sufficient RAM)

- `npm run test` — run the PGN engine test suite in `tests/pgn/pgn.test.ts`
- Runtime behavior of `buildTree` (FEN computation, UCI conversion, variation siblings, illegal-SAN error isolation)
- Runtime behavior of `serialize` (round-trip PGN including comments/variations/NAGs)
- Runtime behavior of `OpeningDetector` against `eco-sample.tsv`

### What remains to verify (on a machine with sufficient RAM)

- `npm run test` — run the PGN engine test suite in `tests/pgn/pgn.test.ts`
- Runtime behavior of `buildTree` (FEN computation, UCI conversion, variation siblings, illegal-SAN error isolation)
- Runtime behavior of `serialize` (round-trip PGN including comments/variations/NAGs)
- Runtime behavior of `OpeningDetector` against `eco-sample.tsv`

### Recommended fix

Run validation on a host with more available memory, or limit vitest heap:

```bash
NODE_OPTIONS="--max-old-space-size=1024" npx vitest run --pool=forks --poolOptions.forks.singleFork=true
```

If the container itself is the bottleneck, increase its memory allocation or use a CI runner
with higher RAM limits.

## Stockfish binaries (Phase 5)

Stockfish engine binaries are **not** downloaded or bundled in this repository. The engine
binary path resolver (`src/main/services/stockfish/EngineProcess.ts`) expects them at:

```
resources/stockfish/<platform>-<arch>/stockfish[.exe]
```

e.g. `resources/stockfish/win32-x64/stockfish.exe` and
`resources/stockfish/darwin-arm64/stockfish`.

You must obtain the official Stockfish binaries (GPLv3 license) from the Stockfish releases
and place them under `resources/stockfish/` yourself. The `electron-builder` `extraResources`
config in `package.json` copies that directory out of the asar at build time, and the runtime
resolver uses `process.resourcesPath` when packaged. Set the executable bit on macOS/Linux
binaries. Stockfish is GPLv3 — disclose this in your About/README as required by the license.

