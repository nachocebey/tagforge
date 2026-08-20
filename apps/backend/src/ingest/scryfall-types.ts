// Minimal shapes for the fields we actually read from Scryfall's bulk JSONL
// files. Not a full mirror of the Scryfall API — see
// https://scryfall.com/docs/api/cards and https://scryfall.com/docs/api/tags
// for the complete objects.

export interface ScryfallCardFace {
  name: string
  mana_cost?: string
  type_line?: string
  oracle_text?: string
  colors?: string[]
  image_uris?: Record<string, string>
}

export interface ScryfallCard {
  object: string
  oracle_id: string
  name: string
  layout: string
  released_at: string
  cmc: number
  type_line: string
  color_identity: string[]
  colors?: string[]
  mana_cost?: string
  oracle_text?: string
  image_uris?: Record<string, string>
  card_faces?: ScryfallCardFace[]
  legalities: Record<string, string>
  prices?: {
    usd?: string | null
    usd_foil?: string | null
    usd_etched?: string | null
    eur?: string | null
    eur_foil?: string | null
    tix?: string | null
  }
}

export interface ScryfallTagging {
  oracle_id: string
  weight: string
}

export interface ScryfallTag {
  object: string
  id: string
  slug: string
  label: string
  type: string
  description?: string | null
  parent_ids: string[]
  child_ids: string[]
  taggings: ScryfallTagging[]
}

export interface BulkDataEntry {
  type: string
  name: string
  updated_at: string
  jsonl_download_uri: string
  compressed_size: number
}
