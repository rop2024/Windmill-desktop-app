import { useCallback, useEffect, useState } from 'react'
import { Panel } from '../components/ui/Panel'
import { KpiCard } from '../components/ui/KpiCard'

type AchievementProgress = {
  achievementId: string
  name: string
  description: string
  status: 'locked' | 'in_progress' | 'unlocked'
  progress: number
  target: number
  xpReward: number
  unlockedAt: number | null
}

const STATUS_COLOR: Record<string, string> = {
  locked: 'text-text-muted',
  in_progress: 'text-yellow',
  unlocked: 'text-green'
}

const STATUS_LABEL: Record<string, string> = {
  locked: 'Locked',
  in_progress: 'In Progress',
  unlocked: 'Unlocked'
}

function fmtDate(ms: number | null): string {
  if (!ms) return '—'
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function Achievements() {
  const [loading, setLoading] = useState(false)
  const [achievements, setAchievements] = useState<AchievementProgress[]>([])
  const [error, setError] = useState<string | null>(null)

  const loadAchievements = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await window.api.achievements.list()
      if (res.ok) setAchievements(res.data)
      else setError(res.error?.message ?? 'Failed to load achievements')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAchievements()
  }, [loadAchievements])

  const unlockedCount = achievements.filter((a) => a.status === 'unlocked').length
  const inProgressCount = achievements.filter((a) => a.status === 'in_progress').length
  const totalXP = achievements
    .filter((a) => a.status === 'unlocked')
    .reduce((sum, a) => sum + a.xpReward, 0)

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-text-muted font-mono text-sm">
        Loading achievements…
      </div>
    )
  }

  return (
    <div className="bg-background min-h-screen space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-filter uppercase text-cyan">// achievements</span>
          <h1 className="text-page-title font-sans font-bold uppercase text-text-primary">
            Achievements
          </h1>
        </div>
      </div>

      <div className="wm-grid-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <KpiCard accent="green" value={unlockedCount} label="Unlocked" />
        <KpiCard accent="yellow" value={inProgressCount} label="In progress" />
        <KpiCard accent="cyan" value={achievements.length} label="Total" />
        <KpiCard accent="magenta" value={totalXP} label="Total XP" />
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 w-full lg:w-2/3">
          <Panel accent="magenta" label="Your achievements">
            <div className="space-y-2">
              {achievements.length > 0 ? (
                achievements.map((a) => (
                  <div
                    key={a.achievementId}
                    className={`flex items-center justify-between px-3 py-2 border-b border-border/50 last:border-0 bg-white/5 rounded-none ${a.status === 'unlocked' ? 'border-l-2 border-l-green' : ''}`}
                  >
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-mono font-bold ${STATUS_COLOR[a.status]}`}>
                          {a.name}
                        </span>
                        <span className={`text-[10px] font-mono ${STATUS_COLOR[a.status]}`}>
                          {STATUS_LABEL[a.status]}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-text-muted">{a.description}</span>
                    </div>
                    <div className="flex items-center gap-3 text-right">
                      <div className="flex flex-col items-end">
                        <span className="text-xs font-mono text-text-primary">
                          {a.progress} / {a.target}
                        </span>
                        <span className="text-[10px] font-mono text-text-muted">+{a.xpReward} XP</span>
                      </div>
                      <div className="w-24">
                        <div className="w-full bg-white/10 rounded-none h-1.5 overflow-hidden">
                          <div
                            className="h-full"
                            style={{
                              width: `${Math.min((a.progress / a.target) * 100, 100)}%`,
                              backgroundColor:
                                a.status === 'unlocked' ? '#10b981' : a.status === 'in_progress' ? '#fbbf24' : '#94a3b8'
                            }}
                          />
                        </div>
                      </div>
                      {a.unlockedAt && (
                        <span className="text-[10px] font-mono text-text-muted">
                          {fmtDate(a.unlockedAt)}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-text-muted text-xs font-mono py-4 text-center">
                  No achievements defined yet.
                </div>
              )}
            </div>
          </Panel>
        </div>

        <div className="flex-none lg:w-1/3">
          <Panel accent="cyan" label="Recent unlocks">
            <div className="space-y-2">
              {achievements
                .filter((a) => a.status === 'unlocked' && a.unlockedAt)
                .map((a) => (
                  <div key={a.achievementId} className="flex items-center justify-between px-2 py-1.5 border-b border-border/50 last:border-0">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-mono font-bold text-green">{a.name}</span>
                      <span className="text-[10px] font-mono text-text-muted">+{a.xpReward} XP</span>
                    </div>
                    <span className="text-xs font-mono text-text-primary">🏆</span>
                  </div>
                ))}
              {achievements.filter((a) => a.status === 'unlocked').length === 0 && (
                <div className="text-text-muted text-xs font-mono py-2 text-center">No unlocks yet.</div>
              )}
            </div>
          </Panel>

          <Panel accent="orange" label="Progress">
            <div className="space-y-3">
              <div className="flex justify-between items-center px-2 py-1.5 border-b border-border/50">
                <span className="text-xs font-mono text-text-muted">Unlocked</span>
                <span className="text-xs font-mono text-green">{unlockedCount}</span>
              </div>
              <div className="flex justify-between items-center px-2 py-1.5 border-b border-border/50">
                <span className="text-xs font-mono text-text-muted">In progress</span>
                <span className="text-xs font-mono text-yellow">{inProgressCount}</span>
              </div>
              <div className="flex justify-between items-center px-2 py-1.5 border-b border-border/50">
                <span className="text-xs font-mono text-text-muted">Total XP</span>
                <span className="text-xs font-mono text-magenta">{totalXP}</span>
              </div>
              <div className="flex justify-between items-center px-2 py-1.5">
                <span className="text-xs font-mono text-text-muted">Completion</span>
                <span className="text-xs font-mono text-text-primary">
                  {achievements.length > 0 ? Math.round((unlockedCount / achievements.length) * 100) : 0}%
                </span>
              </div>
            </div>
          </Panel>
        </div>
      </div>

      {error && (
        <div className="fixed bottom-4 right-4 bg-pink/10 border border-pink/30 text-pink text-xs font-mono px-3 py-2 rounded-none">
          {error}
        </div>
      )}
    </div>
  )
}
