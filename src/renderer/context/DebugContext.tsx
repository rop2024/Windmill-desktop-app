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

type SyncProgress = {
  stage: string
  processed: number
  total: number
  found: number
  imported: number
  duplicates: number
  invalid: number
  currentMonth?: string | null
  username?: string | null
}

type SyncStatus = {
  username: string | null
  lastSyncAt: number | null
  totalGames: number
  onlineGames: number
}

type DebugState = {
  importProgress: ImportProgress | null
  importReport: ImportReport | null
  detectedOpenings: OpeningDetection[]
  lastFen: string | null
  syncProgress: SyncProgress | null
  syncStatus: SyncStatus | null
  syncEvents: Array<{ stage: string; currentMonth?: string | null; imported: number; timestamp: number }>
}

const INITIAL_STATE: DebugState = {
  importProgress: null,
  importReport: null,
  detectedOpenings: [],
  lastFen: null,
  syncProgress: null,
  syncStatus: null,
  syncEvents: [],
}

type DebugContextValue = {
  state: DebugState
  visible: boolean
  setVisible: (v: boolean) => void
  recordImportProgress: (p: ImportProgress) => void
  recordImportReport: (r: ImportReport) => void
  recordOpeningDetection: (d: OpeningDetection) => void
  recordLastFen: (fen: string | null) => void
  recordSyncProgress: (p: SyncProgress) => void
  recordSyncStatus: (s: SyncStatus) => void
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

  const recordSyncProgress = useCallback((p: SyncProgress) => {
    setState((s) => ({
      ...s,
      syncProgress: p,
      syncEvents: [
        ...s.syncEvents,
        { stage: p.stage, currentMonth: p.currentMonth ?? null, imported: p.imported, timestamp: Date.now() },
      ].slice(-100),
    }))
  }, [])

  const recordSyncStatus = useCallback((s: SyncStatus) => {
    setState((prev) => ({ ...prev, syncStatus: s }))
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

  // Listen to sync progress events from the main process
  useEffect(() => {
    let unsub: (() => void) | undefined
    try {
      unsub = window.api.sync.onProgress((progress: unknown) => {
        const p = progress as SyncProgress
        recordSyncProgress(p)
      })
    } catch {
      // onProgress may not be available in all environments
    }
    return () => unsub?.()
  }, [recordSyncProgress])

  return (
    <DebugContext.Provider value={{
      state,
      visible,
      setVisible,
      recordImportProgress,
      recordImportReport,
      recordOpeningDetection,
      recordLastFen,
      recordSyncProgress,
      recordSyncStatus,
      clear,
    }}>
      {children}
    </DebugContext.Provider>
  )
}
