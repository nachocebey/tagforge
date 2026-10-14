import { useState } from 'react'
import { trpc } from '../../lib/trpc'
import { useDebouncedValue } from '../../lib/use-debounced-value'
import { CloseIcon } from './icons'

interface TagSearchModalProps {
  onClose: () => void
}

export default function TagSearchModal({ onClose }: TagSearchModalProps) {
  const [query, setQuery] = useState('')
  // Longer than the card-name search's 250ms — a tag name (e.g. "removal",
  // "burst-draw") is typed in one continuous burst with no natural pause
  // partway through, so a short debounce fires mid-word instead of once
  // the user's actually done typing.
  const debouncedQuery = useDebouncedValue(query, 450)
  const trimmed = debouncedQuery.trim()

  const results = trpc.card.searchTags.useQuery({ query: trimmed, limit: 30 }, { enabled: trimmed.length >= 2 })

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 border border-forge-border bg-forge-surface p-6 shadow-[0_0_60px_rgba(0,0,0,0.6)]">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg uppercase tracking-wide text-forge-text">Tag search</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-forge-text-muted hover:text-forge-ember">
            <CloseIcon />
          </button>
        </div>
        <p className="mt-1 text-xs text-forge-text-muted">
          Look up the Scryfall Tagger tags this app understands, e.g. for a{' '}
          <span className="text-forge-text">tag:</span> clause in card search.
        </p>

        <input
          type="text"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="wheel, ramp, removal..."
          className="mt-4 w-full border border-forge-border bg-forge-bg px-3 py-2 text-sm text-forge-text outline-none focus:border-forge-ember"
        />

        <div className="mt-4 max-h-96 overflow-y-auto">
          {trimmed.length < 2 && <p className="text-sm text-forge-text-muted">Type at least 2 characters to search.</p>}

          {trimmed.length >= 2 && results.data && results.data.length === 0 && (
            <p className="text-sm text-forge-text-muted">No tags found for "{trimmed}".</p>
          )}

          {results.data && results.data.length > 0 && (
            <ul className="divide-y divide-forge-border border border-forge-border bg-forge-bg">
              {results.data.map((tag) => (
                <li key={tag.id} className="px-3 py-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-medium text-forge-text">{tag.label}</span>
                    <span className="text-xs text-forge-text-muted">{tag.slug}</span>
                  </div>
                  {tag.description && <p className="mt-1 text-xs leading-snug text-forge-text-muted">{tag.description}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  )
}
