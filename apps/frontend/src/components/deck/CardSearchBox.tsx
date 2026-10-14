import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type UIEvent } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { trpc } from '../../lib/trpc'
import { useDebouncedValue } from '../../lib/use-debounced-value'
import type { CardResult } from '../../lib/trpc-types'
import { COLOR_DOT, type ColorLetter } from '../../lib/colors'
import ManaCost from './ManaCost'
import { CloseIcon, FlipIcon } from './icons'

// Shares DeckBuildPage's DndContext (this box always renders somewhere
// inside it) — prefixed so a drop can tell "add this search result to
// block X" apart from moving an existing deck card, the same way an EDHREC
// recommendation drag is told apart. A result row has no block to move
// *from*, real or Considering, until it's dropped somewhere.
export const SEARCH_RESULT_DRAG_PREFIX = 'searchresult::'

function SearchResultRow({
  card,
  isPreview,
  onHover,
  onSelect,
}: {
  card: CardResult
  isPreview: boolean
  onHover: () => void
  onSelect: () => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${SEARCH_RESULT_DRAG_PREFIX}${card.oracleId}`,
    data: { oracleId: card.oracleId, card },
  })

  return (
    <li>
      <button
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        type="button"
        onMouseEnter={onHover}
        onClick={onSelect}
        title="Click to add, or drag onto any block"
        className={`flex w-full cursor-grab items-center justify-between gap-3 px-4 py-2.5 text-left text-sm transition-colors active:cursor-grabbing ${
          isPreview ? 'bg-forge-surface-hover' : ''
        } ${isDragging ? 'opacity-40' : ''} text-forge-text hover:bg-forge-surface-hover`}
      >
        <span className="min-w-0 flex-1 truncate">{card.name}</span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="text-xs text-forge-text-muted">{card.priceUsd ? `$${card.priceUsd}` : '—'}</span>
          <ManaCost cost={card.manaCost} />
        </span>
      </button>
    </li>
  )
}

interface CardSearchBoxProps {
  commanderColorIdentity: ColorLetter[]
  excludeOracleIds: string[]
  // Shown in the preview pane before any search happens (or once results
  // clear) — used to open this panel already pointed at a specific card,
  // e.g. clicking a deck row's "view details" eye icon.
  previewOnlyCard?: CardResult
  // The block a selected card will be added to — shown next to the "Add a
  // card" heading so it's clear which block you're adding into.
  blockName?: string
  onSelect: (card: CardResult) => void
  onClose: () => void
}

type SortField = 'name' | 'cmc' | 'color' | 'price' | 'released'
type SortDirection = 'asc' | 'desc'

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: 'cmc', label: 'Mana cost' },
  { value: 'color', label: 'Color' },
  { value: 'released', label: 'Release date' },
  { value: 'price', label: 'Price' },
]

const TYPE_OPTIONS = ['Creature', 'Instant', 'Sorcery', 'Artifact', 'Enchantment', 'Planeswalker', 'Battle', 'Land']
// Page size for infinite scroll — more pages load automatically as the
// user scrolls the results list, rather than hard-capping the total.
const PAGE_SIZE = 40
// Within this many px of the bottom, fetch the next page.
const LOAD_MORE_THRESHOLD_PX = 200

type LegendaryFilter = 'any' | 'legendary' | 'non-legendary'
const LEGENDARY_OPTIONS: { value: LegendaryFilter; label: string }[] = [
  { value: 'any', label: 'Legendary: any' },
  { value: 'legendary', label: 'Legendary only' },
  { value: 'non-legendary', label: 'Non-legendary only' },
]

// No single sortable scalar backs "color" (it's a WUBRG array) — the panel
// re-sorts its own (capped) result page client-side instead of asking the
// server to order by it.
const WUBRG: ColorLetter[] = ['W', 'U', 'B', 'R', 'G']
function colorRank(card: CardResult): number {
  if (card.colors.length === 0) return 0
  if (card.colors.length > 1) return 6
  return WUBRG.indexOf(card.colors[0] as ColorLetter) + 1
}
function sortByColor(cards: CardResult[], direction: SortDirection): CardResult[] {
  const sorted = [...cards].sort((a, b) => colorRank(a) - colorRank(b) || a.name.localeCompare(b.name))
  return direction === 'desc' ? sorted.reverse() : sorted
}

function CardPreview({ card, onTagClick }: { card: CardResult; onTagClick: (slug: string) => void }) {
  const [faceIndex, setFaceIndex] = useState(0)
  // Only transform/modal_dfc/flip layouts carry a real second face image —
  // split/adventure cards' faces exist but share one combined card-level
  // image, so they're excluded via the "every face has its own image" check.
  const faces = card.cardFaces
  const isFlippable = Boolean(faces && faces.length >= 2 && faces.every((f) => f.image_uris))
  const activeFace = isFlippable ? faces![faceIndex % faces!.length] : null
  const image = activeFace
    ? (activeFace.image_uris!.large ?? activeFace.image_uris!.normal)
    : (card.imageUris?.large ?? card.imageUris?.normal)

  const tags = trpc.card.tags.useQuery({ oracleId: card.oracleId })
  const legalFormats = Object.entries(card.legalities)
    .filter(([, status]) => status === 'legal')
    .map(([format]) => format)

  return (
    <div className="flex flex-col gap-4">
      {image ? (
        <div className="relative">
          <img src={image} alt={activeFace?.name ?? card.name} className="w-full rounded-lg border border-forge-border" />
          {isFlippable && (
            <button
              type="button"
              onClick={() => setFaceIndex((i) => i + 1)}
              title="Flip to the other face"
              aria-label="Flip to the other face"
              className="absolute bottom-2 right-2 flex items-center gap-1.5 rounded-full border border-forge-border bg-forge-bg/90 px-3 py-1.5 text-xs text-forge-text shadow-[0_4px_16px_rgba(0,0,0,0.6)] hover:border-forge-ember hover:text-forge-ember"
            >
              <FlipIcon className="h-3.5 w-3.5" />
              Flip
            </button>
          )}
        </div>
      ) : (
        <div className="flex aspect-[5/7] w-full items-center justify-center border border-forge-border bg-forge-bg text-xs text-forge-text-muted">
          No image
        </div>
      )}

      <div>
        <p className="text-xs uppercase tracking-wide text-forge-text-muted">Legal in</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {legalFormats.length === 0 && <span className="text-xs text-forge-text-muted">Nowhere</span>}
          {legalFormats.map((format) => (
            <span
              key={format}
              className="border border-forge-border px-2 py-0.5 text-[11px] uppercase tracking-wide text-forge-text-muted"
            >
              {format}
            </span>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs uppercase tracking-wide text-forge-text-muted">Tagger tags</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {tags.isLoading && <span className="text-xs text-forge-text-muted">Loading...</span>}
          {tags.data?.length === 0 && <span className="text-xs text-forge-text-muted">None</span>}
          {tags.data?.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => onTagClick(tag.slug)}
              title={tag.description ?? `Search cards tagged ${tag.label}`}
              className="border border-forge-ember/40 px-2 py-0.5 text-[11px] text-forge-ember transition-colors hover:border-forge-ember hover:bg-forge-ember/10"
            >
              {tag.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function CardSearchBox({
  commanderColorIdentity,
  excludeOracleIds,
  previewOnlyCard,
  blockName,
  onSelect,
  onClose,
}: CardSearchBoxProps) {
  const [text, setText] = useState('')
  const [tagChips, setTagChips] = useState<string[]>([])
  const [tagDraft, setTagDraft] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [legendaryFilter, setLegendaryFilter] = useState<LegendaryFilter>('any')
  const [colorFilter, setColorFilter] = useState<ColorLetter[]>([])
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const debouncedText = useDebouncedValue(text, 250)
  const debouncedTagDraft = useDebouncedValue(tagDraft, 600)
  const resultsListRef = useRef<HTMLUListElement>(null)

  // Document-level, not a per-input onKeyDown, so Escape closes the panel
  // no matter which control inside it currently has focus.
  useEffect(() => {
    function handleKeyDown(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Tab from the name input normally lands on the tag/type/color/sort
  // controls first — jump straight to the first result instead, so typing
  // a name and hitting Tab gets you into the list to arrow/Enter through
  // it. Only forward Tab (not Shift+Tab) and only when there's something
  // to jump to; otherwise Tab behaves normally.
  function handleNameKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Tab' || e.shiftKey) return
    const firstResult = resultsListRef.current?.querySelector('button')
    if (firstResult instanceof HTMLElement) {
      e.preventDefault()
      firstResult.focus()
    }
  }

  function addTagChip(tag: string) {
    // Defensive strip: a pasted/typed "tag:removal" still works as just "removal".
    const slug = tag.trim().toLowerCase().replace(/^tag:/, '')
    if (!slug) return
    setTagChips((prev) => (prev.includes(slug) ? prev : [...prev, slug]))
    setTagDraft('')
  }

  function removeTagChip(tag: string) {
    setTagChips((prev) => prev.filter((t) => t !== tag))
  }

  // Auto-commits the tag draft into a chip once the user pauses typing —
  // Enter still works for an immediate commit, this just removes the need
  // for it. addTagChip already clears the draft, so the effect goes quiet
  // again once debouncedTagDraft catches up to the now-empty value.
  useEffect(() => {
    if (debouncedTagDraft.trim()) addTagChip(debouncedTagDraft)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedTagDraft])

  // Type/color filters and tag chips are just additional clauses appended
  // to the same Scryfall-like query string the box already sends — no
  // separate backend filter path needed. Color uses "at most these" (c<=)
  // rather than "at least" so picking a sub-palette of the commander's
  // identity narrows results instead of requiring every checked color on
  // every card.
  const composedQuery = [
    debouncedText,
    typeFilter && `t:${typeFilter}`,
    legendaryFilter === 'legendary' && 't:legendary',
    legendaryFilter === 'non-legendary' && '-t:legendary',
    colorFilter.length > 0 && `c<=${colorFilter.join('')}`,
    ...tagChips.map((t) => `tag:${t}`),
  ]
    .filter(Boolean)
    .join(' ')

  const search = trpc.card.search.useInfiniteQuery(
    {
      query: composedQuery,
      commanderColorIdentity,
      excludeOracleIds,
      limit: PAGE_SIZE,
      sort: sortField === 'color' ? 'name' : sortField,
      sortDirection,
    },
    {
      enabled: composedQuery.trim().length > 0,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    },
  )

  const flatResults = useMemo(() => search.data?.pages.flatMap((page) => page.items), [search.data])

  const results = useMemo(() => {
    if (!flatResults) return flatResults
    return sortField === 'color' ? sortByColor(flatResults, sortDirection) : flatResults
  }, [flatResults, sortField, sortDirection])

  const previewCard = results?.find((c) => c.oracleId === hoveredId) ?? results?.[0] ?? previewOnlyCard ?? null

  function toggleColor(letter: ColorLetter) {
    setColorFilter((prev) => (prev.includes(letter) ? prev.filter((c) => c !== letter) : [...prev, letter]))
  }

  function handleResultsScroll(e: UIEvent<HTMLDivElement>) {
    const el = e.currentTarget
    const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - LOAD_MORE_THRESHOLD_PX
    if (nearBottom && search.hasNextPage && !search.isFetchingNextPage) {
      search.fetchNextPage()
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-4xl border-l border-forge-border bg-forge-surface shadow-[0_0_60px_rgba(0,0,0,0.6)]">
        <div className="no-scrollbar hidden flex-1 overflow-y-auto p-5 sm:block">
          {previewCard ? (
            <CardPreview key={previewCard.oracleId} card={previewCard} onTagClick={addTagChip} />
          ) : (
            <p className="text-sm text-forge-text-muted">Hover a result to preview it here.</p>
          )}
        </div>

        <div className="flex w-full max-w-sm flex-col border-l border-forge-border">
          <div className="border-b border-forge-border p-4">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-2 font-display text-lg uppercase tracking-wide text-forge-text">
                Add a card
                {blockName && (
                  <span className="rounded-full border border-forge-ember/50 bg-forge-ember/10 px-2 py-0.5 text-xs font-normal normal-case tracking-normal text-forge-ember">
                    {blockName}
                  </span>
                )}
              </p>
              <button type="button" onClick={onClose} aria-label="Close" className="text-forge-text-muted hover:text-forge-ember">
                <CloseIcon />
              </button>
            </div>
            <input
              type="text"
              autoFocus
              placeholder="Card name..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleNameKeyDown}
              className="mt-3 w-full border border-forge-border bg-forge-bg px-3 py-2 text-sm text-forge-text outline-none focus:border-forge-ember"
            />

            <div className="mt-2 flex items-center justify-between">
              <label className="text-[11px] uppercase tracking-wide text-forge-text-muted">Tags</label>
              <a
                href="https://tagger.scryfall.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-forge-text-muted underline decoration-dotted hover:text-forge-ember"
              >
                Browse tags on Scryfall Tagger ↗
              </a>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 border border-forge-border bg-forge-bg p-1.5 focus-within:border-forge-ember">
              {tagChips.map((tag) => (
                <span
                  key={tag}
                  className="flex items-center gap-1 rounded border border-forge-ember/50 bg-forge-ember/15 py-0.5 pl-2 pr-1 text-xs font-medium text-forge-text"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTagChip(tag)}
                    aria-label={`Remove tag ${tag}`}
                    className="text-forge-text-muted hover:text-forge-ember"
                  >
                    <CloseIcon className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <input
                type="text"
                placeholder={tagChips.length === 0 ? 'ramp, removal, wheel...' : 'Add another...'}
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addTagChip(tagDraft)
                  } else if (e.key === 'Backspace' && !tagDraft && tagChips.length > 0) {
                    // Backspacing on an empty draft pops the last chip — a
                    // common "delete the thing I just typed" affordance.
                    removeTagChip(tagChips[tagChips.length - 1])
                  }
                }}
                className="min-w-[6rem] flex-1 bg-transparent py-0.5 text-sm text-forge-text outline-none"
              />
            </div>
            <p className="mt-1 text-[11px] leading-snug text-forge-text-muted">
              Type a tag (no <span className="text-forge-text">tag:</span> needed) and press Enter.
            </p>

            <div className="mt-3 flex items-center gap-2">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="flex-1 border border-forge-border bg-forge-bg px-2 py-1.5 text-xs text-forge-text outline-none focus:border-forge-ember"
              >
                <option value="">Any type</option>
                {TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <select
                value={legendaryFilter}
                onChange={(e) => setLegendaryFilter(e.target.value as LegendaryFilter)}
                className="flex-1 border border-forge-border bg-forge-bg px-2 py-1.5 text-xs text-forge-text outline-none focus:border-forge-ember"
              >
                {LEGENDARY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {commanderColorIdentity.length > 0 && (
                <div className="flex shrink-0 items-center gap-1">
                  {commanderColorIdentity.map((letter) => (
                    <button
                      key={letter}
                      type="button"
                      onClick={() => toggleColor(letter)}
                      title={letter}
                      className={`h-6 w-6 rounded-full border-2 transition-opacity ${COLOR_DOT[letter]} ${
                        colorFilter.includes(letter) ? 'border-forge-ember' : 'border-transparent opacity-40'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="mt-2 flex items-center gap-2">
              <select
                value={sortField}
                onChange={(e) => setSortField(e.target.value as SortField)}
                className="flex-1 border border-forge-border bg-forge-bg px-2 py-1.5 text-xs text-forge-text outline-none focus:border-forge-ember"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    Sort: {opt.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))}
                title={sortDirection === 'asc' ? 'Ascending' : 'Descending'}
                className="shrink-0 border border-forge-border px-2.5 py-1.5 text-xs text-forge-text-muted hover:border-forge-ember hover:text-forge-ember"
              >
                {sortDirection === 'asc' ? '↑ Asc' : '↓ Desc'}
              </button>
            </div>
          </div>

          <div className="no-scrollbar flex-1 overflow-y-auto" onScroll={handleResultsScroll}>
            {composedQuery.trim().length === 0 && (
              <p className="px-4 py-6 text-sm text-forge-text-muted">Start typing, or pick a type/color, to search.</p>
            )}
            {search.isLoading && <p className="px-4 py-6 text-sm text-forge-text-muted">Searching...</p>}
            {results?.length === 0 && <p className="px-4 py-6 text-sm text-forge-text-muted">No matches.</p>}
            <ul ref={resultsListRef} className="divide-y divide-forge-border">
              {results?.map((card) => (
                <SearchResultRow
                  key={card.oracleId}
                  card={card}
                  isPreview={previewCard?.oracleId === card.oracleId}
                  onHover={() => setHoveredId(card.oracleId)}
                  onSelect={() => onSelect(card)}
                />
              ))}
            </ul>
            {search.isFetchingNextPage && (
              <p className="px-4 py-3 text-center text-xs text-forge-text-muted">Loading more...</p>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
