import { useCallback, useEffect, useState } from 'react'
import type { AppSettings } from '@shared/game'
import { Panel } from '../components/ui/Panel'
import { PrimaryButton } from '../components/ui/PrimaryButton'
import { FilterChip } from '../components/ui/FilterChip'
import { StatusLabel } from '../components/ui/StatusLabel'
import { useTheme } from '../context/ThemeContext'
import { useBoardTheme } from '../context/BoardThemeContext'

const THEME_OPTIONS = ['system', 'dark', 'light'] as const
const BOARD_THEME_OPTIONS = ['wood', 'marble', 'blue', 'green'] as const
const PIECE_SET_OPTIONS = ['classic', 'neo', 'alpha', 'tatiana'] as const

export default function Settings() {
  const { theme, setTheme } = useTheme()
  const { boardTheme, pieceSet, setBoardTheme, setPieceSet } = useBoardTheme()
  const [settings, setSettings] = useState<AppSettings>({
    theme: 'system',
    boardTheme: 'wood',
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

  useEffect(() => {
    window.api.settings
      .get()
      .then((result) => {
        if (result.ok) setSettings(result.data)
      })
      .finally(() => setLoading(false))
  }, [])

  // Apply theme changes immediately
  useEffect(() => {
    if (!loading && settings.theme !== theme) {
      setTheme(settings.theme as 'light' | 'dark' | 'system')
    }
  }, [settings.theme, theme, setTheme, loading])

  // Apply board theme changes immediately
  useEffect(() => {
    if (!loading && settings.boardTheme !== boardTheme) {
      setBoardTheme(settings.boardTheme)
    }
  }, [settings.boardTheme, boardTheme, setBoardTheme, loading])

  // Apply piece set changes immediately
  useEffect(() => {
    if (!loading && settings.pieceSet !== pieceSet) {
      setPieceSet(settings.pieceSet)
    }
  }, [settings.pieceSet, pieceSet, setPieceSet, loading])

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
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={settings.autoSync}
              onChange={(e) => handleChange('autoSync', e.target.checked)}
              className="w-4 h-4 bg-panel border border-border rounded-none text-yellow accent-yellow focus:ring-cyan"
            />
            <label className="text-text-primary font-mono text-sm uppercase">Auto-sync games</label>
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

      <div className="mt-4 text-text-dim text-xs font-mono">
        <p>Theme: {settings.theme}</p>
        <p>Environment: Electron</p>
      </div>
    </div>
  )
}
