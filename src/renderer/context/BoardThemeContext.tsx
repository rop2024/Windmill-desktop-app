import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'

type BoardTheme = 'wood' | 'marble' | 'blue' | 'green'
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
  wood: { light: '#F0D9B5', dark: '#B58863' },
  marble: { light: '#E6E6E6', dark: '#769656' },
  blue: { light: '#CFC6C4', dark: '#5D7A89' },
  green: { light: '#E3EDCD', dark: '#769656' },
}

export function BoardThemeProvider({ initialBoardTheme = 'wood', initialPieceSet = 'classic', children }: { initialBoardTheme?: BoardTheme; initialPieceSet?: PieceSet; children: ReactNode }) {
  const [boardTheme, setBoardThemeState] = useState<BoardTheme>(initialBoardTheme)
  const [pieceSet, setPieceSetState] = useState<PieceSet>(initialPieceSet)

  useEffect(() => {
    try {
      const stored = localStorage.getItem('windmill.boardTheme')
      if (stored === 'wood' || stored === 'marble' || stored === 'blue' || stored === 'green') {
        setBoardThemeState(stored)
      }
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
