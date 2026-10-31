import { createContext, useContext, useCallback, useState, useEffect, type ReactNode } from 'react'

type ImportProgress = {
  processed: number
  total: number
  imported: number
  duplicates: number
  invalid: number
}

type ImportError = {
  gameIndex: number
  message: string
}

type ImportReport = {
  found: number
  imported: number
  duplicates: number
  invalid: number
  errors: ImportError[]
}

type OpeningDetection = {
  san: string
  eco: string | null
  name: string | null
  ply: number
}

type DebugState = {
  importProgress: ImportProgress | null
  importReport: ImportReport | null
  detectedOpenings: OpeningDetection[]
  lastFen: string | null
}

const INITIAL_STATE: DebugState = {
  importProgress: null,
  importReport: null,
  detectedOpenings: [],
  lastFen: null,
}

type DebugContextValue = {
  state: DebugState
  visible: boolean
  setVisible: (v: boolean) => void
  recordImportProgress: (p: ImportProgress) => void
  recordImportReport: (r: ImportReport) => void
  recordOpeningDetection: (d: OpeningDetection) => void
  recordLastFen: (fen: string | null) => void
  clear: () => void
}

const DebugContext = createContext<DebugContextValue | null>(null)

export function useDebug() {
  const ctx = useContext(DebugContext)
  if (!ctx) throw new Error('useDebug must be used within a DebugProvider')
  return ctx
}

export function DebugProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DebugState>(INITIAL_STATE)
  const [visible, setVisible] = useState(false)

  const recordImportProgress = useCallback((p: ImportProgress) => {
    setState((s) => ({ ...s, importProgress: p }))
  }, [])

  const recordImportReport = useCallback((r: ImportReport) => {
    setState((s) => ({ ...s, importReport: r }))
  }, [])

  const recordOpeningDetection = useCallback((d: OpeningDetection) => {
    setState((s) => ({
      ...s,
      detectedOpenings: [...s.detectedOpenings, d].slice(-50),
    }))
  }, [])

  const recordLastFen = useCallback((fen: string | null) => {
    setState((s) => ({ ...s, lastFen: fen }))
  }, [])

  const clear = useCallback(() => {
    setState(INITIAL_STATE)
  }, [])

  // Listen to import progress events from the main process
  useEffect(() => {
    let unsub: (() => void) | undefined
    try {
      unsub = window.api.onImportProgress((progress: unknown) => {
        const p = progress as ImportProgress
        recordImportProgress(p)
      })
    } catch {
      // onImportProgress may not be available in all environments
    }
    return () => unsub?.()
  }, [recordImportProgress])

  return (
    <DebugContext.Provider value={{
      state,
      visible,
      setVisible,
      recordImportProgress,
      recordImportReport,
      recordOpeningDetection,
      recordLastFen,
      clear,
    }}>
      {children}
    </DebugContext.Provider>
  )
}
