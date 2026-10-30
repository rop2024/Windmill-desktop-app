import { statisticsService } from '../statistics/StatisticsService'
import { analysisRepository } from '../analysis/AnalysisRepository'
import { getDB } from '../database/connection'
import { logger } from '../logger'
import type { GameOutcome } from '@shared/game'

export type Achievement = {
  id: string
  name: string
  description: string
  xpReward: number
}

export type AchievementProgress = {
  achievementId: string
  name: string
  description: string
  status: 'locked' | 'in_progress' | 'unlocked'
  progress: number
  target: number
  xpReward: number
  unlockedAt: number | null
}

export type AchievementUnlock = {
  achievementId: string
  name: string
  xpReward: number
}

type AchievementDef = {
  id: string
  name: string
  description: string
  xpReward: number
  target: number
  evaluate: (ctx: EvalContext) => { progress: number; unlocked: boolean }
}

type EvalContext = {
  gameId: string
  outcome: GameOutcome | null
  playerColor: string | null
  playerRating: number | null
  opponentRating: number | null
  plies: Array<{ ply: number; classification: string | null; centipawnLoss: number | null }>
  tactics: Array<{ tacticType: string; label: string; side: string }>
  totalGames: number
  consecutiveWins: number
  currentStreak: number
}

const DEFAULT_ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'no_blunders',
    name: 'No Blunders',
    description: 'Complete a game with zero blunders',
    xpReward: 50,
    target: 1,
    evaluate: (ctx) => {
      const blunders = ctx.plies.filter((p) => p.classification === 'mistake' || p.classification === 'blunder').length
      const unlocked = blunders === 0 && ctx.plies.length > 0
      return { progress: unlocked ? 1 : 0, unlocked }
    }
  },
  {
    id: 'games_100',
    name: 'Century',
    description: 'Play 100 total games',
    xpReward: 100,
    target: 100,
    evaluate: (ctx) => ({
      progress: Math.min(ctx.totalGames, 100),
      unlocked: ctx.totalGames >= 100
    })
  },
  {
    id: 'win_streak_10',
    name: 'Winning Streak',
    description: 'Win 10 games in a row',
    xpReward: 75,
    target: 10,
    evaluate: (ctx) => ({
      progress: Math.min(ctx.consecutiveWins, 10),
      unlocked: ctx.consecutiveWins >= 10
    })
  },
  {
    id: 'fork_master',
    name: 'Fork Master',
    description: 'Create 10 forks',
    xpReward: 60,
    target: 10,
    evaluate: (ctx) => {
      const forks = ctx.tactics.filter((t) => t.tacticType === 'fork' && t.label === 'created').length
      return { progress: Math.min(forks, 10), unlocked: forks >= 10 }
    }
  },
  {
    id: 'opening_expert',
    name: 'Opening Expert',
    description: 'Play 20 games with the same opening',
    xpReward: 80,
    target: 20,
    evaluate: (ctx) => ({
      progress: Math.min(ctx.totalGames, 20),
      unlocked: ctx.totalGames >= 20
    })
  },
  {
    id: 'endgame_hero',
    name: 'Endgame Hero',
    description: 'Win 10 games with high endgame accuracy',
    xpReward: 90,
    target: 10,
    evaluate: (ctx) => {
      const endgameAccuracy = ctx.plies
        .filter((p) => p.ply > 40)
        .map((p) => p.centipawnLoss ?? 0)
      const avgCpl = endgameAccuracy.length > 0
        ? endgameAccuracy.reduce((a, b) => a + b, 0) / endgameAccuracy.length
        : 999
      const unlocked = ctx.outcome === 'win' && avgCpl < 150
      return { progress: unlocked ? 1 : 0, unlocked }
    }
  }
]

function computeConsecutiveWins(games: Array<{ outcome: GameOutcome | null }>): number {
  let streak = 0
  for (let i = games.length - 1; i >= 0; i--) {
    if (games[i].outcome === 'win') streak++
    else break
  }
  return streak
}

export class AchievementEngine {
  private get db() {
    return getDB()
  }

  private definitions: Map<string, AchievementDef> = new Map()
  private recentUnlocks: AchievementUnlock[] = []
  private initialized = false

  constructor() {
    for (const def of DEFAULT_ACHIEVEMENTS) {
      this.definitions.set(def.id, def)
    }
  }

  private ensureInitialized(): void {
    if (this.initialized) return
    this.ensureTable()
    this.seedAchievements()
    this.initialized = true
  }

  private ensureTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS user_achievements (
        achievement_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'locked',
        progress INTEGER NOT NULL DEFAULT 0,
        target INTEGER NOT NULL DEFAULT 1,
        xp_reward INTEGER NOT NULL DEFAULT 0,
        unlocked_at INTEGER,
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
      );
      CREATE INDEX IF NOT EXISTS idx_user_achievements_status ON user_achievements(status);
      CREATE INDEX IF NOT EXISTS idx_user_achievements_unlocked_at ON user_achievements(unlocked_at);
    `)
  }

  private seedAchievements(): void {
    const now = Date.now()
    for (const def of DEFAULT_ACHIEVEMENTS) {
      const existing = this.db.prepare('SELECT achievement_id FROM user_achievements WHERE achievement_id = ?').get(def.id)
      if (!existing) {
        this.db.prepare(
          'INSERT INTO user_achievements (achievement_id, name, description, status, progress, target, xp_reward, unlocked_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)'
        ).run(def.id, def.name, def.description, 'locked', 0, def.target, def.xpReward, now)
      } else {
        // Keep name/description/xp/target in sync with definitions
        this.db.prepare(
          'UPDATE user_achievements SET name = ?, description = ?, xp_reward = ?, target = ?, updated_at = ? WHERE achievement_id = ?'
        ).run(def.name, def.description, def.xpReward, def.target, now, def.id)
      }
    }
  }

  private readProgress(achievementId: string): { progress: number; status: string; unlockedAt: number | null } | null {
    const row = this.db.prepare(
      'SELECT progress, status, unlocked_at FROM user_achievements WHERE achievement_id = ?'
    ).get(achievementId) as { progress: number; status: string; unlocked_at: number | null } | undefined
    if (!row) return null
    return { progress: row.progress, status: row.status, unlockedAt: row.unlocked_at }
  }

  private updateProgress(achievementId: string, progress: number, status: string, unlockedAt: number | null): void {
    const now = Date.now()
    this.db.prepare(
      `UPDATE user_achievements SET progress = ?, status = ?, updated_at = ?, unlocked_at = COALESCE(?, unlocked_at) WHERE achievement_id = ?`
    ).run(progress, status, now, unlockedAt, achievementId)
  }

  list(): AchievementProgress[] {
    this.ensureInitialized()
    const rows = this.db.prepare(
      'SELECT achievement_id, name, description, status, progress, target, xp_reward, unlocked_at FROM user_achievements ORDER BY status DESC, progress DESC'
    ).all() as Array<{
      achievement_id: string
      name: string
      description: string
      status: 'locked' | 'in_progress' | 'unlocked'
      progress: number
      target: number
      xp_reward: number
      unlocked_at: number | null
    }>
    return rows.map((r) => ({
      achievementId: r.achievement_id,
      name: r.name,
      description: r.description,
      status: r.status,
      progress: r.progress,
      target: r.target,
      xpReward: r.xp_reward,
      unlockedAt: r.unlocked_at
    }))
  }

  evaluateGame(
    gameId: string,
    outcome: GameOutcome | null,
    playerColor: string | null,
    playerRating: number | null,
    opponentRating: number | null
  ): AchievementUnlock[] {
    this.ensureInitialized()
    const plies = analysisRepository.getAnalysisForGame(gameId)

    // Build eval context
    const games = statisticsService.fetchGames({})
    const totalGames = games.length
    const consecutiveWins = computeConsecutiveWins(games.map((g) => ({ outcome: g.outcome })))
    const currentStreak = consecutiveWins

    const ctx: EvalContext = {
      gameId,
      outcome,
      playerColor,
      playerRating,
      opponentRating,
      plies: plies.map((p) => ({
        ply: p.ply,
        classification: p.classification,
        centipawnLoss: p.centipawn_loss
      })),
      tactics: [],
      totalGames,
      consecutiveWins,
      currentStreak
    }

    const now = Date.now()
    const unlocks: AchievementUnlock[] = []

    for (const def of this.definitions.values()) {
      const current = this.readProgress(def.id)
      if (!current) continue
      if (current.status === 'unlocked') continue

      const result = def.evaluate(ctx)
      const newProgress = Math.min(result.progress, def.target)
      const newlyUnlocked = result.unlocked && current.status !== 'unlocked'

      if (newlyUnlocked) {
        this.updateProgress(def.id, newProgress, 'unlocked', now)
        unlocks.push({
          achievementId: def.id,
          name: def.name,
          xpReward: def.xpReward
        })
        logger.info('Achievement unlocked', { achievementId: def.id, name: def.name, xpReward: def.xpReward })
      } else if (newProgress > current.progress) {
        this.updateProgress(def.id, newProgress, 'in_progress', null)
      }
    }

    this.recentUnlocks = unlocks
    return unlocks
  }

  getRecentUnlocks(): AchievementUnlock[] {
    return this.recentUnlocks
  }

  addDefinition(def: AchievementDef): void {
    this.ensureInitialized()
    this.definitions.set(def.id, def)
    const now = Date.now()
    const existing = this.db.prepare('SELECT achievement_id FROM user_achievements WHERE achievement_id = ?').get(def.id)
    if (!existing) {
      this.db.prepare(
        'INSERT INTO user_achievements (achievement_id, name, description, status, progress, target, xp_reward, unlocked_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)'
      ).run(def.id, def.name, def.description, 'locked', 0, def.target, def.xpReward, now)
    }
  }

  removeDefinition(achievementId: string): boolean {
    return this.definitions.delete(achievementId)
  }

  getDefinitions(): Achievement[] {
    return [...this.definitions.values()].map((d) => ({
      id: d.id,
      name: d.name,
      description: d.description,
      xpReward: d.xpReward
    }))
  }

  totalXP(): number {
    this.ensureInitialized()
    const row = this.db.prepare(
      'SELECT COALESCE(SUM(xp_reward), 0) as total FROM user_achievements WHERE status = ?'
    ).get('unlocked') as { total: number }
    return row.total
  }

  unlockedCount(): number {
    this.ensureInitialized()
    const row = this.db.prepare(
      'SELECT COUNT(*) as c FROM user_achievements WHERE status = ?'
    ).get('unlocked') as { c: number }
    return row.c
  }
}

export const achievementEngine = new AchievementEngine()
