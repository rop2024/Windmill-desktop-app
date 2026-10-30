import { useEffect } from 'react'
import { useToastStore } from '../../store/toastStore'

const TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  success: { bg: '#f0fdf4', text: '#166534', border: '#bbf7d0' },
  error: { bg: '#fef2f2', text: '#991b1b', border: '#fecaca' },
  warning: { bg: '#fffbeb', text: '#92400e', border: '#fef3c7' },
  info: { bg: '#eff6ff', text: '#1e40af', border: '#bfdbfe' }
}

export type ToastProps = {
  toast: {
    id: number
    title: string
    message?: string
    type: 'success' | 'error' | 'warning' | 'info'
    duration?: number
  }
}

export function Toast({ toast }: ToastProps) {
  const remove = useToastStore((state: { remove: (id: number) => void }) => state.remove)
  const colors = TYPE_COLORS[toast.type] ?? TYPE_COLORS.info

  useEffect(() => {
    const timer = setTimeout(() => remove(toast.id), toast.duration ?? 5000)
    return () => clearTimeout(timer)
  }, [toast.id, toast.duration, remove])

  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-lg border border-${colors.border} bg-${colors.bg} animate-in fade-in slide-in-from-right-4 duration-300`}
      role="alert"
      aria-live="polite"
    >
      <div className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: colors.text, color: '#ffffff' }}>
        {toast.type === 'success' ? '✓' : toast.type === 'error' ? '×' : toast.type === 'warning' ? '⚠' : 'i'}
      </div>
      <div className="flex-1">
        <h4 className={`text-sm font-semibold ${colors.text}`}>{toast.title}</h4>
        {toast.message && <p className={`text-xs ${colors.text} mt-0.5 opacity-80`}>{toast.message}</p>}
      </div>
      <button
        onClick={() => remove(toast.id)}
        className="rounded p-1.5 text-gray-400 hover:bg-gray-200"
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  )
}

export function ToastContainer() {
  const toasts = useToastStore((state) => state.toasts)

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <Toast toast={t as Extract<typeof t, { type: 'success' | 'error' | 'warning' | 'info' }>} />
        </div>
      ))}
    </div>
  )
}
