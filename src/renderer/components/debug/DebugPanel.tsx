import { useCallback, useState } from 'react'
import { Panel } from '../../components/ui/Panel'

type ImportProgress = {
  processed: number
  total: number
  imported: number
  duplicates: number
  invalid: number
  stage: string
}

type ImportError = {
  gameIndex: number
  message: string
}

type ImportReport = {
  found: number
  imported: number
  duplicates: number
  invalid: number
  errors: ImportError[]
}

type OpeningDetection = {
  san: string
  eco: string | null
  name: string | null
  ply: number
}

type DebugState = {
  importProgress: ImportProgress | null
  importReport: ImportReport | null
  detectedOpenings: OpeningDetection[]
  lastFen: string | null
}

const INITIAL_STATE: DebugState = {
  importProgress: null,
  importReport: null,
  detectedOpenings: [],
  lastFen: null,
}

export function DebugPanel({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [state, setState] = useState<DebugState>(INITIAL_STATE)

  const clear = useCallback(() => {
    setState(INITIAL_STATE)
  }, [])

  if (!visible) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[420px] flex flex-col gap-3">
      <div className="flex items-center justify-between bg-panel border border-border rounded-none p-3 shadow-lg">
        <div className="flex items-center gap-2">
          <span className="font-mono text-filter uppercase text-cyan text-xs">debug</span>
          <span className="font-mono text-filter uppercase text-text-muted text-xs">import</span>
        </div>
        <button
          onClick={onClose}
          className="text-xs font-mono text-text-muted hover:text-pink transition-colors"
        >
          ✕
        </button>
      </div>

      <div className="space-y-2">
        {/* Import Progress */}
        <Panel accent="cyan" label="Import Progress">
          <div className="space-y-1.5">
            {state.importProgress ? (
              <>
                <div className="flex justify-between items-center px-2 py-1 text-xs font-mono">
                  <span className="text-text-muted">Stage</span>
                  <span className="text-text-primary">{state.importProgress.stage}</span>
                </div>
                <div className="flex justify-between items-center px-2 py-1 text-xs font-mono">
                  <span className="text-text-muted">Processed</span>
                  <span className="text-text-primary">{state.importProgress.processed}</span>
                </div>
                <div className="flex justify-between items-center px-2 py-1 text-xs font-mono">
                  <span className="text-text-muted">Total</span>
                  <span className="text-text-primary">{state.importProgress.total}</span>
                </div>
                <div className="flex justify-between items-center px-2 py-1 text-xs font-mono">
                  <span className="text-green">Imported</span>
                  <span className="text-text-primary">{state.importProgress.imported}</span>
                </div>
                <div className="flex justify-between items-center px-2 py-1 text-xs font-mono">
                  <span className="text-yellow">Duplicates</span>
                  <span className="text-text-primary">{state.importProgress.duplicates}</span>
                </div>
                <div className="flex justify-between items-center px-2 py-1 text-xs font-mono">
                  <span className="text-pink">Invalid</span>
                  <span className="text-text-primary">{state.importProgress.invalid}</span>
                </div>
                <div className="bg-track h-2 rounded-none overflow-hidden w-full">
                  <div
                    className="h-full bg-cyan relative"
                    style={{
                      width: `${(state.importProgress.processed / Math.max(1, state.importProgress.total)) * 100}%`,
                    }}
                  />
                </div>
              </>
            ) : (
              <div className="px-3 py-2 text-xs font-mono text-text-muted text-center">
                No import in progress
              </div>
            )}
          </div>
        </Panel>

        {/* Import Report */}
        {state.importReport && (
          <Panel accent="green" label="Import Report">
            <div className="space-y-1 px-3 py-2">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-text-muted">Found</span>
                <span className="text-text-primary">{state.importReport.found}</span>
              </div>
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-green">Imported</span>
                <span className="text-text-primary">{state.importReport.imported}</span>
              </div>
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-yellow">Duplicates</span>
                <span className="text-text-primary">{state.importReport.duplicates}</span>
              </div>
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-pink">Invalid</span>
                <span className="text-text-primary">{state.importReport.invalid}</span>
              </div>
              {state.importReport.errors.length > 0 && (
                <div className="mt-1.5 border-t border-border pt-1.5 overflow-y-auto max-h-32">
                  <div className="text-xs font-mono text-text-muted uppercase mb-1">Errors</div>
                  {state.importReport.errors.map((e, i) => (
                    <div key={i} className="text-[10px] text-pink truncate max-w-[300px]">
                      Game {e.gameIndex}: {e.message}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Panel>
        )}

        {/* Detected Openings */}
        <Panel accent="magenta" label="Openings Detected">
          <div className="space-y-1">
            {state.detectedOpenings.length > 0 ? (
              state.detectedOpenings.map((d, i) => (
                <div key={i} className="px-2 py-1 text-[10px] font-mono border-b border-border/50 last:border-0">
                  <div className="flex justify-between">
                    <span className="text-text-primary">{d.san.slice(0, 30)}</span>
                    <span className={d.eco ? 'text-green' : 'text-text-muted'}>{d.eco ?? '—'}</span>
                  </div>
                  <div className="text-text-muted">{d.name ?? '—'}</div>
                </div>
              ))
            ) : (
              <div className="px-3 py-2 text-[10px] text-text-muted text-center">
                No openings detected yet
              </div>
            )}
          </div>
        </Panel>

        {/* Last FEN */}
        {state.lastFen && (
          <Panel accent="yellow" label="Last FEN">
            <div className="px-3 py-1.5">
              <div className="text-[9px] font-mono text-text-muted break-all truncate max-w-[380px]">
                {state.lastFen}
              </div>
            </div>
          </Panel>
        )}

        <div className="flex justify-end pt-1">
          <button
            onClick={clear}
            className="bg-transparent border border-border text-[10px] font-mono text-text-muted px-2 py-1 rounded-none hover:bg-white/5"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  )
}
