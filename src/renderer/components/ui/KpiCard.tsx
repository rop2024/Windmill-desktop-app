import React from 'react'

type Accent = 'cyan' | 'yellow' | 'green' | 'magenta' | 'pink' | 'orange'

interface KpiCardProps {
  accent?: Accent
  value: string | number
  label: string
  sub?: string
  className?: string
}

export function KpiCard({
  accent = 'cyan',
  value,
  label,
  sub,
  className,
}: KpiCardProps) {
  return (
    <div
      className={[
        'bg-panel border-l-4 clip-path-panel px-4 py-3.5',
        `border-${accent}`,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="font-mono text-filter uppercase text-text-muted">{label}</div>
      <div className={`text-kpi-value font-sans font-bold text-${accent} mt-1 leading-tight`}>
        {value}
      </div>
      {sub && (
        <div className="text-text-dim text-xs mt-1 font-mono">{sub}</div>
      )}
    </div>
  )
}
