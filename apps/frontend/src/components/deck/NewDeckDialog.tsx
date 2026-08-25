import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { trpc } from '../../lib/trpc'
import type { CardResult } from '../../lib/trpc-types'
import CommanderSearchBox from './CommanderSearchBox'

interface NewDeckDialogProps {
  onClose: () => void
  // Pre-selects the first commander (e.g. clicked from the trending strip)
  // instead of making the user search for it again.
  initialCommanderId?: string
}

// Backgrounds themselves aren't commander-eligible (canBeCommander is false
// for them, correctly — they only work as the second slot), so the second
// picker is scoped by what the *first* commander allows rather than
// re-running an is:commander search.
function secondSlotQuery(first: CardResult): { prefix: string; placeholder: string } | null {
  if (first.choosesBackground) return { prefix: 'is:background ', placeholder: 'Search Backgrounds...' }
  if (first.partnerWith) return { prefix: '', placeholder: `Search for ${first.partnerWith}...` }
  if (first.hasPartner) return { prefix: 'is:partner ', placeholder: 'Search partner commanders...' }
  return null
}

export default function NewDeckDialog({ onClose, initialCommanderId }: NewDeckDialogProps) {
  const [first, setFirst] = useState<CardResult | null>(null)
  const [second, setSecond] = useState<CardResult | null>(null)
  const [name, setName] = useState('')
  const [nameTouched, setNameTouched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const utils = trpc.useUtils()

  const preselected = trpc.card.byOracleIds.useQuery(
    { oracleIds: initialCommanderId ? [initialCommanderId] : [] },
    { enabled: Boolean(initialCommanderId) },
  )

  useEffect(() => {
    if (preselected.data?.[0] && !first) setFirst(preselected.data[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselected.data])

  // Suggest a name from the commander(s), but only while the user hasn't
  // typed their own — someone can have more than one deck with the same
  // commander, so the name needs to stay editable, not just auto-generated.
  useEffect(() => {
    if (!first || nameTouched) return
    setName(second ? `${first.name} & ${second.name}` : first.name)
  }, [first, second, nameTouched])

  const createDeck = trpc.deck.create.useMutation({
    onSuccess: (deck) => {
      utils.deck.list.invalidate()
      navigate(`/decks/${deck.id}`)
    },
    onError: (err) => setError(err.message),
  })

  const secondSlot = first ? secondSlotQuery(first) : null

  function handleCreate() {
    if (!first || !name.trim()) return
    setError(null)
    createDeck.mutate({
      name: name.trim(),
      commanderOracleIds: second ? [first.oracleId, second.oracleId] : [first.oracleId],
    })
  }

  return (
    <div className="mx-auto max-w-md space-y-4 border border-forge-border bg-forge-surface p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg uppercase tracking-wide text-forge-text">New deck</h2>
        <button type="button" onClick={onClose} className="text-sm text-forge-text-muted hover:text-forge-ember">
          Cancel
        </button>
      </div>

      {!first && (
        <CommanderSearchBox
          placeholder="Search for a commander..."
          querySyntaxPrefix="is:commander "
          onSelect={setFirst}
          autoFocus
        />
      )}

      {first && (
        <div className="space-y-3">
          <div className="border border-forge-border bg-forge-bg px-3 py-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium text-forge-text">{first.name}</span>
              <button
                type="button"
                onClick={() => {
                  setFirst(null)
                  setSecond(null)
                }}
                className="text-xs text-forge-text-muted hover:text-forge-ember"
              >
                change
              </button>
            </div>
          </div>

          {secondSlot && !second && (
            <CommanderSearchBox
              placeholder={secondSlot.placeholder}
              querySyntaxPrefix={secondSlot.prefix}
              onSelect={setSecond}
            />
          )}

          {second && (
            <div className="border border-forge-border bg-forge-bg px-3 py-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium text-forge-text">{second.name}</span>
                <button
                  type="button"
                  onClick={() => setSecond(null)}
                  className="text-xs text-forge-text-muted hover:text-forge-ember"
                >
                  remove
                </button>
              </div>
            </div>
          )}

          <div>
            <label htmlFor="deck-name" className="mb-1 block text-xs uppercase tracking-wide text-forge-text-muted">
              Deck name
            </label>
            <input
              id="deck-name"
              type="text"
              value={name}
              onChange={(e) => {
                setNameTouched(true)
                setName(e.target.value)
              }}
              className="w-full border border-forge-border bg-forge-bg px-3 py-2 text-sm text-forge-text outline-none focus:border-forge-ember"
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="button"
            onClick={handleCreate}
            disabled={createDeck.isPending || !name.trim()}
            className="w-full border border-forge-ember bg-forge-ember px-3 py-2.5 text-sm font-semibold uppercase tracking-wide text-forge-bg transition-colors hover:bg-forge-ember-dark hover:border-forge-ember-dark disabled:opacity-50"
          >
            {createDeck.isPending ? 'Creating...' : 'Create deck'}
          </button>
        </div>
      )}
    </div>
  )
}
