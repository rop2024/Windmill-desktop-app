import React from 'react'

type Accent = 'cyan' | 'yellow' | 'green' | 'magenta' | 'pink' | 'orange'

interface StatusLabelProps {
  children: React.ReactNode
  accent?: Accent
  className?: string
}

export function StatusLabel({ accent = 'cyan', children, className }: StatusLabelProps) {
  return (
    <span
      className={[
        'font-mono text-filter uppercase',
        `text-${accent}`,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </span>
  )
}
