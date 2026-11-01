import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Panel } from '../components/ui/Panel'
import { PrimaryButton } from '../components/ui/PrimaryButton'

export default function ExplorerLanding() {
  const navigate = useNavigate()
  const [games, setGames] = useState<Array<{
    id: string
    whitePlayer: string
    blackPlayer: string
    result: string
    pgn: string
    playedAt?: number | null
  }>>([])
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadRecentGames = async () => {
    setLoading(true)
    try {
      const result = await window.api.games.query(undefined, 12, 0)
      if (result.ok) setGames(result.data.games)
      else setError(result.error?.message ?? 'Failed to load games')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRecentGames()
  }, [])

  const handleImport = async () => {
    setImporting(true)
    setError(null)
    try {
      const result = await window.api.pgn.import()
      if (!result.ok) {
        setError(result.error?.message ?? 'PGN import failed')
        return
      }
      await loadRecentGames()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-filter uppercase text-cyan">// explorer</span>
          <h1 className="text-page-title font-sans font-bold uppercase text-text-primary">
            PGN Explorer
          </h1>
        </div>
        <div className="flex gap-2">
          <PrimaryButton onClick={handleImport} disabled={importing}>
            {importing ? 'Importing…' : 'Open PGN file'}
          </PrimaryButton>
          <button
            onClick={() => navigate('/games')}
            className="bg-transparent border border-border rounded-none px-3 py-2 text-xs font-mono text-cyan uppercase hover:border-cyan transition-colors"
          >
            Games database
          </button>
        </div>
      </div>

      {error && (
        <Panel accent="pink" label="Explorer error">
          <span className="text-pink text-xs font-mono">{error}</span>
        </Panel>
      )}

      <Panel accent="cyan" label="Recent games">
        {loading ? (
          <div className="text-text-muted text-sm font-mono">Loading games…</div>
        ) : games.length === 0 ? (
          <div className="space-y-3">
            <div className="text-text-muted text-sm font-mono">
              No games in the database yet. Import a PGN file or sync Chess.com games to begin.
            </div>
            <button
              onClick={() => navigate('/sync')}
              className="bg-transparent border border-cyan rounded-none px-3 py-2 text-xs font-mono text-cyan uppercase hover:bg-cyan/10 transition-colors"
            >
              Go to sync
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="grid min-w-[640px]">
              <div className="grid grid-cols-[1.4fr_1.4fr_0.8fr_1fr_0.7fr] gap-3 border-b border-border px-3 py-2 text-[10px] font-mono uppercase text-text-muted">
                <span>White</span>
                <span>Black</span>
                <span>Result</span>
                <span>Date</span>
                <span className="text-right">Action</span>
              </div>
            {games.map((game) => (
              <div
                key={game.id}
                className="grid grid-cols-[1.4fr_1.4fr_0.8fr_1fr_0.7fr] items-center gap-3 border-b border-border/50 px-3 py-3 hover:bg-white/5 transition-colors"
              >
                <span className="truncate text-text-primary text-sm font-sans" title={game.whitePlayer}>{game.whitePlayer}</span>
                <span className="truncate text-text-primary text-sm font-sans" title={game.blackPlayer}>{game.blackPlayer}</span>
                <span className="truncate text-text-muted text-xs font-mono">{game.result}</span>
                <span className="text-text-muted text-xs font-mono">
                  {game.playedAt ? new Date(game.playedAt).toLocaleDateString() : '—'}
                </span>
                <button
                  onClick={() => navigate(`/explorer/${game.id}`)}
                  className="justify-self-end border border-cyan px-3 py-1.5 text-cyan font-mono text-xs uppercase hover:bg-cyan/10 transition-colors"
                >
                  View
                </button>
              </div>
            ))}
            </div>
          </div>
        )}
      </Panel>
    </div>
  )
}
