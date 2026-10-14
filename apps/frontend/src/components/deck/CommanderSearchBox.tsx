import { useState } from 'react'
import { trpc } from '../../lib/trpc'
import { useDebouncedValue } from '../../lib/use-debounced-value'
import type { CardResult } from '../../lib/trpc-types'
import ManaCost from './ManaCost'

interface CommanderSearchBoxProps {
  placeholder: string
  // Prefixed onto whatever the user types, e.g. "is:commander " or "is:background ".
  querySyntaxPrefix: string
  onSelect: (card: CardResult) => void
  autoFocus?: boolean
}

export default function CommanderSearchBox({
  placeholder,
  querySyntaxPrefix,
  onSelect,
  autoFocus,
}: CommanderSearchBoxProps) {
  const [text, setText] = useState('')
  const debouncedText = useDebouncedValue(text, 250)

  const search = trpc.card.search.useQuery(
    { query: `${querySyntaxPrefix}${debouncedText}`, limit: 20 },
    { enabled: debouncedText.trim().length > 0 },
  )
  const results = search.data?.items

  return (
    <div className="space-y-2">
      <input
        type="text"
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="w-full border border-forge-border bg-forge-bg px-3 py-2 text-sm text-forge-text outline-none focus:border-forge-ember"
      />
      {debouncedText.trim().length > 0 && (
        <ul className="max-h-64 divide-y divide-forge-border overflow-y-auto border border-forge-border">
          {search.isLoading && <li className="px-3 py-2 text-sm text-forge-text-muted">Searching...</li>}
          {results?.length === 0 && <li className="px-3 py-2 text-sm text-forge-text-muted">No matches.</li>}
          {results?.map((card) => (
            <li key={card.oracleId}>
              <button
                type="button"
                onClick={() => onSelect(card)}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-forge-text hover:bg-forge-surface-hover"
              >
                <span>{card.name}</span>
                <ManaCost cost={card.manaCost} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
