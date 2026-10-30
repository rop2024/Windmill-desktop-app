# Chess Desktop

A desktop chess application built with **Electron**, **React**, **TypeScript**, and **Tailwind CSS**. Play, analyze, import/export PGN games, run Stockfish engine analysis, and track your statistics — all offline and local-first.

## Features

- **Game Management** — Create, browse, import, and export chess games in PGN format
- **PGN Parser** — Robust multi-game PGN parser with header parsing, move tree building (variations, comments, NAGs), FEN support, and serialization
- **Stockfish Engine Analysis** — Full-game analysis with per-ply evaluation, best move, principal variation, centipawn loss, and move classification (Best/Excellent/Good/Inaccuracy/Mistake/Blunder)
- **Opening Detection** — ECO-coded opening identification from the Lichess opening dataset
- **Statistics Dashboard** — Win rate, rating history, results by color, openings, opponents, time controls, streaks, and calendar heatmap
- **Game Explorer** — Interactive board with move list, variation navigation, FEN copy/load, comments, and eval bar
- **Database** — SQLite (better-sqlite3) with WAL mode, migrations, and online backup/restore
- **Settings** — Theme (light/dark/system), board theme, piece set, engine defaults, my usernames
- **Security** — Sandboxed renderer, context isolation, CSP, no Node integration in renderer

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Electron v31 |
| UI | React 18 + TypeScript |
| Styling | Tailwind CSS |
| State | Zustand |
| Routing | React Router (HashRouter) |
| Charts | Recharts |
| Database | better-sqlite3 (SQLite) |
| Chess Logic | chess.js |
| Build | electron-vite + electron-builder |
| Tests | Vitest + Playwright |
| Lint/Type | ESLint + TypeScript (strict) |

## Project Structure

```
chess-desktop/
├── package.json
├── electron.vite.config.ts      # Vite config for main/preload/renderer
├── tsconfig.json                # Strict TypeScript config with path aliases
├── vitest.config.ts             # Vitest configuration
├── playwright.config.ts         # Playwright E2E configuration
├── eslint.config.js             # ESLint flat config
├── tailwind.config.js           # Tailwind configuration
├── postcss.config.js            # PostCSS with Tailwind + Autoprefixer
├── ENV_CONSTRAINTS.md           # Container memory limitations note
├── resources/
│   └── stockfish/               # Stockfish binaries (you must add these)
│       ├── win32-x64/
│       ├── darwin-arm64/
│       └── linux-x64/
├── scripts/
│   └── seed.ts                  # 50k synthetic game generator (dev-only)
├── src/
│   ├── main/                    # Electron main process
│   │   ├── index.ts             # App entry, window, menu
│   │   ├── ipc/                 # IPC handlers & contracts
│   │   ├── services/
│   │   │   ├── database/        # Connection, migrations, repositories
│   │   │   ├── stockfish/       # Engine process, service, queue, UCI parser, cache
│   │   │   ├── analysis/        # Repository, move classifier, accuracy service
│   │   │   ├── statistics/      # SQL aggregates
│   │   │   ├── logger.ts        # File + console logger with secret redaction
│   │   │   └── settings.ts      # User settings persistence
│   │   └── index.ts
│   ├── preload/
│   │   └── index.ts             # contextBridge API exposed to renderer
│   ├── shared/                  # Types shared between main & renderer
│   │   ├── game.ts
│   │   ├── result.ts
│   │   ├── classifyMove.ts
│   │   └── ipc.ts
│   ├── pgn/                     # PGN engine (split, headers, tokenize, tree, serialize, flattener, service)
│   ├── openings/                # ECO opening detector
│   ├── renderer/                # React renderer process
│   │   ├── App.tsx              # Router + keyboard shortcuts
│   │   ├── components/          # ChessBoard, MoveList, EvaluationGraph, FilterBar, UI primitives
│   │   ├── pages/               # Dashboard, Games, GameNew, GameDetail, GameExplorer, Analysis, Statistics, Settings, Engine
│   │   ├── store/               # Zustand stores (game, explorer, toast)
│   │   ├── hooks/               # useKeyboardShortcuts
│   │   └── analysis/            # Renderer-side classify helpers
│   └── declarations/            # Type declarations (SQL imports, window.api)
├── tests/
│   ├── pgn/                     # PGN engine unit tests
│   └── e2e/                     # Playwright E2E smoke tests
└── tests/fixtures/
    ├── pgn/                     # PGN test fixtures (single, multi, variations, etc.)
    └── openings/                # ECO sample TSV
```

## Installation

### Prerequisites
- Node.js 18+
- npm

### 1. Clone and install
```bash
npm install
```

### 2. Add Stockfish binaries (required for analysis)
Download Stockfish binaries from the official Stockfish releases and place them in:

```
resources/stockfish/
├── win32-x64/
│   └── stockfish.exe
├── darwin-arm64/
│   └── stockfish
└── linux-x64/
    └── stockfish
```

Set the executable bit on macOS/Linux:
```bash
chmod +x resources/stockfish/darwin-arm64/stockfish
chmod +x resources/stockfish/linux-x64/stockfish
```

Stockfish is licensed under **GPLv3**. See `LICENSE` or the Stockfish website for details.

### 3. Rebuild native modules
```bash
npm run postinstall
```

## Development

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Electron + Vite dev server |
| `npm run build` | Build for production (main + preload + renderer) |
| `npm run typecheck` | TypeScript strict typecheck |
| `npm run lint` | ESLint with zero warnings |
| `npm run test` | Vitest unit tests |
| `npm run test:e2e` | Playwright E2E tests |
| `npm run seed` | Generate 50,000 synthetic games (dev-only) |

### Path Aliases
- `@shared/*` → `src/shared/*`
- `@renderer/*` → `src/renderer/*`
- `@main/*` → `src/main/*`
- `@pgn/*` → `src/pgn/*`
- `@openings/*` → `src/openings/*`
- `@stats/*` → `src/renderer/stats/*`

## Usage

### Import a PGN file
1. Click **Import PGN** (or File → Import PGN, `Ctrl/Cmd+I`)
2. Select a `.pgn` file
3. Games are parsed, deduplicated (by SHA-1 of normalized headers + movetext), and imported with opening detection

### Analyze a game
1. Open a game from the Games list
2. Click **Analyze position** in the Explorer, or go to the Analysis page
3. View eval bar, best move, PV line, and move classifications

### View statistics
- **Dashboard** — Quick overview cards, rating history, results by color
- **Statistics** — Full breakdowns: openings, opponents, time controls, streaks, calendar heatmap

### Backup / Restore
- **Backup Database** — Creates a safe online copy via SQLite's backup API
- **Restore Database** — Validates the SQLite header, replaces the DB, and re-runs migrations

## Security

- Renderer runs with `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true`
- A restrictive CSP is enforced in `index.html`
- The preload script exposes only a narrow, typed API via `contextBridge`
- Secrets (tokens, passwords) are redacted from log output
- Native modules (`better-sqlite3`) are unpacked from the ASAR archive at build time

## Packaging

The app is configured with `electron-builder` for:
- **Windows** — NSIS installer
- **macOS** — DMG (Apple Silicon + Intel)
- **Linux** — AppImage

```bash
npm run build
# Then package:
npx electron-builder
```

Stockfish binaries are copied outside the ASAR via `extraResources`, and `better-sqlite3` native bindings are unpacked via `asarUnpack`.

## License

This application is original code. It bundles Stockfish, which is licensed under the **GPLv3**. If you distribute this application, you must comply with the GPLv3 terms for the Stockfish component.

## Known Limitations

- Vitest/Playwright cannot run in memory-constrained containers (see `ENV_CONSTRAINTS.md`)
- Stockfish binaries are not bundled (GPLv3 and platform-specific); you must provide them
- The app is single-user, local-first (no cloud sync)

## Roadmap

- Cloud sync / online account integration
- Puzzle trainer
- Opening repertoire builder
- Correspondence chess
- Mobile/web companions
