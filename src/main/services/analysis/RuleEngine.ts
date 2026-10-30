import { getDB } from '../database/connection'
import { EventEmitter } from 'node:events'
import { logger } from '../logger'

export type RuleAction = 'increment_counter' | 'set_flag'

export type RuleSeverity = 'info' | 'warning' | 'critical'

export type Rule = {
  id: string
  when: string
  action: RuleAction
  counter?: string
  threshold?: number
  flag?: string
  severity?: RuleSeverity
  cooldown?: number
  enabled?: boolean
}

export type RuleEvent = {
  type: string
  data: unknown
  timestamp: number
  gameId?: string
  side?: 'w' | 'b'
}

export type Counter = {
  name: string
  value: number
  updatedAt: number
}

export type Flag = {
  id: number
  ruleId: string
  flag: string
  severity: RuleSeverity
  counterName: string | null
  counterValue: number | null
  triggeredAt: number
  gameId: string | null
  acknowledged: boolean
}

const DEFAULT_RULES: Rule[] = [
  {
    id: 'missed_fork_training',
    when: 'tactic.missed.fork',
    action: 'increment_counter',
    counter: 'fork_missed',
    threshold: 10,
    flag: 'NEED_TACTICS_TRAINING',
    severity: 'warning',
    cooldown: 60000,
    enabled: true
  },
  {
    id: 'blunder_review',
    when: 'classification.blunder',
    action: 'increment_counter',
    counter: 'blunder_total',
    threshold: 5,
    flag: 'REVIEW_BLUNDERS',
    severity: 'warning',
    cooldown: 60000,
    enabled: true
  },
  {
    id: 'missed_pin_training',
    when: 'tactic.missed.pin',
    action: 'increment_counter',
    counter: 'pin_missed',
    threshold: 8,
    flag: 'NEED_PIN_TRAINING',
    severity: 'warning',
    cooldown: 60000,
    enabled: true
  },
  {
    id: 'hanging_piece_alert',
    when: 'tactic.missed.hanging',
    action: 'increment_counter',
    counter: 'hanging_missed',
    threshold: 6,
    flag: 'HANGING_PIECE_ALERT',
    severity: 'info',
    cooldown: 60000,
    enabled: true
  },
  {
    id: 'game_analyzed_tracker',
    when: 'game.analyzed',
    action: 'increment_counter',
    counter: 'games_analyzed',
    enabled: true
  }
]

function matchesPattern(pattern: string, value: string): boolean {
  const parts = pattern.split('.')
  const valueParts = value.split('.')
  if (parts.length !== valueParts.length) return false
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] === '*') continue
    if (parts[i] !== valueParts[i]) return false
  }
  return true
}

export class RuleEngine extends EventEmitter {
  private rules: Map<string, Rule> = new Map()
  private counters: Map<string, { value: number; updatedAt: number }> = new Map()
  private lastFlagTime: Map<string, number> = new Map()
  private get db() {
    return getDB()
  }
  private initialized = false

  private ensureInitialized(): void {
    if (this.initialized) return
    this.loadCounters()
    this.seedDefaultRules()
    this.initialized = true
    logger.info('RuleEngine initialized', { rules: this.rules.size, counters: this.counters.size })
  }

  private loadCounters(): void {
    const rows = this.db.prepare('SELECT name, value, updated_at FROM rule_counters').all() as Array<{
      name: string
      value: number
      updated_at: number
    }>
    for (const row of rows) {
      this.counters.set(row.name, { value: row.value, updatedAt: row.updated_at })
    }
  }

  private saveCounter(name: string, value: number): void {
    const now = Date.now()
    this.db.prepare(
      'INSERT INTO rule_counters (name, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(name) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at'
    ).run(name, value, now)
    this.counters.set(name, { value, updatedAt: now })
  }

  private incrementCounter(name: string, by = 1): { value: number; updatedAt: number } {
    const current = this.counters.get(name)
    const value = (current?.value ?? 0) + by
    this.saveCounter(name, value)
    return { value, updatedAt: Date.now() }
  }

  private getCounter(name: string): { value: number; updatedAt: number } {
    return this.counters.get(name) ?? { value: 0, updatedAt: 0 }
  }

  private seedDefaultRules(): void {
    for (const rule of DEFAULT_RULES) {
      this.rules.set(rule.id, rule)
    }
  }

  addRule(rule: Rule): void {
    this.ensureInitialized()
    this.rules.set(rule.id, rule)
    logger.info('Rule added', { ruleId: rule.id, when: rule.when })
  }

  removeRule(ruleId: string): boolean {
    this.ensureInitialized()
    return this.rules.delete(ruleId)
  }

  getRules(): Rule[] {
    this.ensureInitialized()
    return [...this.rules.values()]
  }

  getCounters(): Counter[] {
    this.ensureInitialized()
    return [...this.counters.entries()].map(([name, c]) => ({ name, value: c.value, updatedAt: c.updatedAt }))
  }

  getCounterValue(name: string): number {
    this.ensureInitialized()
    return this.getCounter(name).value
  }

  getFlags(acknowledged?: boolean): Flag[] {
    this.ensureInitialized()
    let sql = 'SELECT id, rule_id, flag, severity, counter_name, counter_value, triggered_at, game_id, acknowledged FROM rule_flags'
    const params: unknown[] = []
    if (acknowledged !== undefined) {
      sql += ' WHERE acknowledged = ?'
      params.push(acknowledged ? 1 : 0)
    }
    sql += ' ORDER BY triggered_at DESC'
    const rows = this.db.prepare(sql).all(params) as Array<{
      id: number
      rule_id: string
      flag: string
      severity: RuleSeverity
      counter_name: string | null
      counter_value: number | null
      triggered_at: number
      game_id: string | null
      acknowledged: number
    }>
    return rows.map((r) => ({
      id: r.id,
      ruleId: r.rule_id,
      flag: r.flag,
      severity: r.severity,
      counterName: r.counter_name,
      counterValue: r.counter_value,
      triggeredAt: r.triggered_at,
      gameId: r.game_id,
      acknowledged: r.acknowledged === 1
    }))
  }

  acknowledgeFlag(flagId: number): boolean {
    this.ensureInitialized()
    const info = this.db.prepare('UPDATE rule_flags SET acknowledged = 1 WHERE id = ?').run(flagId)
    return info.changes > 0
  }

  private canEmit(ruleId: string): boolean {
    const now = Date.now()
    const last = this.lastFlagTime.get(ruleId)
    const rule = this.rules.get(ruleId)
    const cooldown = rule?.cooldown ?? 0
    if (last != null && now - last < cooldown) return false
    this.lastFlagTime.set(ruleId, now)
    return true
  }

  private emitFlag(
    rule: Rule,
    counter: { value: number; updatedAt: number } | null,
    event: RuleEvent
  ): Flag {
    const now = Date.now()
    const flag: Flag = {
      id: 0,
      ruleId: rule.id,
      flag: rule.flag ?? rule.id,
      severity: rule.severity ?? 'info',
      counterName: counter ? null : null,
      counterValue: counter ? counter.value : null,
      triggeredAt: now,
      gameId: event.gameId ?? null,
      acknowledged: false
    }

    const info = this.db.prepare(
      `INSERT INTO rule_flags (rule_id, flag, severity, counter_name, counter_value, triggered_at, game_id, acknowledged)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0)`
    ).run(
      rule.id,
      flag.flag,
      flag.severity,
      flag.counterName,
      flag.counterValue,
      flag.triggeredAt,
      flag.gameId
    )
    flag.id = info.lastInsertRowid as number

    this.emit('rule:flag', { flag, rule, event })
    logger.info('Rule flag triggered', { ruleId: rule.id, flag: flag.flag, counter: flag.counterName })
    return flag
  }

  evaluate(event: RuleEvent): Flag[] {
    this.ensureInitialized()
    const triggered: Flag[] = []

    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue
      if (!matchesPattern(rule.when, event.type)) continue

      if (rule.action === 'increment_counter' && rule.counter) {
        const counter = this.incrementCounter(rule.counter)
        if (rule.threshold != null && counter.value >= rule.threshold) {
          if (!this.canEmit(rule.id)) continue
          triggered.push(this.emitFlag(rule, counter, event))
        }
      }

      if (rule.action === 'set_flag' && rule.flag) {
        if (!this.canEmit(rule.id)) continue
        triggered.push(this.emitFlag(rule, null, event))
      }
    }

    return triggered
  }

  handleGameAnalysis(gameId: string, plies: Array<{ ply: number; classification: string | null; centipawnLoss: number | null }>): Flag[] {
    const triggered: Flag[] = []
    for (const ply of plies) {
      if (!ply.classification) continue
      triggered.push(
        ...this.evaluate({
          type: `classification.${ply.classification}`,
          data: { ply: ply.ply, centipawnLoss: ply.centipawnLoss },
          timestamp: Date.now(),
          gameId,
          side: ply.ply % 2 === 1 ? 'w' : 'b'
        })
      )
    }
    triggered.push(
      ...this.evaluate({
        type: 'game.analyzed',
        data: { plyCount: plies.length },
        timestamp: Date.now(),
        gameId
      })
    )
    return triggered
  }

  handleTacticsDetected(gameId: string, tactics: Array<{ tacticType: string; label: string; side: string }>): Flag[] {
    const triggered: Flag[] = []
    for (const t of tactics) {
      if (t.label !== 'created' && t.label !== 'missed') continue
      triggered.push(
        ...this.evaluate({
          type: `tactic.${t.label}.${t.tacticType}`,
          data: { tacticType: t.tacticType, label: t.label },
          timestamp: Date.now(),
          gameId,
          side: t.side as 'w' | 'b'
        })
      )
    }
    return triggered
  }
}

export const ruleEngine = new RuleEngine()
