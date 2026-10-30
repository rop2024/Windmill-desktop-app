import Database from 'better-sqlite3'
import { getDB } from '../database/connection'
import type { AnalyzedPly } from '../stockfish/AnalysisQueue'

export type StoredAnalysisPly = {
  id: number
  game_id: string
  ply: number
  fen_before: string
  fen_after: string
  score_cp: number | null
  score_mate: number | null
  bestmove: string | null
  pv: string[] | null
  depth: number | null
  centipawn_loss: number | null
  classification: string | null
  analyzed_at: number
}

export class AnalysisRepository {
  private get db(): Database.Database {
    return getDB()
  }

  async storePly(gameId: string, ply: AnalyzedPly): Promise<void> {
    const score = ply.score
    const score_cp = score?.type === 'cp' ? score.value : null
    const score_mate = score?.type === 'mate' ? score.value : null

    const existing = this.db
      .prepare('SELECT id FROM engine_analysis WHERE game_id = ? AND ply = ?')
      .get(gameId, ply.ply) as { id: number } | undefined

    const pvJson = JSON.stringify(ply.pv)
    const now = Date.now()

    if (existing) {
      this.db.prepare(
        'UPDATE engine_analysis SET fen_after = ?, score_cp = ?, score_mate = ?, bestmove = ?, pv = ?, depth = ?, centipawn_loss = ?, classification = ?, analyzed_at = ? WHERE id = ?'
      ).run(
        ply.fenAfter,
        score_cp,
        score_mate,
        ply.bestmove,
        pvJson,
        ply.depth,
        ply.centipawnLoss,
        ply.classification,
        now,
        existing.id
      )
    } else {
      this.db.prepare(
        'INSERT INTO engine_analysis (game_id, ply, fen_before, fen_after, score_cp, score_mate, bestmove, pv, depth, centipawn_loss, classification, analyzed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(
        gameId,
        ply.ply,
        ply.fenBefore,
        ply.fenAfter,
        score_cp,
        score_mate,
        ply.bestmove,
        pvJson,
        ply.depth,
        ply.centipawnLoss,
        ply.classification,
        now
      )
    }
  }

  getAnalysisForGame(gameId: string): StoredAnalysisPly[] {
    const rows = this.db.prepare(
      'SELECT * FROM engine_analysis WHERE game_id = ? ORDER BY ply ASC'
    ).all(gameId) as StoredAnalysisPly[]
    return rows.map((r) => ({
      ...r,
      pv: r.pv ? JSON.parse(String(r.pv)) : null
    }))
  }

  getAnalysisCount(): number {
    const row = this.db.prepare('SELECT COUNT(*) as c FROM engine_analysis').get() as { c: number }
    return row.c
  }

  getUnanalyzedGameCount(): number {
    const row = this.db.prepare(
      'SELECT COUNT(DISTINCT g.id) as c FROM games g LEFT JOIN engine_analysis ea ON g.id = ea.game_id WHERE ea.id IS NULL'
    ).get() as { c: number }
    return row.c
  }
}

export const analysisRepository = new AnalysisRepository()
