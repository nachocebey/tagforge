import { useCallback, useEffect, useRef, useState } from 'react'
import { trpc } from './trpc'
import { useDebouncedValue } from './use-debounced-value'
import { CONSIDERING_BLOCK_ID, CONSIDERING_BLOCK_NAME } from './considering'
import type { DeckBlock, DeckStructure } from './trpc-types'

function withConsideringBlock(blocks: DeckBlock[]): DeckBlock[] {
  if (blocks.some((b) => b.id === CONSIDERING_BLOCK_ID)) return blocks
  return [
    { id: CONSIDERING_BLOCK_ID, name: CONSIDERING_BLOCK_NAME, order: -1, cardOracleIds: [], shadowOracleIds: [] },
    ...blocks,
  ]
}

// A deck saved before shadow copies existed has no `shadowOracleIds` in its
// stored JSON at all (deck.get doesn't run it back through the zod schema,
// so there's no `.default([])` to fall back on) — normalize once on load so
// every mutator below can assume the array is always there.
function normalizeShadows(blocks: DeckBlock[]): DeckBlock[] {
  return blocks.map((b) => (b.shadowOracleIds ? b : { ...b, shadowOracleIds: [] }))
}

// A shadow reference only makes sense while the card it points to is
// genuinely placed somewhere — run after every mutation that can change
// which oracle_ids are real (add/remove/move/import) so a shadow never
// outlives (or duplicates) the real copy backing it.
function pruneShadows(blocks: DeckBlock[]): DeckBlock[] {
  const realIds = new Set(blocks.flatMap((b) => b.cardOracleIds))
  return blocks.map((b) => ({
    ...b,
    shadowOracleIds: (b.shadowOracleIds ?? []).filter((id) => realIds.has(id) && !b.cardOracleIds.includes(id)),
  }))
}

// Local-first block editing with debounced autosave: every mutation updates
// state immediately (so the UI never waits on the network), and the whole
// structure is persisted ~1.2s after the last change — matching the
// brief's "autosave with debounce, not per-event" requirement.
export function useDeckStructure(deckId: string, initial: DeckStructure) {
  const [blocks, setBlocks] = useState<DeckBlock[]>(() => normalizeShadows(withConsideringBlock(initial.blocks)))
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
    setBlocks((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: name.toUpperCase(), order: prev.length, cardOracleIds: [], shadowOracleIds: [] },
    ])
  }, [])

  // The "Create new" option in the drag-drop side panel: makes a fresh
  // block and drops the dragged card straight into it in one state update,
  // rather than two (which would leave a brief frame with an empty block
  // and no card, and double the autosave churn). `fromBlockId` is set when
  // an existing deck card is being relocated (mirrors moveCard); omitted
  // for a card with nowhere to move *from*, like an EDHREC recommendation.
  const createBlockWithCard = useCallback((oracleId: string, fromBlockId?: string): string => {
    const newBlockId = crypto.randomUUID()
    setBlocks((prev) => {
      const withRemoved = fromBlockId
        ? prev.map((b) => (b.id === fromBlockId ? { ...b, cardOracleIds: b.cardOracleIds.filter((id) => id !== oracleId) } : b))
        : prev
      return pruneShadows([
        ...withRemoved,
        { id: newBlockId, name: 'NEW BLOCK', order: withRemoved.length, cardOracleIds: [oracleId], shadowOracleIds: [] },
      ])
    })
    return newBlockId
  }, [])

  // The Considering block is fixed — not user-renameable or removable.
  // Block names are always upper-cased in storage (also enforced server-side
  // in structure.ts, since export/clipboard-copy read the raw string rather
  // than relying on the build screen's CSS uppercase styling).
  const renameBlock = useCallback((blockId: string, name: string) => {
    if (blockId === CONSIDERING_BLOCK_ID) return
    setBlocks((prev) => prev.map((b) => (b.id === blockId ? { ...b, name: name.toUpperCase() } : b)))
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
      pruneShadows(
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
      ),
    )
  }, [])

  // Removes a single copy, not every copy — for a repeatable card (a basic
  // land) this is "decrement by one"; for anything else there's only ever
  // one copy to begin with, so it's equivalent to removing the card.
  const removeCard = useCallback((blockId: string, oracleId: string) => {
    setBlocks((prev) =>
      pruneShadows(
        prev.map((b) => {
          if (b.id !== blockId) return b
          const index = b.cardOracleIds.indexOf(oracleId)
          if (index === -1) return b
          const cardOracleIds = [...b.cardOracleIds]
          cardOracleIds.splice(index, 1)
          return { ...b, cardOracleIds }
        }),
      ),
    )
  }, [])

  // Places a *reference* to a card that's already really in the deck into
  // another block — used by a row's "Add also..." menu so a card can show
  // up in more than one list without a second real copy: this never touches
  // cardOracleIds, so it can't affect the deck count, mana curve, type
  // counts, export, or the singleton-rule exclusion set.
  const addShadowCard = useCallback((blockId: string, oracleId: string) => {
    setBlocks((prev) => {
      const realIds = new Set(prev.flatMap((b) => b.cardOracleIds))
      if (!realIds.has(oracleId)) return prev
      return prev.map((b) => {
        if (b.id !== blockId) return b
        if (b.cardOracleIds.includes(oracleId) || (b.shadowOracleIds ?? []).includes(oracleId)) return b
        return { ...b, shadowOracleIds: [...(b.shadowOracleIds ?? []), oracleId] }
      })
    })
  }, [])

  const removeShadowCard = useCallback((blockId: string, oracleId: string) => {
    setBlocks((prev) =>
      prev.map((b) =>
        b.id === blockId ? { ...b, shadowOracleIds: (b.shadowOracleIds ?? []).filter((id) => id !== oracleId) } : b,
      ),
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
      return pruneShadows(
        prev.map((b) => {
          if (b.id === fromBlockId) {
            return { ...b, cardOracleIds: b.cardOracleIds.filter((id) => id !== oracleId) }
          }
          if (b.id === toBlockId) {
            return { ...b, cardOracleIds: [...b.cardOracleIds, ...Array(moveCount).fill(oracleId)] }
          }
          return b
        }),
      )
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

  // Replaces every non-Considering block wholesale with the parsed+resolved
  // import sections — not a merge into whatever blocks already existed.
  // Considering is left alone, except: any card the import also contains
  // gets "promoted" out of it (removed), same idea as addCard's promotion,
  // since it's no longer just something you were considering.
  const importBlocks = useCallback((sections: { name: string; cardOracleIds: string[] }[]) => {
    setBlocks((prev) => {
      const consideringBlock = prev.find((b) => b.id === CONSIDERING_BLOCK_ID)
      const importedOracleIds = new Set(sections.flatMap((s) => s.cardOracleIds))

      const newConsidering = consideringBlock
        ? {
            ...consideringBlock,
            cardOracleIds: consideringBlock.cardOracleIds.filter((id) => !importedOracleIds.has(id)),
          }
        : null

      const newNormalBlocks = sections.map((section) => ({
        id: crypto.randomUUID(),
        name: section.name.toUpperCase(),
        order: 0,
        cardOracleIds: section.cardOracleIds,
        shadowOracleIds: [],
      }))

      return pruneShadows(
        [...(newConsidering ? [newConsidering] : []), ...newNormalBlocks].map((b, i) => ({ ...b, order: i })),
      )
    })
  }, [])

  // "Replace with...": swaps one card already in a block for one pulled
  // out of Considering, in the same position (so it doesn't just get
  // appended to the end of the block) and in one state update. The
  // replacement is also removed from Considering — it's not a maybe any
  // more, it's the thing that's actually in the deck now.
  const replaceCard = useCallback((blockId: string, oldOracleId: string, newOracleId: string) => {
    setBlocks((prev) =>
      pruneShadows(
        prev.map((b) => {
          if (b.id === blockId) {
            const index = b.cardOracleIds.indexOf(oldOracleId)
            if (index === -1) return b
            const cardOracleIds = [...b.cardOracleIds]
            cardOracleIds.splice(index, 1, newOracleId)
            return { ...b, cardOracleIds }
          }
          if (b.id === CONSIDERING_BLOCK_ID) {
            const index = b.cardOracleIds.indexOf(newOracleId)
            if (index === -1) return b
            const cardOracleIds = [...b.cardOracleIds]
            cardOracleIds.splice(index, 1)
            return { ...b, cardOracleIds }
          }
          return b
        }),
      ),
    )
  }, [])

  // "Clear deck": removes every normal block (cards go with them, since a
  // card only ever lives in the block that holds it) and leaves the
  // commander(s) — those aren't part of `blocks` at all — untouched.
  // Considering is deliberately left alone too, same as import: it's a
  // maybe-pile the user built up separately, not part of "the deck".
  const clearDeck = useCallback(() => {
    setBlocks((prev) => prev.filter((b) => b.id === CONSIDERING_BLOCK_ID))
  }, [])

  return {
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
    saving: updateDeck.isPending,
  }
}
