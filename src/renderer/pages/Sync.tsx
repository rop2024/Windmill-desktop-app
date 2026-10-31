import { useCallback, useEffect, useState } from 'react'
import { Panel } from '../components/ui/Panel'
import { KpiCard } from '../components/ui/KpiCard'
import { PrimaryButton } from '../components/ui/PrimaryButton'
import { ProgressBar } from '../components/ui/ProgressBar'
import { StatusLabel } from '../components/ui/StatusLabel'

type SyncStatus = {
  username: string | null
  lastSyncAt: number | null
  totalGames: number
  onlineGames: number
}

type SyncProgress = {
  stage: string
  processed: number
  total: number
  found: number
  imported: number
  duplicates: number
  invalid: number
  currentMonth?: string
  username?: string | null
}

export default function Sync() {
  const [status, setStatus] = useState<SyncStatus>({
    username: null,
    lastSyncAt: null,
    totalGames: 0,
    onlineGames: 0
  })
  const [progress, setProgress] = useState<SyncProgress | null>(null)
  const [username, setUsername] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadStatus = useCallback(async () => {
    try {
      const result = await window.api.sync.status()
      if (result.ok) setStatus(result.data)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    loadStatus()
  }, [loadStatus])

  useEffect(() => {
    const unsub = window.api.sync.onProgress((p: unknown) => {
      const progress = p as SyncProgress
      setProgress(progress)
      setSyncing(progress.stage !== 'done' && progress.stage !== 'idle' && progress.stage !== 'error')
      if (progress.stage === 'done' || progress.stage === 'idle' || progress.stage === 'error') {
        loadStatus()
      }
    })
    return () => unsub()
  }, [loadStatus])

  const handleSync = async () => {
    setError(null)
    setProgress(null)
    const user = username.trim() || status.username
    if (!user) {
      setError('Enter a Chess.com username first')
      return
    }
    setSyncing(true)
    try {
      const result = await window.api.sync.start(user)
      if (!result.ok) {
        setError(result.error.message)
        setSyncing(false)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setSyncing(false)
    }
  }

  const handleCancel = async () => {
    await window.api.sync.cancel()
    setSyncing(false)
    setProgress(null)
  }

  const formatDate = (ts: number | null): string => {
    if (!ts) return 'never'
    return new Date(ts).toLocaleString()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1">
        <span className="font-mono text-filter uppercase text-cyan">// sync</span>
        <h1 className="text-page-title font-sans font-bold uppercase text-text-primary">
          Sync
        </h1>
      </div>

      <Panel accent="cyan" label="Chess.com account">
        <div className="space-y-3">
          <div className="flex flex-col gap-1">
            <span className="font-mono text-filter uppercase text-text-muted text-xs">Username</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. hikaru"
              className="w-full bg-panel border border-border rounded-none px-3 py-2 text-sm font-mono text-text-primary focus:border-cyan focus:outline-none focus:ring-0"
            />
          </div>
          <div className="flex gap-3">
            <PrimaryButton onClick={handleSync} disabled={syncing || (!username.trim() && !status.username)}>
              {syncing ? 'Syncing…' : 'Sync now'}
            </PrimaryButton>
            <button
              onClick={handleCancel}
              disabled={!syncing}
              className="bg-transparent border border-border rounded-none px-3 py-2 text-xs font-mono text-cyan uppercase hover:border-cyan focus-visible:outline-2 focus-visible:outline-cyan disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Cancel
            </button>
          </div>
          {error && (
            <div className="text-pink text-xs font-mono">{error}</div>
          )}
          {status.username && (
            <div className="flex justify-between text-xs mb-1">
              <span className="text-text-muted font-mono uppercase">Connected user</span>
              <span className="text-text-primary font-mono">{status.username}</span>
            </div>
          )}
        </div>
      </Panel>

      <Panel accent="cyan" label="Sync status">
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-text-muted font-mono uppercase text-xs">Status</span>
            <StatusLabel accent={syncing ? 'magenta' : status.username ? 'green' : 'pink'}>
              {syncing ? 'SYNCING…' : status.username ? 'CONNECTED' : 'DISCONNECTED'}
            </StatusLabel>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-text-muted font-mono uppercase text-xs">Last sync</span>
            <span className="text-text-primary font-mono">{formatDate(status.lastSyncAt)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-text-muted font-mono uppercase text-xs">Source</span>
            <span className="text-text-primary font-mono">Chess.com → chess.db</span>
          </div>
          {progress && progress.stage !== 'done' && progress.stage !== 'idle' && progress.stage !== 'error' && (
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-text-muted font-mono uppercase">Progress</span>
                <span className="text-text-primary font-mono">
                  {progress.processed} / {progress.total}
                </span>
              </div>
              {progress.currentMonth && (
                <span className="text-text-dim text-xs font-mono block mb-1">
                  {progress.currentMonth}
                </span>
              )}
              <ProgressBar
                value={progress.total > 0 ? (progress.processed / progress.total) * 100 : 0}
                accent="cyan"
              />
            </div>
          )}
        </div>
      </Panel>

      <div className="wm-grid-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <KpiCard accent="cyan" value={status.totalGames.toLocaleString()} label="Total games" />
        <KpiCard
          accent="green"
          value={status.onlineGames.toLocaleString()}
          label="From Chess.com"
          sub="synced games"
        />
        <KpiCard accent="magenta" value={status.username || '—'} label="Chess.com user" />
        <KpiCard
          accent="yellow"
          value={formatDate(status.lastSyncAt)}
          label="Last sync"
          sub="timestamp"
        />
      </div>

      {progress && progress.stage === 'error' && error && (
        <Panel accent="pink" label="Sync error">
          <div className="text-pink text-xs font-mono">{error}</div>
        </Panel>
      )}

      {progress && (progress.stage === 'done' || progress.imported > 0 || progress.duplicates > 0) && (
        <Panel accent="green" label="Sync result">
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-text-muted font-mono uppercase">Found</span>
              <span className="text-text-primary font-mono">{progress.found}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-text-muted font-mono uppercase">Imported</span>
              <span className="text-green font-mono font-bold">{progress.imported}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-text-muted font-mono uppercase">Duplicates skipped</span>
              <span className="text-yellow font-mono font-bold">{progress.duplicates}</span>
            </div>
            {progress.invalid > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-text-muted font-mono uppercase">Invalid</span>
                <span className="text-pink font-mono font-bold">{progress.invalid}</span>
              </div>
            )}
          </div>
        </Panel>
      )}

      <div className="text-text-dim text-xs font-mono">
        <p>Database: chess.db</p>
        <p>Environment: Electron (local-first)</p>
      </div>
    </div>
  )
}
