import React from 'react'

interface PrimaryButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
}

export function PrimaryButton({ className, children, ...props }: PrimaryButtonProps) {
  return (
    <button
      className={[
        'bg-yellow text-background font-mono text-button uppercase clip-path-button rounded-none',
        'px-4 py-2.5',
        'hover:opacity-90 active:opacity-80 transition-opacity',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'focus-visible:outline-2 focus-visible:outline-cyan focus-visible:outline-offset-2',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {children}
    </button>
  )
}
