import { useDraggable } from '@dnd-kit/core'
import { trpc } from '../../lib/trpc'
import type { CardResult } from '../../lib/trpc-types'
import ManaCost from './ManaCost'
import HoverCardPreview from './HoverCardPreview'
import { CheckIcon } from './icons'
import CollapsiblePanel from './CollapsiblePanel'

interface CommanderRecommendationsProps {
  commanderName: string
  // Every oracle_id currently anywhere in the deck or Considering — purely
  // for the "already added" badge below. This list is never mutated by
  // dragging from here: it's a static read of EDHREC's own data, and a
  // drop always *copies* a card into the target block, never removes it
  // from this list.
  presentOracleIds: Set<string>
}

interface RecommendedCardRow {
  card: CardResult
  synergy: number
  deckPercent: number
}

// Shares the same DndContext as the deck's own cards (see DeckBuildPage's
// handleDragStart/handleDragEnd) — prefixed so a drop can tell "add this
// recommended card to block X" apart from "move this deck card between
// blocks", since a recommendation has no block of its own to move *from*.
// Every block is an equally valid drop target, Considering included — no
// destination gets special-cased here.
export const RECOMMENDATION_DRAG_PREFIX = 'recommend::'

function RecommendationRow({ entry, isPresent }: { entry: RecommendedCardRow; isPresent: boolean }) {
  const { card } = entry
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${RECOMMENDATION_DRAG_PREFIX}${card.oracleId}`,
    data: { oracleId: card.oracleId, card },
    // Already placed somewhere — dragging it again would create a
    // singleton-rule-breaking duplicate, so the drag itself is disabled,
    // not just visually discouraged.
    disabled: isPresent,
  })

  // The dimming lives on the two content wrappers below, not on <li> or on
  // HoverCardPreview's own wrapper — opacity cascades to every descendant
  // regardless of position scheme, and the floating preview image is a
  // fixed-positioned descendant of that wrapper. Dimming the <li> dimmed
  // the big preview image too; dimming just the row's own content doesn't.
  const dimmed = isDragging || isPresent
  return (
    <li className="flex items-center gap-2 px-3 py-1.5 text-sm">
      <HoverCardPreview image={card.imageUris?.normal} oracleId={card.oracleId} disabled={isDragging}>
        <div
          ref={setNodeRef}
          {...listeners}
          {...attributes}
          title={isPresent ? 'Already in your deck or Considering' : 'Drag into any block'}
          className={`flex min-w-0 flex-1 items-center gap-2 ${dimmed ? 'opacity-50' : ''} ${
            isPresent ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'
          }`}
        >
          {isPresent ? (
            <CheckIcon className="h-4 w-4 shrink-0 text-forge-ember" />
          ) : (
            card.manaCost && (
              <span className="w-16 shrink-0">
                <ManaCost cost={card.manaCost} size={14} wrap />
              </span>
            )
          )}
          <span className="min-w-0 flex-1 truncate text-forge-text">{card.name}</span>
        </div>
      </HoverCardPreview>

      <div className={`ml-auto flex shrink-0 items-center gap-3 ${dimmed ? 'opacity-50' : ''}`}>
        <span className="w-10 shrink-0 text-right text-xs text-forge-text-muted" title="% of decks with this commander that run it">
          {Math.round(entry.deckPercent)}%
        </span>
        <span className="w-12 shrink-0 text-right text-xs text-forge-text-muted">
          {card.priceUsd ? `$${card.priceUsd}` : '—'}
        </span>
      </div>
    </li>
  )
}

function RecommendationSection({
  title,
  cards,
  presentOracleIds,
}: {
  title: string
  cards: RecommendedCardRow[]
  presentOracleIds: Set<string>
}) {
  if (cards.length === 0) return null
  return (
    <div className="border border-forge-border bg-forge-bg">
      <p className="border-b border-forge-border px-3 py-2 text-xs uppercase tracking-wide text-forge-text-muted">
        {title} · {cards.length}
      </p>
      {/* The curated lists (High Synergy, Top Cards, ...) top out around
          5-10 cards; EDHREC's per-type lists (Creatures, Instants, ...)
          run to 20-50, so those get a scroll cap instead of pushing the
          whole panel to an unwieldy height. */}
      <ul className="max-h-72 divide-y divide-forge-border overflow-y-auto">
        {cards.map((entry) => (
          <RecommendationRow
            key={entry.card.oracleId}
            entry={entry}
            isPresent={presentOracleIds.has(entry.card.oracleId)}
          />
        ))}
      </ul>
    </div>
  )
}

// Self-contained EDHREC recommendations panel — nothing outside this file
// knows EDHREC exists. If that data source is ever swapped or dropped, only
// this component and the backend's edhrec/ module need to change. Fails
// silent: the backend never errors for this, it just returns empty lists,
// so an EDHREC hiccup means this renders nothing rather than breaking the
// build screen.
export default function CommanderRecommendations({ commanderName, presentOracleIds }: CommanderRecommendationsProps) {
  const query = trpc.edhrec.recommendations.useQuery({ commanderName })
  const highSynergy = query.data?.highSynergy ?? []
  const topCards = query.data?.topCards ?? []
  const gameChangers = query.data?.gameChangers ?? []
  const newCards = query.data?.newCards ?? []
  const creatures = query.data?.creatures ?? []
  const instants = query.data?.instants ?? []
  const sorceries = query.data?.sorceries ?? []
  const enchantments = query.data?.enchantments ?? []

  const allCategories = [highSynergy, topCards, gameChangers, newCards, creatures, instants, sorceries, enchantments]
  if (allCategories.every((c) => c.length === 0)) return null

  return (
    <CollapsiblePanel
      title="Recommendations"
      subtitle="drag a card into any block"
      trailing="via EDHREC"
    >
      <div className="grid grid-cols-1 gap-4 p-3 lg:grid-cols-2 xl:grid-cols-4">
        <RecommendationSection title="High Synergy Cards" cards={highSynergy} presentOracleIds={presentOracleIds} />
        <RecommendationSection title="Top Cards" cards={topCards} presentOracleIds={presentOracleIds} />
        <RecommendationSection title="Game Changers" cards={gameChangers} presentOracleIds={presentOracleIds} />
        <RecommendationSection title="New Cards" cards={newCards} presentOracleIds={presentOracleIds} />
        <RecommendationSection title="Creatures" cards={creatures} presentOracleIds={presentOracleIds} />
        <RecommendationSection title="Instants" cards={instants} presentOracleIds={presentOracleIds} />
        <RecommendationSection title="Sorceries" cards={sorceries} presentOracleIds={presentOracleIds} />
        <RecommendationSection title="Enchantments" cards={enchantments} presentOracleIds={presentOracleIds} />
      </div>
    </CollapsiblePanel>
  )
}
