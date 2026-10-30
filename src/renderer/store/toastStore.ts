import { create } from 'zustand'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export type Toast = {
  id: number
  title: string
  message?: string
  type: ToastType
  duration?: number
}

type ToastStore = {
  toasts: Toast[]
  add: (toast: Omit<Toast, 'id'>) => void
  remove: (id: number) => void
  clear: () => void
}

let idCounter = 0

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  add: (toast) => {
    const id = ++idCounter
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] as Toast[] }))
    if (toast.duration ?? 5000 > 0) {
      setTimeout(() => {
        set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
      }, toast.duration ?? 5000)
    }
  },
  remove: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] })
}))
