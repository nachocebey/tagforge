import { useEffect, useMemo, useRef, useState } from 'react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import type { CardResult, DeckBlock as DeckBlockType } from '../../lib/trpc-types'
import { BASIC_LAND_NAMES } from '../../lib/basic-lands'
import { TYPE_GROUPS, TYPE_GROUP_LABELS, typeGroupOf } from '../../lib/card-type-groups'
import { formatBlock } from '../../lib/decklist-format'
import CardSearchBox from './CardSearchBox'
import DraggableCardRow from './DraggableCardRow'
import ReplaceCardModal from './ReplaceCardModal'
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
  // Every block in the deck (Considering included) — used to compute a row's
  // "Add also..." target list (every block that doesn't already hold this
  // card, for real or as a shadow).
  allBlocks: DeckBlockType[]
  onAddAlso: (targetBlockId: string, oracleId: string) => void
  onRemoveShadowCard: (oracleId: string) => void
  // Set for the one block just created via the drag-drop panel's "Create
  // new" option — focuses (and selects) the name input on mount so the
  // user can immediately overwrite the "NEW BLOCK" default. Consumed once:
  // the parent clears it via onAutoFocused right after.
  autoFocusName?: boolean
  onAutoFocused?: () => void
  // "Replace with..." pool + action — only offered on real rows in a
  // normal block (not Considering's own rows, not shadow references: there
  // isn't a single "this block" to swap within for either of those).
  consideringOracleIds: string[]
  onReplaceCard: (oldOracleId: string, newOracleId: string) => void
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
  allBlocks,
  onAddAlso,
  onRemoveShadowCard,
  autoFocusName = false,
  onAutoFocused,
  consideringOracleIds,
  onReplaceCard,
}: DeckBlockProps) {
  const isConsidering = variant === 'considering'
  const nameInputRef = useRef<HTMLInputElement>(null)
  const [searching, setSearching] = useState(false)
  // Set when a row's eye icon is clicked — opens the same search panel but
  // with this card shown in the preview pane and an empty search box,
  // rather than to add a new card.
  const [viewingCard, setViewingCard] = useState<CardResult | null>(null)
  const [copied, setCopied] = useState(false)
  // Set when a row's "Replace with..." is clicked — the oracle_id being
  // replaced, so the modal knows what to match tags against.
  const [replacingOracleId, setReplacingOracleId] = useState<string | null>(null)
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

  useEffect(() => {
    if (!autoFocusName) return
    nameInputRef.current?.focus()
    nameInputRef.current?.select()
    onAutoFocused?.()
    // onAutoFocused intentionally left out — it's a fresh closure every
    // render, and re-running this on that change would refocus the input
    // whenever the parent happens to re-render for an unrelated reason.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFocusName])

  async function handleCopy() {
    await navigator.clipboard.writeText(formatBlock(block, cardsById))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  // Basics (the singleton exception) can have many copies of the same
  // oracle_id — group them into one row with a xN count and +/- controls
  // instead of repeating an identical row per copy. Shadow references (from
  // another row's "Add also...") are appended as their own single-count
  // entries, then the whole thing is ordered by the global sort selector
  // (mana cost/price/release date/name), same as every other block.
  const combinedEntries = useMemo(() => {
    const counts = new Map<string, number>()
    for (const oracleId of block.cardOracleIds) counts.set(oracleId, (counts.get(oracleId) ?? 0) + 1)
    const real = [...counts.entries()].map(([oracleId, count]) => ({ oracleId, count, isShadow: false }))
    const shadow = (block.shadowOracleIds ?? []).map((oracleId) => ({ oracleId, count: 1, isShadow: true }))
    return [...real, ...shadow].sort(
      (a, b) => (sortIndex.get(a.oracleId) ?? Infinity) - (sortIndex.get(b.oracleId) ?? Infinity),
    )
  }, [block.cardOracleIds, block.shadowOracleIds, sortIndex])

  // Considering only: bucket the same (already sorted) entries by primary
  // card type — a "maybe pile" is easier to scan grouped by Creatures/
  // Lands/etc. than as one long undifferentiated list.
  const groupedByType = useMemo(() => {
    if (!isConsidering) return null
    const buckets = new Map<string, typeof combinedEntries>()
    for (const entry of combinedEntries) {
      const card = cardsById.get(entry.oracleId)
      const group = card ? typeGroupOf(card) : 'Other'
      if (!buckets.has(group)) buckets.set(group, [])
      buckets.get(group)!.push(entry)
    }
    return TYPE_GROUPS.map((g) => [g, buckets.get(g) ?? []] as const).filter(([, entries]) => entries.length > 0)
  }, [isConsidering, combinedEntries, cardsById])

  // Every other block that doesn't already hold this card (for real, or as
  // its own shadow reference) — the target list for this row's "Add
  // also..." menu.
  function addAlsoTargets(oracleId: string) {
    return allBlocks
      .filter(
        (b) =>
          b.id !== block.id && !b.cardOracleIds.includes(oracleId) && !(b.shadowOracleIds ?? []).includes(oracleId),
      )
      .map((b) => ({ id: b.id, name: b.name }))
  }

  // Once a block has anything visible in it, it gets the same fixed height
  // as every other populated block (card list scrolls internally) instead
  // of growing with its card count — that growth was what made the grid
  // reflow unpredictably every time a card was added anywhere. An empty
  // block keeps its small natural size until that first card lands.
  const hasContent = combinedEntries.length > 0
  // Lands is the one block every deck leans on most — flagging it in the
  // accent color makes it easy to spot at a glance in a grid full of
  // otherwise identically-styled blocks.
  const isLandsBlock = !isConsidering && block.name.toUpperCase() === 'LANDS'

  return (
    <div
      ref={setNodeRef}
      className={
        isConsidering
          ? `mb-8 flex w-full flex-col border border-dashed bg-forge-surface transition-colors ${
              isOver ? 'border-forge-ember' : 'border-forge-border'
            }`
          : `flex w-full flex-col border bg-forge-surface transition-colors ${
              collapsed ? '' : hasContent ? 'h-[26rem]' : 'min-h-[6rem]'
            } ${isOver || isLandsBlock ? 'border-forge-ember' : 'border-forge-border'} ${isDragging ? 'opacity-40' : ''}`
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
            ref={nameInputRef}
            value={block.name}
            onChange={(e) => onRename(e.target.value)}
            onKeyDown={(e) => {
              // The name is already saved on every keystroke (autosave is
              // debounced from there, same as everything else) — Enter just
              // signals "I'm done", so drop focus rather than doing nothing.
              if (e.key === 'Enter') e.currentTarget.blur()
            }}
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
          {isConsidering ? (
            <div className="min-h-[2rem] columns-3 gap-x-4">
              {groupedByType!.map(([group, entries]) => (
                <div key={group} className="mb-3 break-inside-avoid">
                  <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-forge-text-muted">
                    {TYPE_GROUP_LABELS[group]} · {entries.length}
                  </p>
                  <ul className="divide-y divide-forge-border">
                    {entries.map(({ oracleId, count, isShadow }) => {
                      const card = cardsById.get(oracleId)
                      const isRepeatable = !isShadow && card ? BASIC_LAND_NAMES.includes(card.name) : false
                      return (
                        <DraggableCardRow
                          key={oracleId}
                          dragId={`${block.id}::${oracleId}`}
                          oracleId={oracleId}
                          card={card}
                          count={count}
                          isRepeatable={isRepeatable}
                          isShadow={isShadow}
                          owned={ownedOracleIds.has(oracleId)}
                          onAddCard={onAddCard}
                          onRemoveCard={(oid) => (isShadow ? onRemoveShadowCard(oid) : onRemoveCard(oid))}
                          onToggleOwned={onToggleOwned}
                          onViewCard={setViewingCard}
                          addAlsoTargets={addAlsoTargets(oracleId)}
                          onAddAlso={(targetBlockId) => onAddAlso(targetBlockId, oracleId)}
                          breakInsideAvoid
                        />
                      )
                    })}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <ul
              className={`divide-y divide-forge-border ${
                hasContent ? 'min-h-0 flex-1 overflow-y-auto' : 'min-h-[2rem]'
              }`}
            >
              {combinedEntries.map(({ oracleId, count, isShadow }) => {
                const card = cardsById.get(oracleId)
                const isRepeatable = !isShadow && card ? BASIC_LAND_NAMES.includes(card.name) : false
                return (
                  <DraggableCardRow
                    key={oracleId}
                    dragId={`${block.id}::${oracleId}`}
                    oracleId={oracleId}
                    card={card}
                    count={count}
                    isRepeatable={isRepeatable}
                    isShadow={isShadow}
                    owned={ownedOracleIds.has(oracleId)}
                    onAddCard={onAddCard}
                    onRemoveCard={(oid) => (isShadow ? onRemoveShadowCard(oid) : onRemoveCard(oid))}
                    onToggleOwned={onToggleOwned}
                    onViewCard={setViewingCard}
                    addAlsoTargets={addAlsoTargets(oracleId)}
                    onAddAlso={(targetBlockId) => onAddAlso(targetBlockId, oracleId)}
                    onReplace={isShadow ? undefined : () => setReplacingOracleId(oracleId)}
                  />
                )
              })}
            </ul>
          )}

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
            {(searching || viewingCard) && (
              <CardSearchBox
                commanderColorIdentity={commanderColorIdentity}
                excludeOracleIds={excludeOracleIds}
                previewOnlyCard={viewingCard ?? undefined}
                blockName={block.name}
                onSelect={(card) => {
                  onAddCard(card)
                }}
                onClose={() => {
                  setSearching(false)
                  setViewingCard(null)
                }}
              />
            )}
          </div>
        </>
      )}

      {replacingOracleId && (
        <ReplaceCardModal
          sourceOracleId={replacingOracleId}
          consideringOracleIds={consideringOracleIds}
          cardsById={cardsById}
          onReplace={(newOracleId) => {
            onReplaceCard(replacingOracleId, newOracleId)
            setReplacingOracleId(null)
          }}
          onClose={() => setReplacingOracleId(null)}
        />
      )}
    </div>
  )
}
