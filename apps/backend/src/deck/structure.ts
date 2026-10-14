import { randomUUID } from 'node:crypto'
import { z } from 'zod'

// The deck's full block layout (block name, order, cards per block) —
// persisted verbatim in Deck.structure (JSONB) so a deck reloads exactly as
// it was left, with no reconstruction from a flat card list.
export const blockSchema = z.object({
  id: z.string().min(1),
  // Always upper-cased on write, regardless of what the client sent — the
  // build screen renders names in all-caps via CSS anyway, but export and
  // clipboard-copy read this raw string, so the casing has to be real, not
  // just visual.
  name: z
    .string()
    .min(1)
    .max(100)
    .transform((s) => s.toUpperCase()),
  order: z.number().int(),
  cardOracleIds: z.array(z.string()),
  // Cards "also" placed here for organizational purposes via a card row's
  // "Add also..." menu — always a reference to a card that's genuinely in
  // exactly one other block (or Considering), never a second real copy.
  // Excluded from every count/total (deck size, mana curve, type counts,
  // export, singleton-rule exclusion) precisely because it isn't one.
  shadowOracleIds: z.array(z.string()).default([]),
})

export const deckStructureSchema = z.object({
  blocks: z.array(blockSchema),
})

export type DeckStructure = z.infer<typeof deckStructureSchema>

export const emptyDeckStructure: DeckStructure = { blocks: [] }

// A brand-new deck starts with these blocks pre-created rather than
// blank — a one-time default at creation, not something re-injected on
// every load, so a user who deletes all their blocks later doesn't see
// them reappear (unlike the fixed Considering block, which does).
const DEFAULT_BLOCK_NAMES = ['LANDS', 'RAMP', 'REMOVAL', 'DRAW']

export function defaultDeckStructure(): DeckStructure {
  return {
    blocks: DEFAULT_BLOCK_NAMES.map((name, order) => ({
      id: randomUUID(),
      name,
      order,
      cardOracleIds: [],
      shadowOracleIds: [],
    })),
  }
}
