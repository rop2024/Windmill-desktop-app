import { useParams, useNavigate } from 'react-router-dom'
import { Panel } from '../components/ui/Panel'
import { PrimaryButton } from '../components/ui/PrimaryButton'

export default function GameDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/games')}
          className="bg-transparent border border-border rounded-none px-3 py-2 text-xs font-mono text-cyan uppercase hover:border-cyan focus-visible:outline-2 focus-visible:outline-cyan transition-colors"
        >
          ← Back to games
        </button>
        <div className="flex flex-col">
          <span className="font-mono text-filter uppercase text-cyan">// game</span>
          <h1 className="text-page-title font-sans font-bold uppercase text-text-primary">
            Game {id ?? '—'}
          </h1>
        </div>
      </div>

      <Panel accent="cyan" label="Game details">
        <div className="text-text-muted text-xs font-mono">
          Game details and move list will appear here.
        </div>
      </Panel>

      <div className="flex items-center gap-3">
        <PrimaryButton onClick={() => navigate(`/explorer/${id}`)} disabled={!id}>
          Open in explorer
        </PrimaryButton>
        <button
          onClick={() => navigate(`/analysis/${id}`)}
          disabled={!id}
          className="bg-transparent border border-magenta rounded-none px-3 py-2 text-xs font-mono text-magenta uppercase hover:border-cyan disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Analyze game
        </button>
      </div>
    </div>
  )
}
