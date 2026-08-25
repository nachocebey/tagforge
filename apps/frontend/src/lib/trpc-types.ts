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
  layout: string
  releasedAt: string
  imageUris?: Record<string, string> | null
  cardFaces?: unknown
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
}

export interface CardTag {
  id: string
  slug: string
  label: string
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
