// A double-faced card's card_faces entries, stored verbatim from Scryfall.
// Only transform/modal_dfc/flip layouts carry a per-face image_uris — split
// and adventure cards share one combined image at the card level instead.
export interface CardFace {
  name: string
  image_uris?: Record<string, string>
}

// Hand-written rather than derived via `inferRouterOutputs<AppRouter>`:
// that chain (tRPC's own generics wrapping Prisma's already-complex
// generated Card type) hits TypeScript's "type instantiation is excessively
// deep" ceiling. Mirrors the public fields of the Card model in
// apps/backend/prisma/schema.prisma that the frontend actually reads.
export interface CardResult {
  oracleId: string
  name: string
  manaCost: string | null
  cmc: number
  typeLine: string
  oracleText: string | null
  colors: string[]
  colorIdentity: string[]
  producedMana: string[]
  layout: string
  releasedAt: string
  imageUris?: Record<string, string> | null
  cardFaces?: CardFace[] | null
  legalities: Record<string, string>
  prices?: Record<string, string | null> | null
  priceUsd: string | null
  canBeCommander: boolean
  isBackground: boolean
  hasPartner: boolean
  partnerWith: string | null
  choosesBackground: boolean
  updatedAt: string
}

export interface DeckSummary {
  id: string
  name: string
  commanderOracleIds: string[]
  createdAt: string
  updatedAt: string
}

export interface DeckBlock {
  id: string
  name: string
  order: number
  cardOracleIds: string[]
  // Cards "also" shown here via a row's "Add also..." menu — a reference to
  // a card that's genuinely placed in exactly one other block, not a second
  // real copy. Never counted toward this block's own tally, the deck's
  // total, mana curve/type counts, or export. May be absent on a deck saved
  // before this field existed — always read via `?? []`.
  shadowOracleIds?: string[]
}

export interface CardTag {
  id: string
  slug: string
  label: string
  description: string | null
}

export interface DeckStructure {
  blocks: DeckBlock[]
}

export interface DeckDetail {
  id: string
  userId: string
  name: string
  commanderOracleIds: string[]
  structure: DeckStructure
  createdAt: string
  updatedAt: string
  commanders: CardResult[]
}
