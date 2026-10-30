import React from 'react'

type Accent = 'cyan' | 'yellow' | 'green' | 'magenta' | 'pink' | 'orange'

interface ProgressBarProps {
  value: number
  accent?: Accent
  className?: string
}

export function ProgressBar({ value = 0, accent = 'cyan', className }: ProgressBarProps) {
  const width = Math.max(0, Math.min(100, value))
  return (
    <div
      className={[
        'w-full bg-track h-1.5 rounded-none overflow-hidden relative',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div
        className="h-full bg-[accent] relative"
        style={{
          width: `${width}%`,
          backgroundColor:
            accent === 'cyan'
              ? '#00F0FF'
              : accent === 'yellow'
                ? '#FCEE09'
                : accent === 'green'
                  ? '#5DFF6A'
                  : accent === 'magenta'
                    ? '#B026FF'
                    : accent === 'pink'
                      ? '#FF2A6D'
                      : '#FF9F43',
          boxShadow: `0 0 12px ${
            accent === 'cyan'
              ? '#00F0FF'
              : accent === 'yellow'
                ? '#FCEE09'
                : accent === 'green'
                  ? '#5DFF6A'
                  : accent === 'magenta'
                    ? '#B026FF'
                    : accent === 'pink'
                      ? '#FF2A6D'
                      : '#FF9F43'
          }`,
        }}
      />
    </div>
  )
}
