import { useCallback, useEffect, useState } from 'react'
import type { AppSettings } from '@shared/game'
import { Panel } from '../components/ui/Panel'
import { KpiCard } from '../components/ui/KpiCard'
import { PrimaryButton } from '../components/ui/PrimaryButton'
import { ProgressBar } from '../components/ui/ProgressBar'
import { StatusLabel } from '../components/ui/StatusLabel'
import { FilterChip } from '../components/ui/FilterChip'
import { useTheme } from '../context/ThemeContext'
import { useBoardTheme } from '../context/BoardThemeContext'

const THEME_OPTIONS = ['system', 'dark', 'light'] as const
const BOARD_THEME_OPTIONS = ['cyberpunk'] as const
const PIECE_SET_OPTIONS = ['classic', 'neo', 'alpha', 'tatiana'] as const

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

type ReportType = 'weekly' | 'monthly' | 'opening' | 'tournament'
type ReportFormat = 'html' | 'markdown'

const TYPE_LABEL: Record<ReportType, string> = {
  weekly: 'Weekly Chess Report',
  monthly: 'Monthly Progress Report',
  opening: 'Opening Report',
  tournament: 'Tournament Summary'
}

const FORMAT_LABEL: Record<ReportFormat, string> = {
  html: 'HTML (printable to PDF)',
  markdown: 'Markdown'
}

export default function Settings() {
  const { theme, setTheme } = useTheme()
  const { boardTheme, pieceSet, setBoardTheme, setPieceSet } = useBoardTheme()
  const [settings, setSettings] = useState<AppSettings>({
    theme: 'system',
    boardTheme: 'cyberpunk',
    pieceSet: 'classic',
    myUsernames: '',
    dbLocation: '',
    autoSync: false,
    chessComUsername: '',
    chessComLastSyncAt: null,
    engine: { depth: 12, movetime: 2000, threads: 1, hash: 256, multiPV: 1 }
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    username: null,
    lastSyncAt: null,
    totalGames: 0,
    onlineGames: 0
  })
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null)
  const [syncUsername, setSyncUsername] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)

  const [benchmarkStatus, setBenchmarkStatus] = useState<'idle' | 'analyzing' | 'error'>('idle')
  const [benchmarkBestmove, setBenchmarkBestmove] = useState<string | null>(null)
  const [benchmarkScore, setBenchmarkScore] = useState<string | null>(null)
  const [benchmarkRunning, setBenchmarkRunning] = useState(false)
  const [benchmarkError, setBenchmarkError] = useState<string | null>(null)

  const [reportType, setReportType] = useState<ReportType>('weekly')
  const [reportFormat, setReportFormat] = useState<ReportFormat>('html')
  const [reportResult, setReportResult] = useState<{ path: string; type: ReportType; format: ReportFormat; gamesAnalyzed: number } | null>(null)
  const [reportError, setReportError] = useState<string | null>(null)
  const [reportGenerating, setReportGenerating] = useState(false)

  const [resetConfirm, setResetConfirm] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)

  useEffect(() => {
    window.api.settings
      .get()
      .then((result) => {
        if (result.ok) {
          setSettings(result.data)
          setSyncUsername(result.data.chessComUsername ?? '')
        }
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!loading && settings.theme !== theme) {
      setTheme(settings.theme as 'light' | 'dark' | 'system')
    }
  }, [settings.theme, theme, setTheme, loading])

  useEffect(() => {
    if (!loading && settings.boardTheme !== boardTheme) {
      setBoardTheme(settings.boardTheme)
    }
  }, [settings.boardTheme, boardTheme, setBoardTheme, loading])

  useEffect(() => {
    if (!loading && settings.pieceSet !== pieceSet) {
      setPieceSet(settings.pieceSet)
    }
  }, [settings.pieceSet, pieceSet, setPieceSet, loading])

  const loadSyncStatus = useCallback(async () => {
    try {
      const result = await window.api.sync.status()
      if (result.ok) setSyncStatus(result.data)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    loadSyncStatus()
  }, [loadSyncStatus])

  useEffect(() => {
    const unsub = window.api.sync.onProgress((p: unknown) => {
      const progress = p as SyncProgress
      setSyncProgress(progress)
      setSyncing(progress.stage !== 'done' && progress.stage !== 'idle' && progress.stage !== 'error')
      if (progress.stage === 'done' || progress.stage === 'idle' || progress.stage === 'error') {
        loadSyncStatus()
      }
    })
    return () => unsub()
  }, [loadSyncStatus])

  const handleChange = useCallback(
    (key: keyof AppSettings, value: string | boolean) => {
      setSettings((prev) => ({ ...prev, [key]: value }))
      setSaved(false)
    },
    []
  )

  const handleEngineChange = useCallback(
    (key: keyof AppSettings['engine'], value: string) => {
      const num = Number(value)
      if (!Number.isFinite(num)) return
      setSettings((prev) => ({
        ...prev,
        engine: { ...prev.engine, [key]: num }
      }))
      setSaved(false)
    },
    []
  )

  const handleSave = async () => {
    setSaving(true)
    try {
      const result = await window.api.settings.set(settings)
      if (result.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 1500)
      }
    } finally {
      setSaving(false)
    }
  }

  const handleSync = async () => {
    setSyncError(null)
    setSyncProgress(null)
    const user = syncUsername.trim() || syncStatus.username || settings.chessComUsername
    if (!user) {
      setSyncError('Enter a Chess.com username first')
      return
    }
    setSyncing(true)
    try {
      const result = await window.api.sync.start(user)
      if (!result.ok) {
        setSyncError(result.error.message)
        setSyncing(false)
      }
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : String(e))
      setSyncing(false)
    }
  }

  const handleCancel = async () => {
    await window.api.sync.cancel()
    setSyncing(false)
    setSyncProgress(null)
  }

  const handleRunBenchmark = useCallback(async () => {
    setBenchmarkRunning(true)
    setBenchmarkError(null)
    setBenchmarkStatus('analyzing')
    try {
      const result = await window.api.analysis.position('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', {
        depth: settings.engine.depth,
        movetime: settings.engine.movetime
      })
      if (result.ok) {
        setBenchmarkBestmove(result.data.bestmove ?? '—')
        setBenchmarkScore(result.data.score ? (result.data.score.type === 'cp' ? `${result.data.score.value}cp` : `Mate ${result.data.score.value}`) : '—')
      } else {
        setBenchmarkError(result.error?.message ?? 'Benchmark failed')
        setBenchmarkStatus('error')
      }
    } catch (e) {
      setBenchmarkError(e instanceof Error ? e.message : String(e))
      setBenchmarkStatus('error')
    } finally {
      setBenchmarkRunning(false)
      setBenchmarkStatus('idle')
    }
  }, [settings.engine.depth, settings.engine.movetime])

  const handleStopAnalysis = useCallback(async () => {
    try {
      await window.api.analysis.stop()
      setBenchmarkStatus('idle')
      setBenchmarkRunning(false)
    } catch (e) {
      setBenchmarkError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  const handleGenerateReport = useCallback(async () => {
    setReportGenerating(true)
    setReportError(null)
    setReportResult(null)
    try {
      const res = await window.api.report.generate(reportType, reportFormat, {})
      if (res.ok) {
        setReportResult(res.data)
      } else {
        setReportError(res.error?.message ?? 'Failed to generate report')
      }
    } catch (e) {
      setReportError(e instanceof Error ? e.message : String(e))
    } finally {
      setReportGenerating(false)
    }
  }, [reportType, reportFormat])

  const handleReset = useCallback(async () => {
    setResetError(null)
    setResetting(true)
    try {
      const result = await window.api.database.reset()
      if (!result.ok) {
        setResetError(result.error?.message ?? 'Reset failed')
      }
    } catch (e) {
      setResetError(e instanceof Error ? e.message : String(e))
    } finally {
      setResetting(false)
      setResetConfirm(false)
    }
  }, [])

  const formatDate = (ts: number | null): string => {
    if (!ts) return 'never'
    return new Date(ts).toLocaleString()
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-text-muted font-mono text-sm">
        Loading settings…
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-filter uppercase text-cyan">// settings</span>
          <h1 className="text-page-title font-sans font-bold uppercase text-text-primary">
            Settings
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <PrimaryButton onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save settings'}
          </PrimaryButton>
        </div>
      </div>

      {saved && (
        <Panel accent="green">
          <StatusLabel accent="green">Saved</StatusLabel>
        </Panel>
      )}

      <Panel accent="magenta" label="Appearance">
        <div className="space-y-3">
          <div>
            <span className="font-mono text-filter uppercase text-text-muted text-xs block mb-2">Theme</span>
            <div className="flex gap-2">
              {THEME_OPTIONS.map((o) => (
                <FilterChip
                  key={o}
                  selected={settings.theme === o}
                  onClick={() => handleChange('theme', o)}
                >
                  {o.charAt(0).toUpperCase() + o.slice(1)}
                </FilterChip>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <span className="font-mono text-filter uppercase text-text-muted text-xs block mb-2">Board theme</span>
              <select
                value={settings.boardTheme}
                onChange={(e) => handleChange('boardTheme', e.target.value)}
                className="w-full bg-panel border border-border rounded-none px-3 py-2 text-xs font-mono text-text-primary uppercase focus:border-cyan focus:outline-none focus:ring-0"
              >
                {BOARD_THEME_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o.charAt(0).toUpperCase() + o.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <span className="font-mono text-filter uppercase text-text-muted text-xs block mb-2">Piece set</span>
              <select
                value={settings.pieceSet}
                onChange={(e) => handleChange('pieceSet', e.target.value)}
                className="w-full bg-panel border border-border rounded-none px-3 py-2 text-xs font-mono text-text-primary uppercase focus:border-cyan focus:outline-none focus:ring-0"
              >
                {PIECE_SET_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o.charAt(0).toUpperCase() + o.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </Panel>

      <Panel accent="magenta" label="Engine · stockfish">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { key: 'depth', label: 'Depth', min: 1, max: 99, unit: '' },
            { key: 'movetime', label: 'Move time', min: 100, max: 600000, unit: 'ms' },
            { key: 'threads', label: 'Threads', min: 1, max: 128, unit: '' },
            { key: 'hash', label: 'Hash', min: 1, max: 1024, unit: 'MB' },
            { key: 'multiPV', label: 'MultiPV', min: 1, max: 8, unit: '' },
          ].map((field) => (
            <div key={field.key} className="flex flex-col gap-1">
              <span className="font-mono text-filter uppercase text-text-muted text-xs">{field.label}</span>
              <div className="relative">
                <input
                  type="number"
                  min={field.min}
                  max={field.max}
                  value={settings.engine[field.key as keyof AppSettings['engine']]}
                  onChange={(e) => handleEngineChange(field.key as keyof AppSettings['engine'], e.target.value)}
                  className="w-full bg-panel border border-border rounded-none px-3 py-2 text-xs font-mono text-text-primary focus:border-cyan focus:outline-none focus:ring-0"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-dim text-xs font-mono">{field.unit}</span>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel accent="cyan" label="Account">
        <div className="space-y-3">
          <div className="flex flex-col gap-1">
            <span className="font-mono text-filter uppercase text-text-muted text-xs">My usernames</span>
            <input
              type="text"
              value={settings.myUsernames}
              onChange={(e) => handleChange('myUsernames', e.target.value)}
              placeholder="alice, bob"
              className="w-full bg-panel border border-border rounded-none px-3 py-2 text-xs font-mono text-text-primary focus:border-cyan focus:outline-none focus:ring-0"
            />
            <span className="text-text-dim text-xs font-mono">Comma-separated list of your usernames for statistics.</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="font-mono text-filter uppercase text-text-muted text-xs">Chess.com username</span>
            <input
              type="text"
              value={syncUsername}
              onChange={(e) => {
                setSyncUsername(e.target.value)
                setSettings((prev) => ({ ...prev, chessComUsername: e.target.value }))
                setSaved(false)
              }}
              placeholder="e.g. hikaru"
              className="w-full bg-panel border border-border rounded-none px-3 py-2 text-xs font-mono text-text-primary focus:border-cyan focus:outline-none focus:ring-0"
            />
            <span className="text-text-dim text-xs font-mono">Used for automatic syncing of online games.</span>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={settings.autoSync}
              onChange={(e) => handleChange('autoSync', e.target.checked)}
              className="w-4 h-4 bg-panel border border-border rounded-none text-yellow accent-yellow focus:ring-cyan"
            />
            <label className="text-text-primary font-mono text-sm uppercase">Auto-sync games</label>
            <span className="text-text-dim text-xs font-mono">(every 30 minutes)</span>
          </div>
        </div>
      </Panel>

      <Panel accent="cyan" label="Sync status">
        <div className="space-y-3">
          <div className="flex gap-3">
            <PrimaryButton onClick={handleSync} disabled={syncing || (!syncUsername.trim() && !syncStatus.username && !settings.chessComUsername)}>
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
          {syncError && (
            <div className="text-pink text-xs font-mono">{syncError}</div>
          )}
          <div className="flex justify-between items-center">
            <span className="text-text-muted font-mono uppercase text-xs">Status</span>
            <StatusLabel accent={syncing ? 'magenta' : syncStatus.username ? 'green' : 'pink'}>
              {syncing ? 'SYNCING…' : syncStatus.username ? 'CONNECTED' : 'DISCONNECTED'}
            </StatusLabel>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-text-muted font-mono uppercase text-xs">Last sync</span>
            <span className="text-text-primary font-mono">{formatDate(syncStatus.lastSyncAt)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-text-muted font-mono uppercase text-xs">Source</span>
            <span className="text-text-primary font-mono">Chess.com → chess.db</span>
          </div>
          {syncProgress && syncProgress.stage !== 'done' && syncProgress.stage !== 'idle' && syncProgress.stage !== 'error' && (
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-text-muted font-mono uppercase">Progress</span>
                <span className="text-text-primary font-mono">
                  {syncProgress.processed} / {syncProgress.total}
                </span>
              </div>
              {syncProgress.currentMonth && (
                <span className="text-text-dim text-xs font-mono block mb-1">
                  {syncProgress.currentMonth}
                </span>
              )}
              <ProgressBar
                value={syncProgress.total > 0 ? (syncProgress.processed / syncProgress.total) * 100 : 0}
                accent="cyan"
              />
            </div>
          )}
        </div>
      </Panel>

      <div className="wm-grid-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <KpiCard accent="cyan" value={syncStatus.totalGames.toLocaleString()} label="Total games" />
        <KpiCard
          accent="green"
          value={syncStatus.onlineGames.toLocaleString()}
          label="From Chess.com"
          sub="synced games"
        />
        <KpiCard accent="magenta" value={syncStatus.username || '—'} label="Chess.com user" />
        <KpiCard
          accent="yellow"
          value={formatDate(syncStatus.lastSyncAt)}
          label="Last sync"
          sub="timestamp"
        />
      </div>

      {syncProgress && syncProgress.stage === 'error' && syncError && (
        <Panel accent="pink" label="Sync error">
          <div className="text-pink text-xs font-mono">{syncError}</div>
        </Panel>
      )}

      {syncProgress && (syncProgress.stage === 'done' || syncProgress.imported > 0 || syncProgress.duplicates > 0) && (
        <Panel accent="green" label="Sync result">
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-text-muted font-mono uppercase">Found</span>
              <span className="text-text-primary font-mono">{syncProgress.found}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-text-muted font-mono uppercase">Imported</span>
              <span className="text-green font-mono font-bold">{syncProgress.imported}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-text-muted font-mono uppercase">Duplicates skipped</span>
              <span className="text-yellow font-mono font-bold">{syncProgress.duplicates}</span>
            </div>
            {syncProgress.invalid > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-text-muted font-mono uppercase">Invalid</span>
                <span className="text-pink font-mono font-bold">{syncProgress.invalid}</span>
              </div>
            )}
          </div>
        </Panel>
      )}

      <Panel accent="magenta" label="Reports">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-mono text-text-muted">Report type</span>
              <div className="flex gap-1">
                {(['weekly', 'monthly', 'opening', 'tournament'] as ReportType[]).map((t) => (
                  <FilterChip
                    key={t}
                    selected={reportType === t}
                    onClick={() => setReportType(t)}
                  >
                    {TYPE_LABEL[t]}
                  </FilterChip>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-mono text-text-muted">Export format</span>
              <div className="flex gap-1">
                {(['html', 'markdown'] as ReportFormat[]).map((f) => (
                  <FilterChip
                    key={f}
                    selected={reportFormat === f}
                    onClick={() => setReportFormat(f)}
                  >
                    {FORMAT_LABEL[f]}
                  </FilterChip>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs font-mono text-text-muted">Scope</span>
              <span className="text-[10px] font-mono text-text-muted">All games (filters coming soon)</span>
            </div>
            <button
              onClick={handleGenerateReport}
              disabled={reportGenerating}
              className="bg-transparent border border-cyan text-cyan font-mono text-xs uppercase px-4 py-2.5 rounded-none hover:bg-cyan/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {reportGenerating ? 'Generating…' : 'Generate & Save Report'}
            </button>
            {reportError && (
              <div className="mt-2 text-xs font-mono text-pink">{reportError}</div>
            )}
            {reportResult && (
              <div className="mt-2 flex items-center gap-2 text-xs font-mono text-green">
                <span>Saved to:</span>
                <span className="truncate max-w-[200px]" title={reportResult.path}>{reportResult.path}</span>
              </div>
            )}
          </div>

          <div className="flex-none lg:w-1/3">
            <Panel accent="orange" label="Last report">
              {reportResult ? (
                <div className="space-y-3">
                  <div className="flex justify-between items-center px-2 py-1.5 border-b border-border/50">
                    <span className="text-xs font-mono text-text-muted">Type</span>
                    <span className="text-xs font-mono text-text-primary">{TYPE_LABEL[reportResult.type]}</span>
                  </div>
                  <div className="flex justify-between items-center px-2 py-1.5 border-b border-border/50">
                    <span className="text-xs font-mono text-text-muted">Format</span>
                    <span className="text-xs font-mono text-text-primary">{reportResult.format}</span>
                  </div>
                  <div className="flex justify-between items-center px-2 py-1.5 border-b border-border/50">
                    <span className="text-xs font-mono text-text-muted">Games analyzed</span>
                    <span className="text-xs font-mono text-text-primary">{reportResult.gamesAnalyzed}</span>
                  </div>
                  <div className="flex justify-between items-center px-2 py-1.5">
                    <span className="text-xs font-mono text-text-muted">Saved at</span>
                    <span className="text-xs font-mono text-text-primary truncate max-w-xs" title={reportResult.path}>{reportResult.path}</span>
                  </div>
                </div>
              ) : (
                <div className="text-text-muted text-xs font-mono py-2 text-center">No report generated yet.</div>
              )}
            </Panel>
          </div>
        </div>
      </Panel>

      <Panel accent="magenta" label="Engine benchmark">
        <div className="space-y-3">
          <PrimaryButton
            onClick={handleRunBenchmark}
            disabled={benchmarkRunning}
            className="w-full"
          >
            {benchmarkRunning ? 'Analyzing…' : 'Run benchmark'}
          </PrimaryButton>
          <PrimaryButton
            onClick={handleStopAnalysis}
            disabled={benchmarkStatus !== 'analyzing'}
            className="w-full border border-pink text-pink hover:bg-pink/10"
          >
            Stop
          </PrimaryButton>
          {benchmarkBestmove && (
            <div className="grid grid-cols-3 gap-3 text-xs font-mono">
              <div className="bg-track border border-border rounded-none px-3 py-2">
                <span className="text-text-dim uppercase">Best move</span>
                <span className="text-text-primary">{benchmarkBestmove}</span>
              </div>
              <div className="bg-track border border-border rounded-none px-3 py-2">
                <span className="text-text-dim uppercase">Score</span>
                <span className="text-text-primary">{benchmarkScore}</span>
              </div>
            </div>
          )}
          {benchmarkError && (
            <div className="text-pink text-xs font-mono">{benchmarkError}</div>
          )}
        </div>
      </Panel>

      <Panel accent="cyan" label="Analysis">
        <div className="space-y-3">
          <span className="text-text-muted text-xs font-mono uppercase block mb-1">
            Game analysis is run per-game from the Games / Explorer views.
          </span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-filter uppercase text-text-muted text-xs">Engine</span>
            <StatusLabel accent="green">Stockfish · Ready</StatusLabel>
          </div>
          <div className="text-text-dim text-xs font-mono">
            <p>Open a game in Games or Explorer, then run analysis to see ply-by-ply evaluations.</p>
            <p>Finding states: GOOD · QUEUED · READY</p>
          </div>
        </div>
      </Panel>

      <Panel accent="cyan" label="Database">
        <div className="space-y-2">
          <span className="font-mono text-filter uppercase text-text-muted text-xs block mb-1">Location</span>
          <div className="bg-track border border-border rounded-none px-3 py-2 text-xs font-mono text-text-muted truncate">
            {settings.dbLocation || 'user data directory'}
          </div>
          <span className="text-text-dim text-xs font-mono">Read-only. Managed by Electron.</span>
        </div>
      </Panel>

      <Panel accent="pink" label="Danger zone">
        <div className="space-y-3">
          <span className="text-text-muted text-xs font-mono uppercase block mb-1">
            Reset everything
          </span>
          <span className="text-text-dim text-xs font-mono">
            Deletes all games, analysis, puzzles, tactics, and synced data. This cannot be undone.
          </span>
          {resetConfirm ? (
            <>
              <div className="text-pink text-xs font-mono font-bold">
                Type "DELETE" to confirm:
              </div>
              <input
                type="text"
                value=""
                onChange={(e) => setResetConfirm(e.target.value === 'DELETE')}
                placeholder="DELETE"
                className="w-full bg-panel border border-pink rounded-none px-3 py-2 text-xs font-mono text-text-primary focus:border-pink focus:outline-none focus:ring-0"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setResetConfirm(false)}
                  className="bg-transparent border border-border rounded-none px-3 py-2 text-xs font-mono text-text-muted hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReset}
                  disabled={resetting}
                  className="bg-transparent border border-pink text-pink px-3 py-2 text-xs font-mono uppercase hover:bg-pink/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {resetting ? 'Resetting…' : 'Delete all data'}
                </button>
              </div>
            </>
          ) : (
            <button
              onClick={() => setResetConfirm(true)}
              disabled={resetting}
              className="w-full bg-transparent border border-pink text-pink font-mono text-xs uppercase px-4 py-2.5 rounded-none hover:bg-pink/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Reset everything (delete all data)
            </button>
          )}
          {resetError && <div className="text-pink text-xs font-mono">{resetError}</div>}
        </div>
      </Panel>

      <div className="mt-4 text-text-dim text-xs font-mono">
        <p>Theme: {settings.theme}</p>
        <p>Environment: Electron</p>
      </div>
    </div>
  )
}
