import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'

type Theme = 'light' | 'dark' | 'system'

type ThemeContextValue = {
  theme: Theme
  resolvedTheme: 'light' | 'dark'
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx
}

function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return theme
}

function applyTheme(resolved: 'light' | 'dark') {
  const root = document.documentElement
  if (resolved === 'dark') {
    root.classList.add('dark')
    root.setAttribute('data-theme', 'dark')
  } else {
    root.classList.remove('dark')
    root.setAttribute('data-theme', 'light')
  }
}

export function ThemeProvider({ initialTheme = 'system', children }: { initialTheme?: Theme; children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(initialTheme)
  const [resolved, setResolved] = useState<'light' | 'dark'>(resolveTheme(initialTheme))

  useEffect(() => {
    applyTheme(resolved)
  }, [resolved])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      if (theme === 'system') {
        const next = resolveTheme('system')
        setResolved(next)
        applyTheme(next)
      }
    }
    media.addEventListener('change', handler)
    return () => media.removeEventListener('change', handler)
  }, [theme])

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    const resolvedNext = resolveTheme(next)
    setResolved(resolvedNext)
    applyTheme(resolvedNext)
    try {
      localStorage.setItem('windmill.theme', next)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    try {
      const stored = localStorage.getItem('windmill.theme')
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setThemeState(stored)
        const resolvedNext = resolveTheme(stored)
        setResolved(resolvedNext)
        applyTheme(resolvedNext)
      }
    } catch {
      // ignore
    }
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme: resolved, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export default ThemeProvider
