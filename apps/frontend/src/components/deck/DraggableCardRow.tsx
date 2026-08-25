import { useDraggable } from '@dnd-kit/core'
import type { CardResult } from '../../lib/trpc-types'
import ManaCost from './ManaCost'
import HoverCardPreview from './HoverCardPreview'
import { TrashIcon, OwnedIcon } from './icons'

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
}: DraggableCardRowProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: dragId,
    data: { oracleId, card },
  })

  return (
    <li
      ref={setNodeRef}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 10 } : undefined}
      className={`relative flex items-center gap-2 px-3 py-1.5 text-sm ${isDragging ? 'opacity-30' : ''}`}
    >
      <HoverCardPreview image={card?.imageUris?.normal} oracleId={oracleId} disabled={isDragging}>
        <div className="flex flex-1 items-center gap-2">
          <div
            {...listeners}
            {...attributes}
            title="Drag to move to another block"
            className="flex min-w-0 flex-1 cursor-grab items-center gap-2 active:cursor-grabbing"
          >
            {card?.manaCost && (
              <span className="w-16 shrink-0">
                <ManaCost cost={card.manaCost} size={14} />
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

            <button
              type="button"
              onClick={() => onToggleOwned(oracleId)}
              aria-pressed={owned}
              aria-label={owned ? `Remove ${card?.name ?? 'card'} from your collection` : `Mark ${card?.name ?? 'card'} as owned`}
              title={owned ? 'You own this card' : 'Mark as owned'}
              className={`shrink-0 ${owned ? 'text-forge-ember' : 'text-forge-text-muted hover:text-forge-ember'}`}
            >
              <OwnedIcon owned={owned} />
            </button>

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
