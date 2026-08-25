import { useEffect, useRef, useState } from 'react'
import { trpc } from '../../lib/trpc'
import { useDebouncedValue } from '../../lib/use-debounced-value'

interface DeckNameEditorProps {
  deckId: string
  initialName: string
}

export default function DeckNameEditor({ deckId, initialName }: DeckNameEditorProps) {
  const [name, setName] = useState(initialName)
  const debouncedName = useDebouncedValue(name, 1000)
  const lastSaved = useRef(initialName)
  const utils = trpc.useUtils()

  const updateDeck = trpc.deck.update.useMutation({
    onSuccess: () => {
      utils.deck.list.invalidate()
      utils.deck.get.invalidate({ id: deckId })
    },
  })

  useEffect(() => {
    const trimmed = debouncedName.trim()
    if (!trimmed || trimmed === lastSaved.current) return
    lastSaved.current = trimmed
    updateDeck.mutate({ id: deckId, name: trimmed })
    // updateDeck is intentionally left out — it's a fresh object every
    // render, and only debouncedName/deckId should trigger a save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedName, deckId])

  return (
    <input
      value={name}
      onChange={(e) => setName(e.target.value)}
      aria-label="Deck name"
      className="-mx-1 bg-transparent px-1 font-display text-xl uppercase tracking-wide text-forge-text outline-none hover:bg-forge-surface focus:bg-forge-surface"
    />
  )
}
