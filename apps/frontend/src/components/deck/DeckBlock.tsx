import { useMemo, useState } from 'react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import type { CardResult, DeckBlock as DeckBlockType } from '../../lib/trpc-types'
import { BASIC_LAND_NAMES } from '../../lib/basic-lands'
import { formatBlock } from '../../lib/decklist-format'
import CardSearchBox from './CardSearchBox'
import DraggableCardRow from './DraggableCardRow'
import { CloseIcon, GripIcon } from './icons'

// Prefixes a block-reorder drag's id so DeckBuildPage's onDragEnd can tell
// it apart from a card drag (whose id is `${blockId}::${oracleId}`) — both
// share the same DndContext/sensors.
export const BLOCK_DRAG_PREFIX = 'blockdrag::'

interface DeckBlockProps {
  block: DeckBlockType
  cardsById: Map<string, CardResult>
  commanderColorIdentity: ('W' | 'U' | 'B' | 'R' | 'G')[]
  excludeOracleIds: string[]
  onRename: (name: string) => void
  onRemove: () => void
  onAddCard: (card: CardResult) => void
  onRemoveCard: (oracleId: string) => void
  // Deck-wide sort order (from the global sort selector) as an oracle_id ->
  // rank lookup — cards not present just sort last.
  sortIndex: Map<string, number>
  ownedOracleIds: Set<string>
  onToggleOwned: (oracleId: string) => void
  collapsed: boolean
  onToggleCollapsed: () => void
  // 'considering' renders the fixed "maybe pile" panel: full-width, name
  // isn't editable, and it can't be removed.
  variant?: 'normal' | 'considering'
}

export default function DeckBlock({
  block,
  cardsById,
  commanderColorIdentity,
  excludeOracleIds,
  onRename,
  onRemove,
  onAddCard,
  onRemoveCard,
  sortIndex,
  ownedOracleIds,
  onToggleOwned,
  collapsed,
  onToggleCollapsed,
  variant = 'normal',
}: DeckBlockProps) {
  const isConsidering = variant === 'considering'
  const [searching, setSearching] = useState(false)
  const [copied, setCopied] = useState(false)
  const { setNodeRef, isOver } = useDroppable({ id: block.id })
  // A block's own droppable region (above) doubles as the drop target for
  // reordering — dropping a dragged block anywhere within another block's
  // bounds moves it to that position. Considering isn't reorderable.
  const {
    attributes: gripAttributes,
    listeners: gripListeners,
    setNodeRef: setGripRef,
    isDragging,
  } = useDraggable({ id: `${BLOCK_DRAG_PREFIX}${block.id}`, disabled: isConsidering })

  async function handleCopy() {
    await navigator.clipboard.writeText(formatBlock(block, cardsById))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  // Basics (the singleton exception) can have many copies of the same
  // oracle_id — group them into one row with a xN count and +/- controls
  // instead of repeating an identical row per copy. Ordered by the global
  // sort selector (mana cost/price/release date/name), which applies inside
  // every block at once rather than to any one block individually.
  const groupedEntries = useMemo(() => {
    const counts = new Map<string, number>()
    for (const oracleId of block.cardOracleIds) counts.set(oracleId, (counts.get(oracleId) ?? 0) + 1)
    return [...counts.entries()].sort(
      ([a], [b]) => (sortIndex.get(a) ?? Infinity) - (sortIndex.get(b) ?? Infinity),
    )
  }, [block.cardOracleIds, sortIndex])

  return (
    <div
      ref={setNodeRef}
      className={
        isConsidering
          ? `mb-8 flex w-full flex-col border border-dashed bg-forge-surface transition-colors ${
              isOver ? 'border-forge-ember' : 'border-forge-border'
            }`
          : `mb-3 flex w-full break-inside-avoid flex-col border bg-forge-surface transition-colors ${
              collapsed ? '' : 'min-h-[6rem]'
            } ${isOver ? 'border-forge-ember' : 'border-forge-border'} ${isDragging ? 'opacity-40' : ''}`
      }
    >
      <div className="flex items-center justify-between gap-2 border-b border-forge-border px-3 py-2">
        {!isConsidering && (
          <button
            ref={setGripRef}
            {...gripListeners}
            {...gripAttributes}
            type="button"
            title="Drag to reorder block"
            aria-label="Drag to reorder block"
            className="shrink-0 cursor-grab text-forge-text-muted hover:text-forge-ember active:cursor-grabbing"
          >
            <GripIcon />
          </button>
        )}
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? 'Expand block' : 'Collapse block'}
          aria-expanded={!collapsed}
          className={`shrink-0 text-forge-text-muted transition-transform hover:text-forge-ember ${collapsed ? '-rotate-90' : ''}`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-4 w-4">
            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {isConsidering ? (
          <div className="min-w-0 flex-1">
            <span className="font-display text-base uppercase tracking-wide text-forge-text">{block.name}</span>
            <span className="ml-2 text-xs italic text-forge-text-muted">not counted toward your deck</span>
          </div>
        ) : (
          <input
            value={block.name}
            onChange={(e) => onRename(e.target.value)}
            aria-label="Block name"
            className="min-w-0 flex-1 bg-transparent font-display text-base uppercase tracking-wide text-forge-text outline-none hover:bg-forge-bg focus:bg-forge-bg"
          />
        )}
        <span className="shrink-0 text-xs text-forge-text-muted">{block.cardOracleIds.length}</span>
        <button
          type="button"
          onClick={handleCopy}
          disabled={block.cardOracleIds.length === 0}
          aria-label={copied ? 'Copied' : 'Copy block to clipboard'}
          title={copied ? 'Copied!' : 'Copy block to clipboard'}
          className="shrink-0 text-forge-text-muted hover:text-forge-ember disabled:pointer-events-none disabled:opacity-30"
        >
          {copied ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-4 w-4 text-forge-ember">
              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
              <rect x="9" y="9" width="12" height="12" rx="1.5" />
              <path d="M5 15V4.5A1.5 1.5 0 0 1 6.5 3H15" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
        {!isConsidering && (
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove block"
            className="shrink-0 text-forge-text-muted hover:text-red-400"
          >
            <CloseIcon />
          </button>
        )}
      </div>

      {!collapsed && (
        <>
          <ul className="min-h-[2rem] divide-y divide-forge-border">
            {groupedEntries.map(([oracleId, count]) => {
              const card = cardsById.get(oracleId)
              const isRepeatable = card ? BASIC_LAND_NAMES.includes(card.name) : false
              return (
                <DraggableCardRow
                  key={oracleId}
                  dragId={`${block.id}::${oracleId}`}
                  oracleId={oracleId}
                  card={card}
                  count={count}
                  isRepeatable={isRepeatable}
                  owned={ownedOracleIds.has(oracleId)}
                  onAddCard={onAddCard}
                  onRemoveCard={onRemoveCard}
                  onToggleOwned={onToggleOwned}
                />
              )
            })}
          </ul>

          <div className="mt-auto p-2">
            {!searching && (
              <button
                type="button"
                onClick={() => setSearching(true)}
                className="w-full border border-dashed border-forge-border py-1.5 text-sm text-forge-text-muted transition-colors hover:border-forge-ember hover:text-forge-ember"
              >
                + Add card
              </button>
            )}
            {searching && (
              <CardSearchBox
                commanderColorIdentity={commanderColorIdentity}
                excludeOracleIds={excludeOracleIds}
                onSelect={(card) => {
                  onAddCard(card)
                }}
                onClose={() => setSearching(false)}
              />
            )}
          </div>
        </>
      )}
    </div>
  )
}
