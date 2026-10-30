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
    <ul className="pl-6 space-y-1" style={{ marginLeft: depth * 20 }}>
      {variations.map((variation) => (
        <li key={variation.id} className="flex items-baseline gap-1">
          <span className="text-xs text-text-dim font-mono italic">({variation.san}</span>
          {variation.comment && (
            <span className="text-xs text-text-dim">{` {${variation.comment}}`}</span>
          )}
          {variation.nags.length > 0 && (
            <span className="text-xs text-text-dim">{` ${variation.nags.join(' ')}`}</span>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onSelect(variation.id)
            }}
            className="text-xs text-cyan font-mono hover:text-yellow ml-1 px-1 focus-visible:outline-2 focus-visible:outline-cyan"
          >
            {variation.children.length > 0 ? '…' : ')'}
          </button>
          {variation.children.length > 0 && (
            <span className="text-xs text-text-dim font-mono italic">)</span>
          )}
          {renderVariations(variation, currentNodeId, onSelect, depth + 1)}
        </li>
      ))}
    </ul>
  )
}

export default function WindmillMoveList({
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
    <div className="movelist max-h-[420px] overflow-y-auto pr-2">
      <ul className="divide-y divide-border/50">
        {line.map((node, index) => {
          const isCurrent = node.id === currentNodeId
          const num = moveNumber(node)
          const prev = line[index - 1]
          const showNumber = !prev || moveNumber(prev) !== num
          const rowClass = isCurrent
            ? 'bg-yellow text-background font-bold'
            : 'text-text-muted hover:bg-white/5'

          return (
            <li key={node.id} className="grid grid-cols-3 gap-2 items-baseline py-1.5 px-2 transition-colors">
              {showNumber && isWhite(node) && (
                <span className={`col-span-1 text-xs font-mono ${isCurrent ? 'text-background' : 'text-text-muted'}`}>
                  {num}.
                </span>
              )}
              {!isWhite(node) && showNumber && prev && moveNumber(prev) === num && (
                <span className={`col-span-1 text-xs font-mono ${isCurrent ? 'text-background' : 'text-text-muted'}`}>
                  {num}…
                </span>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onSelect(node.id)
                }}
                className={[
                  'col-span-2 flex items-center gap-1 px-2 py-0.5 text-xs font-mono uppercase transition-colors',
                  rowClass,
                  isCurrent ? 'rounded-none' : 'hover:bg-white/5',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {node.san}
                {node.nags.length > 0 && (
                  <span className="text-xs text-text-dim ml-0.5">{node.nags.join(' ')}</span>
                )}
                {node.comment && (
                  <span className="text-xs text-text-dim ml-1 italic">{`{${node.comment}}`}</span>
                )}
              </button>
              {renderVariations(node, currentNodeId, onSelect, 1)}
            </li>
          )
        })}
        {line.length === 0 && (
          <div className="py-4 text-center text-xs text-text-dim font-mono">No moves.</div>
        )}
      </ul>
    </div>
  )
}
