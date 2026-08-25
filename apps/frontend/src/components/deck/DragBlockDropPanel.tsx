import { useDroppable } from '@dnd-kit/core'
import type { DeckBlock } from '../../lib/trpc-types'

// Prefixed so onDragEnd can tell a drop on the panel apart from a drop on
// the block's own in-page card list — both are valid targets for the same
// block at once.
export const SIDE_PANEL_ID_PREFIX = 'sidepanel::'

interface DropTargetProps {
  block: DeckBlock
  isSource: boolean
}

function DropTarget({ block, isSource }: DropTargetProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `${SIDE_PANEL_ID_PREFIX}${block.id}` })

  return (
    <div
      ref={setNodeRef}
      className={`pointer-events-auto flex items-center justify-between gap-2 border px-3 py-2.5 text-sm transition-colors ${
        isOver ? 'border-forge-ember bg-forge-ember/10 text-forge-ember' : 'border-forge-border bg-forge-surface text-forge-text'
      } ${isSource ? 'opacity-40' : ''}`}
    >
      <span className="truncate">{block.name}</span>
      <span className="shrink-0 text-xs text-forge-text-muted">{block.cardOracleIds.length}</span>
    </div>
  )
}

interface DragBlockDropPanelProps {
  blocks: DeckBlock[]
  sourceBlockId: string
}

// Shown for the duration of a drag: a fixed, always-visible list of every
// block as a drop target, so the user doesn't have to hunt across a
// masonry layout (or scroll to an off-screen block) to find where to drop
// a card — they can drop here instead.
export default function DragBlockDropPanel({ blocks, sourceBlockId }: DragBlockDropPanelProps) {
  return (
    <div className="animate-rise-in pointer-events-none fixed inset-y-0 left-0 z-[90] flex w-64 flex-col justify-center gap-2 p-4">
      <p className="px-1 text-xs uppercase tracking-wide text-forge-text-muted">Drop into a block</p>
      <div className="no-scrollbar flex max-h-[70vh] flex-col gap-2 overflow-y-auto">
        {blocks.map((block) => (
          <DropTarget key={block.id} block={block} isSource={block.id === sourceBlockId} />
        ))}
      </div>
    </div>
  )
}
