import { Outlet, useLocation, useNavigate, Link } from 'react-router-dom'
import { useDebug } from '../context/DebugContext'
import { DebugPanel } from '../components/debug/DebugPanel'

type NavItem = {
  to: string
  label: string
  match: (pathname: string) => boolean
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', match: (p) => p === '/' },
  { to: '/games', label: 'Games', match: (p) => p.startsWith('/games') },
  { to: '/explorer', label: 'PGN Explorer', match: (p) => p.startsWith('/explorer') },
  { to: '/openings', label: 'Opening Explorer', match: (p) => p.startsWith('/openings') },
  { to: '/engine', label: 'Analysis', match: (p) => p.startsWith('/engine') },
  { to: '/statistics', label: 'Statistics', match: (p) => p.startsWith('/statistics') },
  { to: '/tactics', label: 'Tactics', match: (p) => p.startsWith('/tactics') },
  { to: '/weaknesses', label: 'Weaknesses', match: (p) => p.startsWith('/weaknesses') },
  { to: '/trainer', label: 'Trainer', match: (p) => p.startsWith('/trainer') },
  { to: '/coach', label: 'Coach', match: (p) => p.startsWith('/coach') },
  { to: '/board', label: 'Board', match: (p) => p.startsWith('/board') },
  { to: '/training', label: 'Training', match: (p) => p.startsWith('/training') },
  { to: '/achievements', label: 'Achievements', match: (p) => p.startsWith('/achievements') },
  { to: '/timeline', label: 'Timeline', match: (p) => p.startsWith('/timeline') },
  { to: '/search', label: 'Search', match: (p) => p.startsWith('/search') },
  { to: '/repertoire', label: 'Repertoire', match: (p) => p.startsWith('/repertoire') },
  { to: '/graph', label: 'Graph', match: (p) => p.startsWith('/graph') },
  { to: '/settings', label: 'Settings', match: (p) => p.startsWith('/settings') },
]

export default function AppLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { visible, setVisible } = useDebug()

  return (
    <div className="min-h-screen bg-background bg-scanline flex flex-col">
      <div className="flex-1 flex">
        <aside className="wm-sidebar w-sidebar bg-sidebar border-r border-border flex flex-col min-h-0">
          <div className="px-3.5 pt-5 pb-5">
            <div className="text-brand font-sans font-bold uppercase text-yellow mb-1">
              WINDMILL
            </div>
            <div className="font-mono text-text-muted text-xs uppercase">// chess.db</div>
          </div>
          <nav className="flex-1 overflow-y-auto px-3.5 space-y-1.5 min-h-0">
            {NAV_ITEMS.map((item) => {
              const active = item.match(location.pathname)
              return (
                <Link
                  key={item.label}
                  to={item.to}
                  onClick={() => navigate(item.to)}
                  className={[
                    'flex items-center gap-2 px-3 py-2.5 rounded-none text-text-primary font-sans font-bold uppercase',
                    'transition-colors',
                    active
                      ? 'bg-panel border-l-3 border-yellow text-yellow'
                      : 'text-text-muted hover:text-cyan hover:border-cyan border-transparent border-l-3',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>
          <div className="px-3.5 pt-4 pb-4 border-t border-border">
            <span className="font-mono text-filter uppercase text-green">
              &#9679; synced 2m ago
            </span>
          </div>
        </aside>

        <main className="wm-main flex-1 overflow-y-auto bg-background p-[22px]">
          <Outlet />
        </main>
      </div>

      {/* Debug toggle button (bottom right corner) */}
        <button
          onClick={() => setVisible(!visible)}
        className="fixed bottom-4 right-4 z-50 bg-panel border border-border rounded-none px-3 py-2 text-[10px] font-mono text-text-muted hover:bg-white/5 hover:border-cyan transition-colors"
        title="Toggle debug panel"
      >
        🐛 Debug
      </button>

      {/* Debug panel */}
      {visible && <DebugPanel visible={visible} onClose={() => setVisible(false)} />}
    </div>
  )
}
