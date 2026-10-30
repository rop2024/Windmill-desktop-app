import React from 'react'

type Accent = 'cyan' | 'yellow' | 'green' | 'magenta' | 'pink' | 'orange'

interface PanelProps {
  accent?: Accent
  label?: string
  labelAccent?: boolean
  className?: string
  children: React.ReactNode
}

export function Panel({
  accent = 'cyan',
  label,
  labelAccent = false,
  className,
  children,
}: PanelProps) {
  return (
    <div
      className={[
        'bg-panel border-l-4 clip-path-panel px-4 py-3',
        `border-${accent}`,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {label && (
        <span
          className={[
            'block font-mono text-filter uppercase mb-2',
            labelAccent ? `text-${accent}` : 'text-text-muted',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          // {label}
        </span>
      )}
      {children}
    </div>
  )
}
