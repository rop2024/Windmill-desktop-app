import { useCallback } from 'react'
import type { JSX } from 'react'
import { type MoveNode } from '@pgn/types'

type MoveListProps = {
  roots: MoveNode[]
  currentNodeId: string | null
  onSelect: (nodeId: string) => void
}

function moveNumber(node: MoveNode): number {
  return Math.ceil(node.ply / 2)
}

function isWhite(node: MoveNode): boolean {
  return node.ply % 2 === 1
}

function renderVariations(
  node: MoveNode,
  currentNodeId: string | null,
  onSelect: (nodeId: string) => void,
  depth: number
): JSX.Element | null {
  const variations = node.children.slice(1)
  if (variations.length === 0) return null

  return (
    <ul
      className="pl-4 space-y-1"
      style={{ marginLeft: depth * 16 }}
    >
      {variations.map((variation) => (
        <li key={variation.id} className="flex items-baseline gap-1">
          <span className="text-xs text-gray-500 italic">({variation.san}</span>
          {variation.comment && (
            <span className="text-xs text-gray-400">{` {${variation.comment}}`}</span>
          )}
          {variation.nags.length > 0 && (
            <span className="text-xs text-gray-400">{` ${variation.nags.join(' ')}`}</span>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onSelect(variation.id)
            }}
            className="text-xs text-blue-600 hover:underline ml-1 px-1"
          >
            {variation.children.length > 0 ? '…' : ')'}
          </button>
          {variation.children.length > 0 && (
            <span className="text-xs text-gray-500 italic">)</span>
          )}
          {renderVariations(variation, currentNodeId, onSelect, depth + 1)}
        </li>
      ))}
    </ul>
  )
}

export default function MoveList({
  roots,
  currentNodeId,
  onSelect
}: MoveListProps) {
  const mainline = useCallback(() => {
    const line: MoveNode[] = []
    let node: MoveNode | null = roots[0] ?? null
    while (node) {
      line.push(node)
      node = node.children[0] ?? null
    }
    return line
  }, [roots])

  const line = mainline()

  return (
    <div className="movelist max-h-[400px] overflow-y-auto pr-2">
      <ul className="space-y-1.5">
        {line.map((node, index) => {
          const isCurrent = node.id === currentNodeId
          const num = moveNumber(node)
          const prev = line[index - 1]
          const showNumber = !prev || moveNumber(prev) !== num

          return (
            <li key={node.id} className="flex items-baseline gap-1 py-0.5">
              {showNumber && isWhite(node) && (
                <span className="w-10 text-xs text-gray-500 font-mono">{num}.</span>
              )}
              {!isWhite(node) && showNumber && prev && moveNumber(prev) === num && (
                <span className="w-10 text-xs text-gray-500 font-mono">{num}…</span>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onSelect(node.id)
                }}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-sm transition ${
                  isCurrent
                    ? 'bg-blue-100 text-blue-900 font-semibold border border-blue-200'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {node.san}
                {node.nags.length > 0 && (
                  <span className="text-xs text-gray-400 ml-0.5">{node.nags.join(' ')}</span>
                )}
                {node.comment && (
                  <span className="text-xs text-gray-400 ml-1 italic">{`{${node.comment}}`}</span>
                )}
              </button>
              {renderVariations(node, currentNodeId, onSelect, 1)}
            </li>
          )
        })}
      </ul>
      {line.length === 0 && (
        <div className="text-sm text-gray-500 text-center py-4">No moves.</div>
      )}
    </div>
  )
}
