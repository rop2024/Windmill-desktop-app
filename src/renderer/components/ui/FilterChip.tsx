import React from 'react'

interface FilterChipProps {
  selected?: boolean
  className?: string
  children: React.ReactNode
  onClick?: () => void
}

export function FilterChip({
  selected = false,
  className,
  children,
  onClick,
}: FilterChipProps) {
  return (
    <button
      onClick={onClick}
      className={[
        'bg-transparent border border-border font-mono text-filter uppercase',
        'px-3 py-2 rounded-none',
        'hover:border-cyan transition-colors',
        'focus-visible:outline-2 focus-visible:outline-cyan focus-visible:outline-offset-1',
        selected ? 'border-cyan text-yellow' : 'text-cyan',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </button>
  )
}
