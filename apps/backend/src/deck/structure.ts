import { z } from 'zod'

// The deck's full block layout (block name, order, cards per block) —
// persisted verbatim in Deck.structure (JSONB) so a deck reloads exactly as
// it was left, with no reconstruction from a flat card list.
export const blockSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  order: z.number().int(),
  cardOracleIds: z.array(z.string()),
})

export const deckStructureSchema = z.object({
  blocks: z.array(blockSchema),
})

export type DeckStructure = z.infer<typeof deckStructureSchema>

export const emptyDeckStructure: DeckStructure = { blocks: [] }
