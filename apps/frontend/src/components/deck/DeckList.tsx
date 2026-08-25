import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { trpc } from '../../lib/trpc'
import NewDeckDialog from './NewDeckDialog'

export default function DeckList() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [showNewDeck, setShowNewDeck] = useState(searchParams.get('new') === '1')
  const initialCommanderId = searchParams.get('commander') ?? undefined
  const decks = trpc.deck.list.useQuery()

  function closeDialog() {
    setShowNewDeck(false)
    if (searchParams.has('new') || searchParams.has('commander')) setSearchParams({})
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl uppercase tracking-wide text-forge-text">Your decks</h1>
        <button
          type="button"
          onClick={() => (showNewDeck ? closeDialog() : setShowNewDeck(true))}
          className="border border-forge-ember bg-forge-ember px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-forge-bg transition-colors hover:bg-forge-ember-dark hover:border-forge-ember-dark"
        >
          {showNewDeck ? 'Close' : 'New deck'}
        </button>
      </div>

      {showNewDeck && <NewDeckDialog onClose={closeDialog} initialCommanderId={initialCommanderId} />}

      <ul className="mt-6 divide-y divide-forge-border border border-forge-border">
        {decks.isLoading && <li className="px-4 py-3 text-sm text-forge-text-muted">Loading...</li>}
        {decks.data?.length === 0 && (
          <li className="px-4 py-3 text-sm text-forge-text-muted">No decks yet — create one above.</li>
        )}
        {decks.data?.map((deck) => (
          <li key={deck.id}>
            <Link
              to={`/decks/${deck.id}`}
              className="block px-4 py-3 text-sm text-forge-text hover:bg-forge-surface-hover"
            >
              {deck.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
