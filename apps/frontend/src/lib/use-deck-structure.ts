import { useCallback, useEffect, useRef, useState } from 'react'
import { trpc } from './trpc'
import { useDebouncedValue } from './use-debounced-value'
import { CONSIDERING_BLOCK_ID, CONSIDERING_BLOCK_NAME } from './considering'
import type { DeckBlock, DeckStructure } from './trpc-types'

function withConsideringBlock(blocks: DeckBlock[]): DeckBlock[] {
  if (blocks.some((b) => b.id === CONSIDERING_BLOCK_ID)) return blocks
  return [{ id: CONSIDERING_BLOCK_ID, name: CONSIDERING_BLOCK_NAME, order: -1, cardOracleIds: [] }, ...blocks]
}

// Local-first block editing with debounced autosave: every mutation updates
// state immediately (so the UI never waits on the network), and the whole
// structure is persisted ~1.2s after the last change — matching the
// brief's "autosave with debounce, not per-event" requirement.
export function useDeckStructure(deckId: string, initial: DeckStructure) {
  const [blocks, setBlocks] = useState<DeckBlock[]>(() => withConsideringBlock(initial.blocks))
  const debouncedBlocks = useDebouncedValue(blocks, 1200)
  const lastSaved = useRef(JSON.stringify(initial.blocks))
  const utils = trpc.useUtils()

  const updateDeck = trpc.deck.update.useMutation()

  useEffect(() => {
    const serialized = JSON.stringify(debouncedBlocks)
    if (serialized === lastSaved.current) return
    lastSaved.current = serialized
    updateDeck.mutate(
      { id: deckId, structure: { blocks: debouncedBlocks } },
      { onSuccess: () => utils.deck.list.invalidate() },
    )
    // updateDeck/utils intentionally left out — fresh objects every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedBlocks, deckId])

  const addBlock = useCallback((name: string) => {
    setBlocks((prev) => [...prev, { id: crypto.randomUUID(), name, order: prev.length, cardOracleIds: [] }])
  }, [])

  // The Considering block is fixed — not user-renameable or removable.
  const renameBlock = useCallback((blockId: string, name: string) => {
    if (blockId === CONSIDERING_BLOCK_ID) return
    setBlocks((prev) => prev.map((b) => (b.id === blockId ? { ...b, name } : b)))
  }, [])

  const removeBlock = useCallback((blockId: string) => {
    if (blockId === CONSIDERING_BLOCK_ID) return
    setBlocks((prev) => prev.filter((b) => b.id !== blockId))
  }, [])

  // Adding a card also drops it from Considering if it was sitting there —
  // a player might search for a card again without remembering they'd
  // already parked it in Considering; committing it to a real block should
  // "promote" it out of the maybe-pile instead of leaving a stale duplicate.
  const addCard = useCallback((blockId: string, oracleId: string) => {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id === blockId) return { ...b, cardOracleIds: [...b.cardOracleIds, oracleId] }
        if (b.id === CONSIDERING_BLOCK_ID) {
          const index = b.cardOracleIds.indexOf(oracleId)
          if (index === -1) return b
          const cardOracleIds = [...b.cardOracleIds]
          cardOracleIds.splice(index, 1)
          return { ...b, cardOracleIds }
        }
        return b
      }),
    )
  }, [])

  // Removes a single copy, not every copy — for a repeatable card (a basic
  // land) this is "decrement by one"; for anything else there's only ever
  // one copy to begin with, so it's equivalent to removing the card.
  const removeCard = useCallback((blockId: string, oracleId: string) => {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== blockId) return b
        const index = b.cardOracleIds.indexOf(oracleId)
        if (index === -1) return b
        const cardOracleIds = [...b.cardOracleIds]
        cardOracleIds.splice(index, 1)
        return { ...b, cardOracleIds }
      }),
    )
  }, [])

  // Drag-and-drop between blocks: moves every copy of a card from one block
  // to another in a single state update (a repeatable basic land's whole
  // stack moves together, since it's dragged as one grouped row — source
  // and target must differ, the caller is expected to no-op a drop back
  // onto the same block, matching "no reordering within a block").
  const moveCard = useCallback((fromBlockId: string, toBlockId: string, oracleId: string) => {
    if (fromBlockId === toBlockId) return
    setBlocks((prev) => {
      const fromBlock = prev.find((b) => b.id === fromBlockId)
      const moveCount = fromBlock ? fromBlock.cardOracleIds.filter((id) => id === oracleId).length : 0
      if (moveCount === 0) return prev
      return prev.map((b) => {
        if (b.id === fromBlockId) {
          return { ...b, cardOracleIds: b.cardOracleIds.filter((id) => id !== oracleId) }
        }
        if (b.id === toBlockId) {
          return { ...b, cardOracleIds: [...b.cardOracleIds, ...Array(moveCount).fill(oracleId)] }
        }
        return b
      })
    })
  }, [])

  // Manual block reordering (drag the block's own grip handle): moves
  // fromBlockId to sit where toBlockId currently is. Considering has a
  // fixed position outside this list, so it's never a valid endpoint.
  const reorderBlocks = useCallback((fromBlockId: string, toBlockId: string) => {
    if (fromBlockId === toBlockId) return
    if (fromBlockId === CONSIDERING_BLOCK_ID || toBlockId === CONSIDERING_BLOCK_ID) return
    setBlocks((prev) => {
      const fromIndex = prev.findIndex((b) => b.id === fromBlockId)
      const toIndex = prev.findIndex((b) => b.id === toBlockId)
      if (fromIndex === -1 || toIndex === -1) return prev
      const next = [...prev]
      const [moved] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, moved)
      return next.map((b, i) => ({ ...b, order: i }))
    })
  }, [])

  // Merges parsed+resolved import sections into the current blocks: a
  // section whose name matches an existing block (case-insensitive) appends
  // into it; anything else becomes a new block. Plain concatenation, not a
  // dedup — ImportDeckModal already excludes non-basic duplicates against
  // the deck's existing oracle_ids before calling this, while a basic
  // land's repeated oracle_id entries (the singleton-rule exception) must
  // survive the merge intact. A Set here would collapse "10 Forest" down
  // to 1, same as the plain new-block path below never deduped either.
  const importBlocks = useCallback((sections: { name: string; cardOracleIds: string[] }[]) => {
    setBlocks((prev) => {
      const next = [...prev]
      for (const section of sections) {
        const existingIndex = next.findIndex((b) => b.name.toLowerCase() === section.name.toLowerCase())
        if (existingIndex >= 0) {
          const existing = next[existingIndex]
          next[existingIndex] = {
            ...existing,
            cardOracleIds: [...existing.cardOracleIds, ...section.cardOracleIds],
          }
        } else {
          next.push({ id: crypto.randomUUID(), name: section.name, order: next.length, cardOracleIds: section.cardOracleIds })
        }
      }
      return next
    })
  }, [])

  return {
    blocks,
    addBlock,
    renameBlock,
    removeBlock,
    addCard,
    removeCard,
    moveCard,
    reorderBlocks,
    importBlocks,
    saving: updateDeck.isPending,
  }
}
