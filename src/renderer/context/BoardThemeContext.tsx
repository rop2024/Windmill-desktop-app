import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'

type BoardTheme = 'cyberpunk'
type PieceSet = 'classic' | 'neo' | 'alpha' | 'tatiana'

type BoardThemeContextValue = {
  boardTheme: BoardTheme
  pieceSet: PieceSet
  setBoardTheme: (theme: BoardTheme) => void
  setPieceSet: (set: PieceSet) => void
}

const BoardThemeContext = createContext<BoardThemeContextValue | null>(null)

export function useBoardTheme() {
  const ctx = useContext(BoardThemeContext)
  if (!ctx) throw new Error('useBoardTheme must be used within a BoardThemeProvider')
  return ctx
}

const BOARD_COLORS: Record<BoardTheme, { light: string; dark: string }> = {
  cyberpunk: { light: '#18182A', dark: '#0B0B10' },
}

export function BoardThemeProvider({ initialBoardTheme = 'cyberpunk', initialPieceSet = 'classic', children }: { initialBoardTheme?: BoardTheme; initialPieceSet?: PieceSet; children: ReactNode }) {
  const [boardTheme, setBoardThemeState] = useState<BoardTheme>(initialBoardTheme)
  const [pieceSet, setPieceSetState] = useState<PieceSet>(initialPieceSet)

  useEffect(() => {
    try {
      const stored = localStorage.getItem('windmill.boardTheme')
      if (stored === 'cyberpunk') setBoardThemeState(stored)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    try {
      const stored = localStorage.getItem('windmill.pieceSet')
      if (stored === 'classic' || stored === 'neo' || stored === 'alpha' || stored === 'tatiana') {
        setPieceSetState(stored)
      }
    } catch {
      // ignore
    }
  }, [])

  const setBoardTheme = useCallback((next: BoardTheme) => {
    setBoardThemeState(next)
    try {
      localStorage.setItem('windmill.boardTheme', next)
    } catch {
      // ignore
    }
  }, [])

  const setPieceSet = useCallback((next: PieceSet) => {
    setPieceSetState(next)
    try {
      localStorage.setItem('windmill.pieceSet', next)
    } catch {
      // ignore
    }
  }, [])

  return (
    <BoardThemeContext.Provider value={{ boardTheme, pieceSet, setBoardTheme, setPieceSet }}>
      {children}
    </BoardThemeContext.Provider>
  )
}

export { BOARD_COLORS }

export default BoardThemeProvider
