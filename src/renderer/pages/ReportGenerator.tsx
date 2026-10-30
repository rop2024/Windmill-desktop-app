import { useCallback, useState } from 'react'
import { Panel } from '../components/ui/Panel'
import { KpiCard } from '../components/ui/KpiCard'
import { FilterChip } from '../components/ui/FilterChip'

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

export default function ReportGenerator() {
  const [generating, setGenerating] = useState(false)
  const [type, setType] = useState<ReportType>('weekly')
  const [format, setFormat] = useState<ReportFormat>('html')
  const [result, setResult] = useState<{ path: string; type: ReportType; format: ReportFormat; gamesAnalyzed: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const generate = useCallback(async () => {
    setGenerating(true)
    setError(null)
    setResult(null)
    try {
      const res = await window.api.report.generate(type, format, {})
      if (res.ok) {
        setResult(res.data)
      } else {
        setError(res.error?.message ?? 'Failed to generate report')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setGenerating(false)
    }
  }, [type, format])

  return (
    <div className="bg-background min-h-screen space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-filter uppercase text-cyan">// report generator</span>
          <h1 className="text-page-title font-sans font-bold uppercase text-text-primary">
            Report Generator
          </h1>
        </div>
      </div>

      <div className="wm-grid-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <KpiCard accent="cyan" value={result ? '1' : '0'} label="Reports generated" />
        <KpiCard accent="green" value={result?.gamesAnalyzed ?? 0} label="Games analyzed" />
        <KpiCard accent="magenta" value={result ? TYPE_LABEL[result.type].split(' ')[0] : '—'} label="Last type" />
        <KpiCard accent="orange" value={result?.format.toUpperCase() ?? '—'} label="Format" />
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 w-full lg:w-2/3">
          <Panel accent="magenta" label="Generate report">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-text-muted">Report type</span>
                <div className="flex gap-1">
                  {(['weekly', 'monthly', 'opening', 'tournament'] as ReportType[]).map((t) => (
                    <FilterChip
                      key={t}
                      selected={type === t}
                      onClick={() => setType(t)}
                    >
                      {TYPE_LABEL[t]}
                    </FilterChip>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-text-muted">Export format</span>
                <div className="flex gap-1">
                  {(['html', 'markdown'] as ReportFormat[]).map((f) => (
                    <FilterChip
                      key={f}
                      selected={format === f}
                      onClick={() => setFormat(f)}
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
                onClick={generate}
                disabled={generating}
                className="bg-transparent border border-cyan text-cyan font-mono text-xs uppercase px-4 py-2.5 rounded-none hover:bg-cyan/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generating ? 'Generating…' : 'Generate & Save Report'}
              </button>
              {error && (
                <div className="mt-2 text-xs font-mono text-pink">{error}</div>
              )}
              {result && (
                <div className="mt-2 flex items-center gap-2 text-xs font-mono text-green">
                  <span>Saved to:</span>
                  <span className="truncate max-w-[200px]" title={result.path}>{result.path}</span>
                </div>
              )}
            </div>
          </Panel>

          <Panel accent="cyan" label="About">
            <div className="space-y-2 text-xs font-mono text-text-muted">
              <div>Export your chess data into polished, shareable reports.</div>
              <div className="mt-1">Available report types:</div>
              <ul className="list-disc list-inside space-y-1 mt-1">
                <li><b>Weekly Chess Report</b> — past week’s games, blunders, rating change, key insights</li>
                <li><b>Monthly Progress</b> — month-over-month rating trend, accuracy, win rate</li>
                <li><b>Opening Report</b> — opening performance, win %, mistakes per opening</li>
                <li><b>Tournament Summary</b> — tournament results, performance rating, key games</li>
              </ul>
              <div className="mt-1">HTML reports can be printed to PDF from your browser. Markdown reports are plain-text notes.</div>
            </div>
          </Panel>
        </div>

        <div className="flex-none lg:w-1/3">
          <Panel accent="orange" label="Last report">
            {result ? (
              <div className="space-y-3">
                <div className="flex justify-between items-center px-2 py-1.5 border-b border-border/50">
                  <span className="text-xs font-mono text-text-muted">Type</span>
                  <span className="text-xs font-mono text-text-primary">{TYPE_LABEL[result.type]}</span>
                </div>
                <div className="flex justify-between items-center px-2 py-1.5 border-b border-border/50">
                  <span className="text-xs font-mono text-text-muted">Format</span>
                  <span className="text-xs font-mono text-text-primary">{result.format}</span>
                </div>
                <div className="flex justify-between items-center px-2 py-1.5 border-b border-border/50">
                  <span className="text-xs font-mono text-text-muted">Games analyzed</span>
                  <span className="text-xs font-mono text-text-primary">{result.gamesAnalyzed}</span>
                </div>
                <div className="flex justify-between items-center px-2 py-1.5">
                  <span className="text-xs font-mono text-text-muted">Saved at</span>
                  <span className="text-xs font-mono text-text-primary truncate max-w-xs" title={result.path}>{result.path}</span>
                </div>
              </div>
            ) : (
              <div className="text-text-muted text-xs font-mono py-2 text-center">No report generated yet.</div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  )
}
