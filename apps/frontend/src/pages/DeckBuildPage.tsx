import { useState } from 'react'
import { keepPreviousData } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { trpc } from '../lib/trpc'
import { useDeckStructure } from '../lib/use-deck-structure'
import DeckNameEditor from '../components/deck/DeckNameEditor'
import CommanderHeader from '../components/deck/CommanderHeader'
import DeckBlock, { BLOCK_DRAG_PREFIX } from '../components/deck/DeckBlock'
import AddBlockTile from '../components/deck/AddBlockTile'
import ExportDeckModal from '../components/deck/ExportDeckModal'
import ImportDeckModal from '../components/deck/ImportDeckModal'
import ManaCost from '../components/deck/ManaCost'
import { GripIcon } from '../components/deck/icons'
import DragBlockDropPanel, { SIDE_PANEL_ID_PREFIX, CREATE_NEW_BLOCK_DROP_ID } from '../components/deck/DragBlockDropPanel'
import HandProbabilityRow from '../components/deck/HandProbabilityRow'
import ManaBasePanel from '../components/deck/ManaBasePanel'
import CommanderRecommendations, { RECOMMENDATION_DRAG_PREFIX } from '../components/deck/CommanderRecommendations'
import TagSearchModal from '../components/deck/TagSearchModal'
import CardSearchBox, { SEARCH_RESULT_DRAG_PREFIX } from '../components/deck/CardSearchBox'
import { CONSIDERING_BLOCK_ID, CONSIDERING_BLOCK_NAME } from '../lib/considering'
import type { CardResult, DeckDetail } from '../lib/trpc-types'

const COLOR_LETTERS = ['W', 'U', 'B', 'R', 'G'] as const
type ColorLetter = (typeof COLOR_LETTERS)[number]

// Global sort: reorders cards inside every block at once (the brief's
// "beside the header ... a global sort selector"), not per-block.
type BlockSortField = 'name' | 'cmc' | 'price' | 'released'
type SortDirection = 'asc' | 'desc'

const BLOCK_SORT_OPTIONS: { value: BlockSortField; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: 'cmc', label: 'Mana cost' },
  { value: 'price', label: 'Price' },
  { value: 'released', label: 'Release date' },
]

// Independent membership counts, not mutually-exclusive buckets — a card
// like "Artifact Creature" adds to both Artifacts and Creatures, matching
// how Moxfield's own type breakdown counts multi-typed cards.
const TYPE_COUNT_CATEGORIES: { type: string; label: string }[] = [
  { type: 'Creature', label: 'Creatures' },
  { type: 'Instant', label: 'Instants' },
  { type: 'Sorcery', label: 'Sorceries' },
  { type: 'Enchantment', label: 'Enchantments' },
  { type: 'Artifact', label: 'Artifacts' },
  { type: 'Land', label: 'Lands' },
]

function countByType(oracleIds: string[], cardsById: Map<string, CardResult>): Map<string, number> {
  const counts = new Map<string, number>(TYPE_COUNT_CATEGORIES.map(({ type }) => [type, 0]))
  for (const oracleId of oracleIds) {
    const card = cardsById.get(oracleId)
    if (!card) continue
    for (const { type } of TYPE_COUNT_CATEGORIES) {
      if (card.typeLine.includes(type)) counts.set(type, (counts.get(type) ?? 0) + 1)
    }
  }
  return counts
}

function DeckBuilder({ deck }: { deck: DeckDetail }) {
  const { id, name, commanders } = deck
  const {
    blocks,
    addBlock,
    createBlockWithCard,
    renameBlock,
    removeBlock,
    addCard,
    removeCard,
    addShadowCard,
    removeShadowCard,
    moveCard,
    reorderBlocks,
    importBlocks,
    replaceCard,
    clearDeck,
  } = useDeckStructure(id, deck.structure)
  const [showExport, setShowExport] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showTagSearch, setShowTagSearch] = useState(false)
  const [showFreeSearch, setShowFreeSearch] = useState(false)
  const [blockSort, setBlockSort] = useState<BlockSortField>('name')
  const [blockSortDirection, setBlockSortDirection] = useState<SortDirection>('asc')
  // Considering starts collapsed by default; every other block starts
  // expanded — ids not in this set are expanded.
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set([CONSIDERING_BLOCK_ID]))
  // Set right after "Create new" (in the drag-drop side panel) makes a
  // block, so that one block's name input can focus itself on mount —
  // cleared immediately once it's consumed.
  const [autoFocusBlockId, setAutoFocusBlockId] = useState<string | null>(null)
  const [activeDrag, setActiveDrag] = useState<{ oracleId: string; card?: CardResult; sourceBlockId: string } | null>(
    null,
  )
  const [draggingBlockName, setDraggingBlockName] = useState<string | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const utils = trpc.useUtils()
  const owned = trpc.collection.list.useQuery()
  const ownedOracleIds = new Set(owned.data ?? [])
  const markOwned = trpc.collection.mark.useMutation({ onSuccess: () => utils.collection.list.invalidate() })
  const unmarkOwned = trpc.collection.unmark.useMutation({ onSuccess: () => utils.collection.list.invalidate() })

  function handleToggleOwned(oracleId: string) {
    if (ownedOracleIds.has(oracleId)) unmarkOwned.mutate({ oracleId })
    else markOwned.mutate({ oracleId })
  }

  function handleClearDeck() {
    if (window.confirm('Remove every block and card from this deck? The commander stays, and Considering is left alone. This can\'t be undone.')) {
      clearDeck()
    }
  }

  function toggleCollapsed(blockId: string) {
    setCollapsedIds((prev) => {
      const next = new Set(prev)
      if (next.has(blockId)) next.delete(blockId)
      else next.add(blockId)
      return next
    })
  }

  // Considering is independently controlled — it starts collapsed by
  // default and only toggles from its own header, never from "collapse
  // all"/"expand all", which only ever touches the real deck's blocks.
  function toggleCollapseAll() {
    const normalIds = normalBlocks.map((b) => b.id)
    const allCollapsed = normalIds.length > 0 && normalIds.every((id) => collapsedIds.has(id))
    setCollapsedIds((prev) => {
      const next = new Set(prev)
      for (const id of normalIds) {
        if (allCollapsed) next.delete(id)
        else next.add(id)
      }
      return next
    })
  }

  // An EDHREC recommendation or a free-search result has no block to move
  // *from* — it's a new card being placed, not an existing one being
  // relocated — so neither drag id encodes a source block the way a real
  // card row's `${blockId}::${oracleId}` does. Returns the oracle_id for
  // either prefix, or null if `activeId` is a normal card-row drag.
  function sourcelessOracleId(activeId: string): string | null {
    if (activeId.startsWith(RECOMMENDATION_DRAG_PREFIX)) return activeId.slice(RECOMMENDATION_DRAG_PREFIX.length)
    if (activeId.startsWith(SEARCH_RESULT_DRAG_PREFIX)) return activeId.slice(SEARCH_RESULT_DRAG_PREFIX.length)
    return null
  }

  function handleDragStart(event: DragStartEvent) {
    const id = String(event.active.id)
    // A block's own grip handle — not a card row — is being dragged; skip
    // the card-drag side panel setup and show a block ghost instead.
    if (id.startsWith(BLOCK_DRAG_PREFIX)) {
      const blockId = id.slice(BLOCK_DRAG_PREFIX.length)
      setDraggingBlockName(blocks.find((b) => b.id === blockId)?.name ?? null)
      return
    }
    const data = event.active.data.current as { oracleId: string; card?: CardResult } | undefined
    const sourceBlockId = sourcelessOracleId(id) === null ? id.split('::')[0] : ''
    if (data) setActiveDrag({ ...data, sourceBlockId })
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    const activeId = String(active.id)

    if (activeId.startsWith(BLOCK_DRAG_PREFIX)) {
      setDraggingBlockName(null)
      if (over) reorderBlocks(activeId.slice(BLOCK_DRAG_PREFIX.length), String(over.id))
      return
    }

    setActiveDrag(null)
    // Dropped outside any block (or the side panel) — snap back, no-op.
    if (!over) return
    const overId = String(over.id)
    const sourceless = sourcelessOracleId(activeId)

    // "Create new" in the side panel — the target block doesn't exist yet,
    // so this can't resolve to a toBlockId the way every other drop target
    // does; make the block and place the card into it in one step instead.
    if (overId === CREATE_NEW_BLOCK_DROP_ID) {
      const oracleId = sourceless ?? activeId.split('::')[1]
      const fromBlockId = sourceless === null ? activeId.split('::')[0] : undefined
      setAutoFocusBlockId(createBlockWithCard(oracleId, fromBlockId))
      return
    }

    // The side panel's drop targets share ids with the in-page blocks
    // (prefixed) so both are valid drop targets for the same block at once.
    const toBlockId = overId.startsWith(SIDE_PANEL_ID_PREFIX) ? overId.slice(SIDE_PANEL_ID_PREFIX.length) : overId

    if (sourceless !== null) {
      addCard(toBlockId, sourceless)
      return
    }

    const [fromBlockId, oracleId] = activeId.split('::')
    moveCard(fromBlockId, toBlockId, oracleId)
  }

  const commanderColorIdentity = [...new Set(commanders.flatMap((c) => c.colorIdentity))].filter((c): c is ColorLetter =>
    (COLOR_LETTERS as readonly string[]).includes(c),
  )

  const consideringBlock = blocks.find((b) => b.id === CONSIDERING_BLOCK_ID)
  const normalBlocks = blocks.filter((b) => b.id !== CONSIDERING_BLOCK_ID)
  // Render-only ordering: a block named "Lands" always leads (every deck
  // has one and it's the block people check most often), then every other
  // still-empty block (in their existing relative order), then every
  // populated one — so a block settles into the "populated" group as soon
  // as it gets its first card instead of sitting wherever it happened to be
  // among a mix of empty and full blocks. Doesn't touch `block.order`/manual
  // reordering, just where each one lands in the grid.
  const isLands = (b: (typeof normalBlocks)[number]) => b.name.toUpperCase() === 'LANDS'
  const orderedNormalBlocks = [
    ...normalBlocks.filter((b) => isLands(b)),
    ...normalBlocks.filter((b) => !isLands(b) && b.cardOracleIds.length === 0),
    ...normalBlocks.filter((b) => !isLands(b) && b.cardOracleIds.length > 0),
  ]

  // Cards parked in Considering aren't part of the deck, so they're kept
  // out of the exclusion set every normal block's search uses — a card
  // you're only considering should still turn up when you search for it
  // elsewhere. `addCard` promotes it out of Considering if that happens.
  const deckBodyOracleIds = normalBlocks.flatMap((b) => b.cardOracleIds)
  const deckOracleIds = [...commanders.map((c) => c.oracleId), ...deckBodyOracleIds]
  const uniqueDeckOracleIds = [...new Set(deckOracleIds)]
  const uniqueAllOracleIds = [...new Set([...deckOracleIds, ...(consideringBlock?.cardOracleIds ?? [])])]

  const cards = trpc.card.byOracleIds.useQuery(
    { oracleIds: uniqueAllOracleIds, sort: blockSort, direction: blockSortDirection },
    // Every card add/move/remove changes `oracleIds`, which React Query
    // treats as a brand-new query key — without this, `cards.data` goes
    // briefly undefined on every such change, and every row's name falls
    // back to its raw oracle_id for a frame. Keeping the previous result
    // visible while the new one loads removes that flicker.
    { enabled: uniqueAllOracleIds.length > 0, placeholderData: keepPreviousData },
  )
  const cardsById = new Map<string, CardResult>((cards.data ?? []).map((c) => [c.oracleId, c]))
  // The server already returns cards.data in the chosen sort order — record
  // each oracle_id's position in it so every block can render in that same
  // order without re-sorting (or re-deriving the comparator) itself.
  const sortIndex = new Map<string, number>((cards.data ?? []).map((c, i) => [c.oracleId, i]))

  const deckCardCount = normalBlocks.reduce((sum, b) => sum + b.cardOracleIds.length, 0) + commanders.length
  const typeCounts = countByType(deckOracleIds, cardsById)
  // Commander(s) + normal blocks only — same scope as deckCardCount.
  // Considering deliberately isn't part of the deck, so its cards aren't
  // priced in here either. Sums whatever priceUsd each card resolved to
  // (the cheapest-across-printings figure the ingestion job computes), not
  // a tracked/historical price — just a live estimate from what's shown.
  const deckTotalPrice = deckOracleIds.reduce((sum, oracleId) => {
    const price = cardsById.get(oracleId)?.priceUsd
    return price ? sum + Number(price) : sum
  }, 0)

  return (
    <div className="px-6 py-8">
      <div className="flex items-center justify-between">
        <DeckNameEditor key={id} deckId={id} initialName={name} />
        <div className="flex items-center gap-4">
          <span className="text-sm text-forge-text-muted" title="Estimated total — cheapest printing found per card">
            ~<span className="font-display text-forge-ember">${deckTotalPrice.toFixed(2)}</span>
          </span>
          <button
            type="button"
            onClick={() => setShowImport(true)}
            className="border border-forge-border px-3 py-1.5 text-xs uppercase tracking-wide text-forge-text-muted hover:border-forge-ember hover:text-forge-ember"
          >
            Import
          </button>
          <button
            type="button"
            onClick={() => setShowExport(true)}
            className="border border-forge-border px-3 py-1.5 text-xs uppercase tracking-wide text-forge-text-muted hover:border-forge-ember hover:text-forge-ember"
          >
            Export
          </button>
          <button
            type="button"
            onClick={handleClearDeck}
            title="Remove every block and card — keeps the commander and Considering"
            className="border border-forge-border px-3 py-1.5 text-xs uppercase tracking-wide text-forge-text-muted hover:border-red-400 hover:text-red-400"
          >
            Clear deck
          </button>
          <Link to="/decks" className="text-sm text-forge-text-muted hover:text-forge-ember">
            Back to decks
          </Link>
        </div>
      </div>

      <div className="mt-6">
        <CommanderHeader commanders={commanders} />
      </div>

      <div className="mt-6">
        <HandProbabilityRow deckOracleIds={deckBodyOracleIds} cardsById={cardsById} />
      </div>

      <div className="mt-6">
        <ManaBasePanel
          deckOracleIds={deckOracleIds}
          cardsById={cardsById}
          commanderColorIdentity={commanderColorIdentity}
        />
      </div>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        {/* Stays visible as you add cards, not just on an empty deck — single
            commander only, see CommanderRecommendations/slug.ts for why
            partner pairs aren't attempted. */}
        {commanders.length === 1 && (
          <div className="mt-6">
            <CommanderRecommendations
              commanderName={commanders[0].name}
              presentOracleIds={new Set(uniqueAllOracleIds)}
            />
          </div>
        )}

        {consideringBlock && (
          <div className="mt-6">
            <DeckBlock
              block={consideringBlock}
              cardsById={cardsById}
              commanderColorIdentity={commanderColorIdentity}
              excludeOracleIds={uniqueAllOracleIds}
              variant="considering"
              onRename={() => {}}
              onRemove={() => {}}
              onAddCard={(card) => addCard(CONSIDERING_BLOCK_ID, card.oracleId)}
              onRemoveCard={(oracleId) => removeCard(CONSIDERING_BLOCK_ID, oracleId)}
              sortIndex={sortIndex}
              ownedOracleIds={ownedOracleIds}
              onToggleOwned={handleToggleOwned}
              collapsed={collapsedIds.has(CONSIDERING_BLOCK_ID)}
              onToggleCollapsed={() => toggleCollapsed(CONSIDERING_BLOCK_ID)}
              allBlocks={blocks}
              onAddAlso={addShadowCard}
              onRemoveShadowCard={(oracleId) => removeShadowCard(CONSIDERING_BLOCK_ID, oracleId)}
              consideringOracleIds={consideringBlock.cardOracleIds}
              onReplaceCard={() => {}}
            />
          </div>
        )}

        <div className="mt-8 flex items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            {/* Boxed, unlike the plain dot-separated type breakdown next to
                it — the total is the headline number, not one more entry
                in that list. */}
            <span className="flex items-center gap-1 border border-forge-border px-2 py-1 text-sm text-forge-text">
              <span className="font-display text-forge-ember">{deckCardCount}</span>
              <span className="text-forge-text-muted">/ 100</span>
            </span>
            <span className="text-forge-border">·</span>
            {TYPE_COUNT_CATEGORIES.map(({ type, label }, i) => (
              <span key={type} className="flex items-center gap-3">
                {i > 0 && <span className="text-forge-border">·</span>}
                <span className="text-sm text-forge-text">
                  <span className="font-semibold text-forge-ember">{typeCounts.get(type) ?? 0}</span> {label}
                </span>
              </span>
            ))}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setShowFreeSearch(true)}
              title="Browse cards without picking a block first — selections land in Considering"
              className="border border-forge-border px-2.5 py-1.5 text-xs uppercase tracking-wide text-forge-text-muted hover:border-forge-ember hover:text-forge-ember"
            >
              Search Cards
            </button>
            <button
              type="button"
              onClick={() => setShowTagSearch(true)}
              className="border border-forge-border px-2.5 py-1.5 text-xs uppercase tracking-wide text-forge-text-muted hover:border-forge-ember hover:text-forge-ember"
            >
              Search Tags
            </button>
            <button
              type="button"
              onClick={toggleCollapseAll}
              className="border border-forge-border px-2.5 py-1.5 text-xs uppercase tracking-wide text-forge-text-muted hover:border-forge-ember hover:text-forge-ember"
            >
              {normalBlocks.length > 0 && normalBlocks.every((b) => collapsedIds.has(b.id)) ? 'Expand all' : 'Collapse all'}
            </button>
            <span className="ml-2 text-xs uppercase tracking-wide text-forge-text-muted">Sort blocks by</span>
            <select
              value={blockSort}
              onChange={(e) => setBlockSort(e.target.value as BlockSortField)}
              className="border border-forge-border bg-forge-bg px-2 py-1.5 text-xs text-forge-text outline-none focus:border-forge-ember"
            >
              {BLOCK_SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setBlockSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))}
              title={blockSortDirection === 'asc' ? 'Ascending' : 'Descending'}
              className="shrink-0 border border-forge-border px-2.5 py-1.5 text-xs text-forge-text-muted hover:border-forge-ember hover:text-forge-ember"
            >
              {blockSortDirection === 'asc' ? '↑ Asc' : '↓ Desc'}
            </button>
          </div>
        </div>

        {/*
          A real grid, not CSS multi-column masonry — masonry used to be
          necessary because an unbounded "one huge block" would otherwise
          push every short block after it (in the same row) down to match
          its height. Now every populated block shares one fixed height
          (DeckBlock scrolls its own card list internally), so that problem
          no longer applies — and masonry had its own downside: reflowing
          every block's position each time any block's height changed
          (e.g. on every single card add), which made the whole grid feel
          unstable. `items-start` keeps a still-empty block at its own
          natural (small) height instead of stretching it to match its row.
        */}
        <div className="mt-8 grid grid-cols-1 items-start gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          <AddBlockTile existingNames={blocks.map((b) => b.name)} onCreate={addBlock} />
          {orderedNormalBlocks.map((block) => (
            <DeckBlock
              key={block.id}
              block={block}
              cardsById={cardsById}
              commanderColorIdentity={commanderColorIdentity}
              excludeOracleIds={uniqueDeckOracleIds}
              onRename={(newName) => renameBlock(block.id, newName)}
              onRemove={() => removeBlock(block.id)}
              onAddCard={(card) => addCard(block.id, card.oracleId)}
              onRemoveCard={(oracleId) => removeCard(block.id, oracleId)}
              sortIndex={sortIndex}
              ownedOracleIds={ownedOracleIds}
              onToggleOwned={handleToggleOwned}
              collapsed={collapsedIds.has(block.id)}
              onToggleCollapsed={() => toggleCollapsed(block.id)}
              allBlocks={blocks}
              onAddAlso={addShadowCard}
              onRemoveShadowCard={(oracleId) => removeShadowCard(block.id, oracleId)}
              autoFocusName={block.id === autoFocusBlockId}
              onAutoFocused={() => setAutoFocusBlockId(null)}
              consideringOracleIds={consideringBlock?.cardOracleIds ?? []}
              onReplaceCard={(oldOracleId, newOracleId) => replaceCard(block.id, oldOracleId, newOracleId)}
            />
          ))}
        </div>

        {activeDrag && <DragBlockDropPanel blocks={blocks} sourceBlockId={activeDrag.sourceBlockId} />}

        <DragOverlay dropAnimation={{ duration: 200, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
          {activeDrag && (
            <div className="flex items-center gap-2 border border-forge-ember bg-forge-surface px-4 py-2 text-sm shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
              <ManaCost cost={activeDrag.card?.manaCost ?? null} size={14} />
              <span className="text-forge-text">{activeDrag.card?.name ?? activeDrag.oracleId}</span>
            </div>
          )}
          {draggingBlockName && (
            <div className="flex items-center gap-2 border border-forge-ember bg-forge-surface px-4 py-2.5 shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
              <GripIcon className="h-4 w-4 text-forge-ember" />
              <span className="font-display text-sm uppercase tracking-wide text-forge-text">{draggingBlockName}</span>
            </div>
          )}
        </DragOverlay>

        {showFreeSearch && (
          // No block to place into yet — a click still parks the card in
          // Considering (the deck's own "not sure where this goes" pile),
          // but its results are draggable like any deck card row, so it can
          // also go straight to a block or "Create new" via the side panel
          // above. Rendered inside DndContext (unlike the other modals
          // below) specifically so that drag works.
          <CardSearchBox
            commanderColorIdentity={commanderColorIdentity}
            excludeOracleIds={uniqueDeckOracleIds}
            blockName={CONSIDERING_BLOCK_NAME}
            onSelect={(card) => addCard(CONSIDERING_BLOCK_ID, card.oracleId)}
            onClose={() => setShowFreeSearch(false)}
          />
        )}
      </DndContext>

      {showTagSearch && <TagSearchModal onClose={() => setShowTagSearch(false)} />}
      {showExport && (
        <ExportDeckModal
          onClose={() => setShowExport(false)}
          deckName={name}
          blocks={blocks}
          cardsById={cardsById}
          commanders={commanders}
          hasConsidering={Boolean(consideringBlock && consideringBlock.cardOracleIds.length > 0)}
        />
      )}
      {showImport && (
        <ImportDeckModal
          onClose={() => setShowImport(false)}
          commanderOracleIds={commanders.map((c) => c.oracleId)}
          onImport={importBlocks}
        />
      )}
    </div>
  )
}

export default function DeckBuildPage() {
  const { deckId } = useParams<{ deckId: string }>()
  const deck = trpc.deck.get.useQuery({ id: deckId! }, { enabled: Boolean(deckId) })

  if (deck.isLoading) {
    return <p className="px-6 py-4 text-sm text-forge-text-muted">Loading...</p>
  }
  if (deck.error || !deck.data) {
    return (
      <div className="px-6 py-4 text-sm">
        <p className="text-red-400">Deck not found.</p>
        <Link to="/decks" className="text-forge-text-muted underline">
          Back to your decks
        </Link>
      </div>
    )
  }

  return <DeckBuilder deck={deck.data} />
}
