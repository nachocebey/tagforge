import { useEffect, useRef, useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import type { CardResult } from '../../lib/trpc-types'
import ManaCost from './ManaCost'
import HoverCardPreview from './HoverCardPreview'
import { TrashIcon, OwnedIcon, KebabIcon } from './icons'

interface DraggableCardRowProps {
  dragId: string
  oracleId: string
  card: CardResult | undefined
  count: number
  isRepeatable: boolean
  owned: boolean
  onAddCard: (card: CardResult) => void
  onRemoveCard: (oracleId: string) => void
  onToggleOwned: (oracleId: string) => void
  onViewCard: (card: CardResult) => void
  // Set when the list itself is a CSS multi-column layout (Considering's
  // 3-column card list) so a row never gets visually split across columns.
  breakInsideAvoid?: boolean
  // True when this row is a reference created via "Add also..." rather than
  // the card's one real placement — not draggable, and dimmed the same way
  // an already-added recommendation is (see CommanderRecommendations).
  isShadow?: boolean
  // Other blocks this card could also be shown in — omitted (or empty)
  // hides/disables the "Add also..." menu item.
  addAlsoTargets?: { id: string; name: string }[]
  onAddAlso?: (targetBlockId: string) => void
  // Opens the "Replace with..." modal — omitted hides the menu item
  // entirely (Considering's own rows and shadow rows don't get one; see
  // DeckBlock).
  onReplace?: () => void
}

// Overflow menu for less-frequent per-card actions — kept out of the row
// itself so the row doesn't grow another icon every time a new action
// shows up. View/remove stay one click since those are used constantly.
// `open`/`onOpenChange` are lifted to the parent row, which disables the
// hover preview while the menu is open — otherwise picking an item that
// closes the (absolutely-positioned, DOM-descendant) menu removes it from
// under the cursor without ever firing a mouseleave on the row, leaving
// the floating preview image stuck on screen at its last position.
function CardRowMenu({
  card,
  owned,
  open,
  onOpenChange,
  onToggleOwned,
  onViewCard,
  addAlsoTargets,
  onAddAlso,
  onReplace,
}: {
  card: CardResult | undefined
  owned: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  onToggleOwned: () => void
  onViewCard: () => void
  addAlsoTargets?: { id: string; name: string }[]
  onAddAlso?: (targetBlockId: string) => void
  onReplace?: () => void
}) {
  const setOpen = onOpenChange
  const [copied, setCopied] = useState(false)
  // Swaps the menu's contents for a block picker rather than opening a
  // second flyout — keeps the "which blocks can I add this to" logic in one
  // fixed-position panel instead of juggling two.
  const [pickingBlock, setPickingBlock] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  useEffect(() => {
    if (!open) setPickingBlock(false)
  }, [open])

  async function handleCopy() {
    if (!card) return
    await navigator.clipboard.writeText(`${card.name}\n\n${card.oracleText ?? ''}`)
    setCopied(true)
    setTimeout(() => {
      setCopied(false)
      setOpen(false)
    }, 900)
  }

  return (
    <div ref={menuRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label="More actions"
        aria-expanded={open}
        title="More actions"
        className="text-forge-text-muted hover:text-forge-ember"
      >
        <KebabIcon />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-56 border border-forge-border bg-forge-surface py-1 shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
          {!pickingBlock ? (
            <>
              <button
                type="button"
                disabled={!card}
                onClick={() => {
                  onViewCard()
                  setOpen(false)
                }}
                className="flex w-full items-center px-3 py-2 text-left text-xs text-forge-text hover:bg-forge-surface-hover disabled:opacity-40"
              >
                View details
              </button>
              <button
                type="button"
                disabled={!card}
                onClick={handleCopy}
                className="flex w-full items-center px-3 py-2 text-left text-xs text-forge-text hover:bg-forge-surface-hover disabled:opacity-40"
              >
                {copied ? 'Copied!' : 'Copy name + oracle text'}
              </button>
              <button
                type="button"
                onClick={() => {
                  onToggleOwned()
                  setOpen(false)
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-forge-text hover:bg-forge-surface-hover"
              >
                <OwnedIcon owned={owned} className="h-3.5 w-3.5" />
                {owned ? 'Remove from collection' : 'Add to collection'}
              </button>
              {onAddAlso && (
                <button
                  type="button"
                  disabled={!addAlsoTargets || addAlsoTargets.length === 0}
                  onClick={() => setPickingBlock(true)}
                  title={!addAlsoTargets || addAlsoTargets.length === 0 ? 'No other blocks to add into' : undefined}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-xs text-forge-text hover:bg-forge-surface-hover disabled:opacity-40"
                >
                  Add also...
                  <span aria-hidden>›</span>
                </button>
              )}
              {onReplace && (
                <button
                  type="button"
                  onClick={() => {
                    onReplace()
                    setOpen(false)
                  }}
                  className="flex w-full items-center px-3 py-2 text-left text-xs text-forge-text hover:bg-forge-surface-hover"
                >
                  Replace with...
                </button>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setPickingBlock(false)}
                className="flex w-full items-center gap-1 px-3 py-2 text-left text-xs text-forge-text-muted hover:bg-forge-surface-hover"
              >
                <span aria-hidden>‹</span> Back
              </button>
              <div className="max-h-48 overflow-y-auto">
                {addAlsoTargets?.map((target) => (
                  <button
                    key={target.id}
                    type="button"
                    onClick={() => {
                      onAddAlso?.(target.id)
                      setOpen(false)
                    }}
                    className="flex w-full items-center px-3 py-2 text-left text-xs text-forge-text hover:bg-forge-surface-hover"
                  >
                    {target.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default function DraggableCardRow({
  dragId,
  oracleId,
  card,
  count,
  isRepeatable,
  owned,
  onAddCard,
  onRemoveCard,
  onToggleOwned,
  onViewCard,
  breakInsideAvoid = false,
  isShadow = false,
  addAlsoTargets,
  onAddAlso,
  onReplace,
}: DraggableCardRowProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: dragId,
    data: { oracleId, card },
    disabled: isShadow,
  })
  const [menuOpen, setMenuOpen] = useState(false)

  // Dimming lives on the two content wrappers below, not on <li> or on
  // HoverCardPreview's own wrapper — opacity cascades to every descendant
  // regardless of position scheme, and the floating preview image is a
  // fixed-positioned descendant of that wrapper (see CommanderRecommendations,
  // where dimming the <li> itself dimmed the big preview image too).
  const dimmed = isDragging || isShadow

  return (
    <li
      ref={setNodeRef}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 10 } : undefined}
      onContextMenu={(e) => {
        // Right-click is a shortcut into the same overflow menu the kebab
        // icon opens, not a second menu — swallow the browser's own
        // context menu so it doesn't show up alongside it.
        e.preventDefault()
        setMenuOpen(true)
      }}
      className={`relative flex items-center gap-2 px-3 py-1.5 text-sm ${breakInsideAvoid ? 'break-inside-avoid' : ''}`}
    >
      <HoverCardPreview image={card?.imageUris?.normal} oracleId={oracleId} disabled={isDragging || menuOpen}>
        <div className={`flex min-w-0 flex-1 items-center gap-2 ${dimmed ? 'opacity-30' : ''}`}>
          <div
            {...listeners}
            {...attributes}
            title={isShadow ? 'Also shown here — drag disabled' : 'Drag to move to another block'}
            className={`flex min-w-0 flex-1 items-center gap-2 ${
              isShadow ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'
            }`}
          >
            {card?.manaCost && (
              <span className="w-16 shrink-0">
                <ManaCost cost={card.manaCost} size={14} wrap />
              </span>
            )}
            <span className="min-w-0 flex-1 truncate text-forge-text">
              {card?.name ?? oracleId}
              {count > 1 && <span className="ml-1.5 text-xs text-forge-text-muted">x{count}</span>}
            </span>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-3">
            <span className="w-12 shrink-0 text-right text-xs text-forge-text-muted">
              {card?.priceUsd ? `$${card.priceUsd}` : '—'}
            </span>

            <CardRowMenu
              card={card}
              owned={owned}
              open={menuOpen}
              onOpenChange={setMenuOpen}
              onToggleOwned={() => onToggleOwned(oracleId)}
              onViewCard={() => card && onViewCard(card)}
              addAlsoTargets={addAlsoTargets}
              onAddAlso={onAddAlso}
              onReplace={onReplace}
            />

            {isRepeatable ? (
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onRemoveCard(oracleId)}
                  aria-label={`Remove one ${card?.name}`}
                  className="flex h-5 w-5 items-center justify-center border border-forge-border text-forge-text-muted hover:border-forge-ember hover:text-forge-ember"
                >
                  −
                </button>
                <span className="w-4 text-center text-xs text-forge-text">{count}</span>
                <button
                  type="button"
                  onClick={() => card && onAddCard(card)}
                  aria-label={`Add one more ${card?.name}`}
                  className="flex h-5 w-5 items-center justify-center border border-forge-border text-forge-text-muted hover:border-forge-ember hover:text-forge-ember"
                >
                  +
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => onRemoveCard(oracleId)}
                aria-label={`Remove ${card?.name ?? 'card'}`}
                className="shrink-0 text-forge-text-muted hover:text-red-400"
              >
                <TrashIcon />
              </button>
            )}
          </div>
        </div>
      </HoverCardPreview>
    </li>
  )
}
