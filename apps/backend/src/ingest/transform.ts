import type { Prisma } from '@prisma/client'
import type { ScryfallCard, ScryfallTag } from './scryfall-types.js'

// Multi-faced cards (transform, modal_dfc, flip) omit these fields at the top
// level — they only exist per-face. Split/adventure cards usually DO have
// them combined at the top level. Always prefer the top-level value when
// present and only fall back to the faces, rather than branching on
// `layout`, since which fields go missing is not perfectly consistent across
// layouts (verified against a live sample of all layout types).
function effectiveOracleText(card: ScryfallCard): string | null {
  if (typeof card.oracle_text === 'string') return card.oracle_text
  const parts = (card.card_faces ?? []).map((f) => f.oracle_text).filter((t): t is string => !!t)
  return parts.length ? parts.join('\n // \n') : null
}

function effectiveManaCost(card: ScryfallCard): string | null {
  if (typeof card.mana_cost === 'string' && card.mana_cost.length > 0) return card.mana_cost
  const parts = (card.card_faces ?? []).map((f) => f.mana_cost).filter((c): c is string => !!c)
  return parts.length ? parts.join(' // ') : null
}

function effectiveColors(card: ScryfallCard): string[] {
  if (card.colors) return card.colors
  const faceColors = (card.card_faces ?? []).flatMap((f) => f.colors ?? [])
  return Array.from(new Set(faceColors))
}

function effectiveImageUris(card: ScryfallCard): Record<string, string> | null {
  if (card.image_uris) return card.image_uris
  return card.card_faces?.[0]?.image_uris ?? null
}

// A single card (The Beleaguered Boxer) is a Legendary Creature that
// explicitly can't be a commander outside a specific limited format — verified
// against live data. The negation check must win over the type-line rule.
const CANT_BE_COMMANDER = /can'?t be your commander|cannot be your commander/i
const CAN_BE_COMMANDER = /\bcan be your commander\b/i
const LEGENDARY_CREATURE = /Legendary Creature/
const BACKGROUND_TYPE = /\bBackground\b/
const PARTNER_LINE = /(^|\n)Partner(?!\s+with)\b/
const PARTNER_WITH = /(^|\n)Partner with ([^(\n]+)/
const CHOOSE_A_BACKGROUND = /Choose a Background/

interface CommanderFlags {
  canBeCommander: boolean
  isBackground: boolean
  hasPartner: boolean
  partnerWith: string | null
  choosesBackground: boolean
}

function deriveCommanderFlags(typeLine: string, oracleText: string): CommanderFlags {
  const cantBeCommander = CANT_BE_COMMANDER.test(oracleText)
  const canBeCommander =
    !cantBeCommander && (LEGENDARY_CREATURE.test(typeLine) || CAN_BE_COMMANDER.test(oracleText))
  const partnerWithMatch = oracleText.match(PARTNER_WITH)

  return {
    canBeCommander,
    isBackground: BACKGROUND_TYPE.test(typeLine),
    hasPartner: PARTNER_LINE.test(oracleText),
    partnerWith: partnerWithMatch ? partnerWithMatch[2].trim() : null,
    choosesBackground: CHOOSE_A_BACKGROUND.test(oracleText),
  }
}

function parsePriceUsd(card: ScryfallCard): string | null {
  const raw = card.prices?.usd ?? card.prices?.usd_foil ?? null
  return raw ?? null
}

export type CardRow = Prisma.CardUncheckedCreateInput

export function toCardRow(card: ScryfallCard): CardRow | null {
  if (card.object !== 'card' || !card.oracle_id) return null

  // oracle_cards also contains non-deckbuildable objects — art cards, tokens,
  // emblems, Planechase planes, Archenemy schemes, Vanguards, Un-set
  // Host/Augment pairs, Jumpstart front cards, silver-border jokes, etc.
  // Rather than hardcode every such `layout` value (a moving target — e.g.
  // "front_card" and "prepare" aren't in Scryfall's documented layout list
  // but showed up in live data), use Scryfall's own legality verdict: if a
  // card has never been legal, banned, or restricted in Commander, it isn't
  // something a Commander deck can include.
  if (card.legalities.commander === 'not_legal') return null

  const oracleText = effectiveOracleText(card) ?? ''
  const flags = deriveCommanderFlags(card.type_line, oracleText)

  return {
    oracleId: card.oracle_id,
    name: card.name,
    manaCost: effectiveManaCost(card),
    cmc: card.cmc,
    typeLine: card.type_line,
    oracleText: oracleText || null,
    colors: effectiveColors(card),
    colorIdentity: card.color_identity,
    layout: card.layout,
    releasedAt: new Date(card.released_at),
    imageUris: (effectiveImageUris(card) ?? undefined) as Prisma.InputJsonValue | undefined,
    cardFaces: card.card_faces as Prisma.InputJsonValue | undefined,
    legalities: card.legalities as Prisma.InputJsonValue,
    prices: card.prices as Prisma.InputJsonValue | undefined,
    priceUsd: parsePriceUsd(card),
    ...flags,
  }
}

export type TagRow = Prisma.TagUncheckedCreateInput

export function toTagRow(tag: ScryfallTag): TagRow {
  return {
    id: tag.id,
    slug: tag.slug,
    label: tag.label,
    type: tag.type,
    description: tag.description ?? null,
    parentIds: tag.parent_ids,
    childIds: tag.child_ids,
  }
}

export type TaggingRow = Prisma.TaggingUncheckedCreateInput

export function toTaggingRows(tag: ScryfallTag): TaggingRow[] {
  return tag.taggings.map((t) => ({
    tagId: tag.id,
    cardId: t.oracle_id,
    weight: t.weight ?? null,
  }))
}
