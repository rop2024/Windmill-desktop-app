import { useState } from 'react'
import type { FormEvent } from 'react'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
import { Panel } from '../components/ui/Panel'
import { PrimaryButton } from '../components/ui/PrimaryButton'

const createSchema = z.object({
  whitePlayer: z.string().min(1, 'White player required'),
  blackPlayer: z.string().min(1, 'Black player required'),
  result: z.enum(['win', 'loss', 'draw']),
  pgn: z.string().min(1, 'PGN required'),
  source: z.enum(['local', 'online', 'engine'])
})

export default function GameNew() {
  const navigate = useNavigate()
  const [whitePlayer, setWhitePlayer] = useState('')
  const [blackPlayer, setBlackPlayer] = useState('')
  const [result, setResult] = useState<'win' | 'loss' | 'draw'>('win')
  const [pgn, setPgn] = useState('')
  const [source, setSource] = useState<'local' | 'online' | 'engine'>('local')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const parsed = createSchema.safeParse({ whitePlayer, blackPlayer, result, pgn, source })
    if (!parsed.success) {
      setError(parsed.error.errors.map((e) => e.message).join(', '))
      return
    }
    navigate('/games')
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1">
        <span className="font-mono text-filter uppercase text-cyan">// game · new</span>
        <h1 className="text-page-title font-sans font-bold uppercase text-text-primary">
          New game
        </h1>
      </div>

      {error && (
        <Panel accent="pink">
          <span className="text-pink text-xs font-mono">{error}</span>
        </Panel>
      )}

      <Panel accent="cyan" label="New game">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <span className="font-mono text-filter uppercase text-text-muted text-xs">White player</span>
              <input
                className="w-full bg-panel border border-border rounded-none px-3 py-2 text-sm font-mono text-text-primary focus:border-cyan focus:outline-none focus:ring-0"
                value={whitePlayer}
                onChange={(e) => setWhitePlayer(e.target.value)}
                placeholder="e.g. Carlsen"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-mono text-filter uppercase text-text-muted text-xs">Black player</span>
              <input
                className="w-full bg-panel border border-border rounded-none px-3 py-2 text-sm font-mono text-text-primary focus:border-cyan focus:outline-none focus:ring-0"
                value={blackPlayer}
                onChange={(e) => setBlackPlayer(e.target.value)}
                placeholder="e.g. Nakamura"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className="font-mono text-filter uppercase text-text-muted text-xs">PGN</span>
            <textarea
              className="w-full bg-panel border border-border rounded-none px-3 py-2 text-sm font-mono text-text-primary focus:border-cyan focus:outline-none focus:ring-0"
              value={pgn}
              onChange={(e) => setPgn(e.target.value)}
              rows={4}
              placeholder="1. e4 e5 2. Nf3 Nc6 ..."
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <span className="font-mono text-filter uppercase text-text-muted text-xs">Result</span>
              <select
                className="w-full bg-panel border border-border rounded-none px-3 py-2 text-sm font-mono text-text-primary focus:border-cyan focus:outline-none focus:ring-0"
                value={result}
                onChange={(e) => setResult(e.target.value as 'win' | 'loss' | 'draw')}
              >
                <option value="win">Win</option>
                <option value="loss">Loss</option>
                <option value="draw">Draw</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-mono text-filter uppercase text-text-muted text-xs">Source</span>
              <select
                className="w-full bg-panel border border-border rounded-none px-3 py-2 text-sm font-mono text-text-primary focus:border-cyan focus:outline-none focus:ring-0"
                value={source}
                onChange={(e) => setSource(e.target.value as 'local' | 'online' | 'engine')}
              >
                <option value="local">Local</option>
                <option value="online">Online</option>
                <option value="engine">Engine</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-3">
            <PrimaryButton type="submit">Save game</PrimaryButton>
            <button
              type="button"
              onClick={() => navigate('/games')}
              className="bg-transparent border border-border rounded-none px-3 py-2 text-sm font-mono text-cyan uppercase hover:border-cyan focus-visible:outline-2 focus-visible:outline-cyan transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </Panel>
    </div>
  )
}
