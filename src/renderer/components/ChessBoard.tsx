import { useCallback, useMemo } from 'react'
import { Chess } from 'chess.js'
import { useBoardTheme, BOARD_COLORS } from '../context/BoardThemeContext'

type Square = string
type Color = 'w' | 'b'

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const
const RANKS = [8, 7, 6, 5, 4, 3, 2, 1] as const

const PIECE_UNICODE: Record<string, string> = {
  K: '\u2654', Q: '\u2655', R: '\u2656', B: '\u2657', N: '\u2658', P: '\u2659',
  k: '\u265A', q: '\u265B', r: '\u265C', b: '\u265D', n: '\u265E', p: '\u265F'
}

type Highlight = {
  square: Square
  type: 'selected' | 'last-move' | 'check' | 'custom'
  color?: string
}

type Arrow = {
  from: Square
  to: Square
  color?: string
}

type ChessBoardProps = {
  fen: string
  orientation: Color
  highlighted?: Highlight[]
  arrows?: Arrow[]
  disabled?: boolean
  onSquareClick?: (square: Square | null) => void
  squareSize?: number
  lightSquare?: string
  darkSquare?: string
  whitePiece?: string
  blackPiece?: string
  selectedColor?: string
}

export function ChessBoard({
  fen,
  orientation = 'w',
  highlighted = [],
  arrows = [],
  disabled = false,
  onSquareClick,
  squareSize = 70,
  lightSquare: lightSquareProp,
  darkSquare: darkSquareProp,
  selectedColor = 'rgba(252, 238, 9, 0.35)',
}: ChessBoardProps) {
  const { boardTheme } = useBoardTheme()
  const boardColors = BOARD_COLORS[boardTheme]

  const lightSquare = lightSquareProp ?? boardColors.light
  const darkSquare = darkSquareProp ?? boardColors.dark

  const boardWidth = squareSize * 8
  const chess = useMemo(() => new Chess(fen), [fen])
  const board = chess.board()

  const squareAt = useCallback(
    (file: string, rank: number): Square => `${file}${rank}`,
    []
  )

  const isHighlighted = useCallback(
    (square: Square): Highlight | undefined =>
      highlighted.find((h) => h.square === square),
    [highlighted]
  )

  const flip = orientation === 'b'

  const rankList = flip ? [...RANKS].reverse() : RANKS
  const fileList = flip ? [...FILES].reverse() : FILES

  const handleSquareClick = useCallback(
    (square: Square) => {
      if (disabled || !onSquareClick) return
      onSquareClick(square)
    },
    [disabled, onSquareClick]
  )

  const getPiece = useCallback(
    (file: string, rank: number): string | null => {
      const fileIdx = FILES.indexOf(file as never)
      const cell = board[8 - rank]?.[fileIdx]
      if (!cell) return null
      return cell.color === 'w' ? cell.type.toUpperCase() : cell.type.toLowerCase()
    },
    [board]
  )

  const squareStyle = useCallback(
    (file: string, rank: number): { fill: string; cursor: string } => {
      const light = (FILES.indexOf(file as never) + rank) % 2 !== 0
      return {
        fill: light ? lightSquare : darkSquare,
        cursor: disabled ? 'default' : 'pointer'
      }
    },
    [disabled, lightSquare, darkSquare]
  )

  return (
    <svg
      width={boardWidth}
      height={boardWidth}
      className="chessboard"
      style={{
        userSelect: 'none',
        WebkitUserSelect: 'none',
        outline: '2px solid #2A2A36',
        outlineOffset: '-2px',
        filter: 'drop-shadow(0 0 8px rgba(0, 240, 255, 0.18))',
      }}
      onClick={() => {
        if (!disabled && onSquareClick) onSquareClick(null)
      }}
    >
      {/* Arrows (drawn behind pieces) */}
      {arrows.map((arrow, idx) => {
        const from = squareCoord(arrow.from, squareSize, flip)
        const to = squareCoord(arrow.to, squareSize, flip)
        return (
          <path
            key={`arrow-${idx}`}
            d={`M${from.x + squareSize / 2} ${from.y + squareSize / 2} L${to.x + squareSize / 2} ${to.y + squareSize / 2}`}
            stroke={arrow.color || '#FCEE09'}
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
            pointerEvents="none"
            markerEnd="url(#arrowhead)"
          />
        )
      })}
      <defs>
        <filter id="neon-piece-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <marker
          id="arrowhead"
          markerWidth="10"
          markerHeight="7"
          refX="0"
          refY="3.5"
          orient="auto"
        >
          <polygon points="0 0, 10 3.5, 0 7" fill="#FCEE09" />
        </marker>
      </defs>

      {/* Squares */}
      {rankList.map((rank) =>
        fileList.map((file) => {
          const square = squareAt(file, rank)
          const hl = isHighlighted(square)
          const base = squareStyle(file, rank)
          const rectFill =
            hl?.type === 'selected'
              ? selectedColor
              : hl?.type === 'last-move'
                ? 'rgba(252, 238, 9, 0.18)'
                : hl?.type === 'check'
                  ? 'rgba(255, 42, 109, 0.35)'
                  : hl?.color ?? base.fill
          return (
            <rect
              key={`${file}${rank}`}
              x={FILES.indexOf(file as never) * squareSize}
              y={(8 - rank) * squareSize}
              width={squareSize}
              height={squareSize}
              style={{ ...base, fill: rectFill }}
              stroke={
                hl?.type === 'selected' || hl?.type === 'last-move' || hl?.type === 'check'
                  ? hl.color || '#2A2A36'
                  : 'none'
              }
              strokeWidth={hl ? 2 : 0}
              onClick={(e) => {
                e.stopPropagation()
                handleSquareClick(square)
              }}
            />
          )
        })
      )}

      {/* Pieces */}
      {rankList.map((rank) =>
        fileList.map((file) => {
          const piece = getPiece(file, rank)
          if (!piece) return null
          const square = squareAt(file, rank)
          const isWhite = piece === piece.toUpperCase()
          return (
            <text
              key={`${file}${rank}-piece`}
              x={FILES.indexOf(file as never) * squareSize + squareSize / 2}
              y={(8 - rank) * squareSize + squareSize * 0.62}
              textAnchor="middle"
              fontSize={squareSize * 0.62}
              fontFamily="DejaVu Sans, Arial, sans-serif"
              style={{
                cursor: disabled ? 'default' : 'pointer',
                dominantBaseline: 'middle',
                userSelect: 'none',
                filter: 'url(#neon-piece-glow)',
              }}
              onClick={(e) => {
                e.stopPropagation()
                handleSquareClick(square)
              }}
              fill={isWhite ? '#FCEE09' : '#FF2A6D'}
            >
              {PIECE_UNICODE[piece]}
            </text>
          )
        })
      )}
    </svg>
  )
}

function squareCoord(
  square: Square,
  size: number,
  flip: boolean
): { x: number; y: number } {
  const file = FILES.indexOf(square[0] as never)
  const rank = 8 - Number(square[1])
  const x = flip ? (7 - file) * size : file * size
  const y = flip ? rank * size : (7 - rank) * size
  return { x, y }
}
