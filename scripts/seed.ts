/**
 * Seed script — generates 50,000 synthetic games for performance testing.
 * Dev-only. Run with: npx tsx scripts/seed.ts [--db path/to/chess.db] [--count 50000]
 * Requires the database schema (migrations 001 + 002) to already exist.
 */
import Database from 'better-sqlite3'
import { createHash } from 'node:crypto'
import { join } from 'node:path'

const DEFAULT_COUNT = 50000
const BATCH = 500

const FIRST_NAMES = [
  'Magnus', 'Hikaru', 'Fabiano', 'Ian', 'Ding', 'Alireza', 'Wesley', 'Anish',
  'Levon', 'Teimour', 'Alexander', 'Maxime', 'Viswanathan', 'Vladimir', 'Sergey'
]
const LAST_NAMES = [
  'Carlsen', 'Nakamura', 'Caruana', 'Nepomniachtchi', 'Liren', 'Firouzja',
  'So', 'Firouzja', 'Giri', 'Grischuk', 'Radjabov', 'Vachier-Lagrave',
  'Anand', 'Kramnik', 'Tomashevsky'
]
const OPENINGS = [
  { eco: 'C50', name: "Giuoco Piano", moves: '1. e4 e5 2. Nf3 Nc6 3. Bc4' },
  { eco: 'C55', name: "Two Knights Defense", moves: '1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6' },
  { eco: 'C65', name: "Ruy Lopez", moves: '1. e4 e5 2. Nf3 Nc6 3. Bb5' },
  { eco: 'C78', name: "Ruy Lopez Closed", moves: '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7' },
  { eco: 'D20', name: "Queen's Gambit", moves: '1. d4 d5 2. c4' },
  { eco: 'A00', name: "Reti Opening", moves: '1. Nf3' },
  { eco: 'B20', name: "Sicilian Defense", moves: '1. e4 c5' },
  { eco: 'A10', name: "English Opening", moves: '1. c4' },
  { eco: 'C00', name: "King's Pawn Opening", moves: '1. e4' },
  { eco: 'D00', name: "Queen's Pawn Game", moves: '1. d4' }
]
const RESULTS: Array<'win' | 'loss' | 'draw'> = ['win', 'loss', 'draw']
const SOURCES: Array<'local' | 'online' | 'engine'> = ['local', 'online', 'engine']

function randItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomName(): string {
  return `${randItem(FIRST_NAMES)} ${randItem(LAST_NAMES)}`
}

function randomDate(): number {
  const start = new Date(2023, 0, 1).getTime()
  const end = new Date(2026, 11, 31).getTime()
  return randInt(start, end)
}

function computeExternalId(headers: Record<string, string>, movetext: string): string {
  const sorted = Object.entries(headers).sort(([a], [b]) => a.localeCompare(b))
  const payload = JSON.stringify(sorted) + '|' + movetext.trim()
  return createHash('sha1').update(payload).digest('hex')
}

function generateGame(index: number): {
  id: string
  whitePlayer: string
  blackPlayer: string
  result: string
  pgn: string
  source: string
  externalId: string
  createdAt: number
  updatedAt: number
  moves: Array<{ san: string; fenBefore: string; fenAfter: string }>
} {
  const opening = randItem(OPENINGS)
  const whitePlayer = randomName()
  const blackPlayer = randomName()
  const result = randItem(RESULTS)
  const source = randItem(SOURCES)
  const createdAt = randomDate()
  const updatedAt = createdAt + randInt(0, 86400000)

  const headers: Record<string, string> = {
    Event: 'Synthetic Tournament',
    Site: 'Generated',
    Date: new Date(createdAt).toISOString().slice(0, 10).replace(/-/g, '.'),
    Round: String(randInt(1, 10)),
    White: whitePlayer,
    Black: blackPlayer,
    Result: result,
    ECO: opening.eco,
    Opening: opening.name
  }

  const movetext = `${opening.moves} ${result}`
  const externalId = computeExternalId(headers, movetext)
  const id = `seed-${index}`

  const pgn = Object.entries(headers)
    .map(([k, v]) => `[${k} "${v}"]`)
    .concat('', movetext, '')
    .join('\n')

  // build synthetic move rows from opening moves
  const moveParts = opening.moves.split(/\s+/)
  const moves: Array<{ san: string; fenBefore: string; fenAfter: string }> = []
  let ply = 0
  let fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
  for (const part of moveParts) {
    if (/^\d+\.+$/.test(part)) continue
    if (part === result) continue
    ply++
    const fenAfter = `rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR ${ply % 2 === 1 ? 'b' : 'w'} KQkq - 0 ${Math.floor(ply / 2) + 1}`
    moves.push({ san: part, fenBefore: fen, fenAfter })
    fen = fenAfter
  }

  return { id, whitePlayer, blackPlayer, result, pgn, source, externalId, createdAt, updatedAt, moves }
}

async function main() {
  const args = process.argv.slice(2)
  const dbPathArg = args.find((a) => a.startsWith('--db='))?.split('=')[1]
  const countArg = args.find((a) => a.startsWith('--count='))?.split('=')[1]
  const dbPath = dbPathArg ?? join(process.cwd(), 'chess.db')
  const count = countArg ? Number(countArg) : DEFAULT_COUNT

  if (Number.isNaN(count) || count <= 0) {
    console.error('Invalid --count value')
    process.exit(1)
  }

  console.log(`Seeding ${count} games into ${dbPath}`)

  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  // Ensure schema exists (idempotent)
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY,
      white_player TEXT NOT NULL,
      black_player TEXT NOT NULL,
      result TEXT NOT NULL,
      pgn TEXT NOT NULL,
      source TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      external_id TEXT
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_games_external ON games(source, external_id);
    CREATE TABLE IF NOT EXISTS game_moves (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
      move_number INTEGER NOT NULL,
      san TEXT NOT NULL,
      fen TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      UNIQUE(game_id, move_number)
    );
    CREATE TABLE IF NOT EXISTS sync_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `)

  const existing = db.prepare('SELECT COUNT(*) as c FROM games').get() as { c: number }
  if (existing.c > 0) {
    console.log(`Database already has ${existing.c} games. Aborting to avoid duplicates.`)
    db.close()
    return
  }

  const insertGame = db.prepare(
    'INSERT INTO games (id, white_player, black_player, result, pgn, source, created_at, updated_at, external_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  )
  const insertMove = db.prepare(
    'INSERT INTO game_moves (game_id, move_number, san, uci, fen_before, fen_after, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  )

  let inserted = 0
  const start = Date.now()

  for (let batchStart = 0; batchStart < count; batchStart += BATCH) {
    const batchEnd = Math.min(batchStart + BATCH, count)
    const tx = db.transaction(() => {
      for (let i = batchStart; i < batchEnd; i++) {
        const g = generateGame(i)
        insertGame.run(
          g.id, g.whitePlayer, g.blackPlayer, g.result, g.pgn, g.source,
          g.createdAt, g.updatedAt, g.externalId
        )
        let ply = 0
        for (const m of g.moves) {
          ply++
          insertMove.run(g.id, ply, m.san, null, m.fenBefore, m.fenAfter, g.createdAt)
        }
        inserted++
      }
    })
    tx()
    if (batchEnd % 5000 === 0 || batchEnd === count) {
      console.log(`  inserted ${batchEnd}/${count} (${Math.round((batchEnd / count) * 100)}%)`)
    }
  }

  db.close()
  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  console.log(`Done: inserted ${inserted} games in ${elapsed}s`)
}

main().catch((e) => {
  console.error('Seed failed:', e)
  process.exit(1)
})
