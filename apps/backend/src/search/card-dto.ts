// A structurally-simple mirror of the Card model's public shape. tRPC's
// output-type inference carries a procedure's return type through the whole
// AppRouter to the frontend; Prisma's generated Card type (recursive
// JsonValue for imageUris/cardFaces/legalities/prices, a branded Decimal for
// priceUsd) is expensive enough that consuming it — query or mutation alike
// — hit TypeScript's "type instantiation is excessively deep" ceiling on
// the frontend. Every procedure returning card rows casts through this
// type; the runtime objects are unchanged, only the static type is
// narrowed.
// Only transform/modal_dfc/flip card_faces entries carry their own
// image_uris — split/adventure cards' faces exist but share one combined
// image at the card level instead.
export interface CardFaceDTO {
  name: string
  image_uris?: Record<string, string>
}

export interface CardDTO {
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
  releasedAt: Date
  imageUris: Record<string, string> | null
  cardFaces: CardFaceDTO[] | null
  legalities: Record<string, string>
  prices: Record<string, string | null> | null
  priceUsd: string | null
  canBeCommander: boolean
  isBackground: boolean
  hasPartner: boolean
  partnerWith: string | null
  choosesBackground: boolean
  updatedAt: Date
}

export function toCardDTO(card: unknown): CardDTO {
  return card as CardDTO
}

export function toCardDTOs(cards: unknown[]): CardDTO[] {
  return cards as CardDTO[]
}
