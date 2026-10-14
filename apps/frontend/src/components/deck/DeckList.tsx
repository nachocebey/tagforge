import { useState, type MouseEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { trpc } from '../../lib/trpc'
import NewDeckDialog from './NewDeckDialog'
import { TrashIcon } from './icons'

export default function DeckList() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [showNewDeck, setShowNewDeck] = useState(searchParams.get('new') === '1')
  const [query, setQuery] = useState('')
  const initialCommanderId = searchParams.get('commander') ?? undefined
  const decks = trpc.deck.list.useQuery()
  const utils = trpc.useUtils()
  const removeDeck = trpc.deck.remove.useMutation({ onSuccess: () => utils.deck.list.invalidate() })

  const allCommanderIds = (decks.data ?? []).flatMap((d) => d.commanderOracleIds)
  const commanders = trpc.card.byOracleIds.useQuery(
    { oracleIds: allCommanderIds },
    { enabled: allCommanderIds.length > 0 },
  )
  const cardById = new Map((commanders.data ?? []).map((c) => [c.oracleId, c]))

  // Matches on the deck's own name or either commander's name (partner
  // decks have two) — useful once someone has enough decks to need it.
  const normalizedQuery = query.trim().toLowerCase()
  const visibleDecks = (decks.data ?? []).filter((deck) => {
    if (!normalizedQuery) return true
    const commanderNames = deck.commanderOracleIds.map((id) => cardById.get(id)?.name ?? '')
    return [deck.name, ...commanderNames].some((s) => s.toLowerCase().includes(normalizedQuery))
  })

  function closeDialog() {
    setShowNewDeck(false)
    if (searchParams.has('new') || searchParams.has('commander')) setSearchParams({})
  }

  function handleDelete(e: MouseEvent, deckId: string, deckName: string) {
    e.preventDefault()
    e.stopPropagation()
    if (window.confirm(`Delete "${deckName}"? This can't be undone.`)) {
      removeDeck.mutate({ id: deckId })
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-2xl uppercase tracking-wide text-forge-text">Your decks</h1>
        <button
          type="button"
          onClick={() => (showNewDeck ? closeDialog() : setShowNewDeck(true))}
          className="shrink-0 border border-forge-ember bg-forge-ember px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-forge-bg transition-colors hover:bg-forge-ember-dark hover:border-forge-ember-dark"
        >
          {showNewDeck ? 'Close' : 'New deck'}
        </button>
      </div>

      {showNewDeck && <NewDeckDialog onClose={closeDialog} initialCommanderId={initialCommanderId} />}

      {decks.data && decks.data.length > 0 && (
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by deck name or commander..."
          className="mt-6 w-full max-w-sm border border-forge-border bg-forge-bg px-3 py-2 text-sm text-forge-text outline-none focus:border-forge-ember"
        />
      )}

      {decks.isLoading && <p className="mt-6 text-sm text-forge-text-muted">Loading...</p>}
      {decks.data?.length === 0 && <p className="mt-6 text-sm text-forge-text-muted">No decks yet — create one above.</p>}
      {decks.data && decks.data.length > 0 && visibleDecks.length === 0 && (
        <p className="mt-6 text-sm text-forge-text-muted">No decks match "{query}".</p>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visibleDecks.map((deck, i) => {
          const commanderCard = cardById.get(deck.commanderOracleIds[0])
          const art = commanderCard?.imageUris?.art_crop
          return (
            <Link
              key={deck.id}
              to={`/decks/${deck.id}`}
              style={{ animationDelay: `${i * 40}ms` }}
              className="animate-rise-in group relative h-40 w-full overflow-hidden border border-forge-border bg-forge-surface"
            >
              {art && (
                <img
                  src={art}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover opacity-30 transition-opacity duration-300 group-hover:opacity-50"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-forge-bg via-forge-bg/60 to-forge-bg/20" />

              <button
                type="button"
                onClick={(e) => handleDelete(e, deck.id, deck.name)}
                aria-label={`Delete ${deck.name}`}
                title="Delete deck"
                className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-forge-border bg-forge-bg/80 text-forge-text-muted opacity-0 transition-opacity hover:border-red-400 hover:text-red-400 group-hover:opacity-100"
              >
                <TrashIcon className="h-3.5 w-3.5" />
              </button>

              <div className="absolute inset-x-0 bottom-0 p-4">
                <p className="truncate font-display text-lg uppercase leading-tight text-forge-text">{deck.name}</p>
                <p className="mt-1 truncate text-xs uppercase tracking-wide text-forge-text-muted">
                  {commanderCard?.name ?? 'Loading...'}
                </p>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
