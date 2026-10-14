import type { PrismaClient } from '@prisma/client'
import { fetchCommanderCardlists } from './client.js'
import { resolveCardsByNames } from '../search/resolve-names.js'
import type { CardDTO } from '../search/card-dto.js'

// The stable shape the rest of the app depends on — deliberately not a
// mirror of EDHREC's own JSON (see client.ts). If EDHREC is ever swapped
// for a different recommendation source, only this file and client.ts
// change; the router and every frontend caller keep working untouched.
export interface RecommendedCard {
  card: CardDTO
  synergy: number
  deckPercent: number
}

export interface CommanderRecommendations {
  highSynergy: RecommendedCard[]
  topCards: RecommendedCard[]
  gameChangers: RecommendedCard[]
  newCards: RecommendedCard[]
  creatures: RecommendedCard[]
  instants: RecommendedCard[]
  sorceries: RecommendedCard[]
  enchantments: RecommendedCard[]
}

const EMPTY_RESULT: CommanderRecommendations = {
  highSynergy: [],
  topCards: [],
  gameChangers: [],
  newCards: [],
  creatures: [],
  instants: [],
  sorceries: [],
  enchantments: [],
}

// EDHREC data moves slowly (it's itself an aggregate over many decks) and
// this is a courtesy fetch against someone else's unofficial page, not our
// own API — cache aggressively rather than re-fetching per deck load.
const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const cache = new Map<string, { expiresAt: number; data: CommanderRecommendations }>()

async function toRecommendedCards(
  prisma: PrismaClient,
  entries: { name: string; synergy: number; num_decks: number; potential_decks: number }[],
): Promise<RecommendedCard[]> {
  const resolved = await resolveCardsByNames(
    prisma,
    entries.map((e) => e.name),
  )
  const cards: RecommendedCard[] = []
  for (const entry of entries) {
    const card = resolved.get(entry.name)
    if (!card) continue
    cards.push({
      card,
      synergy: entry.synergy,
      deckPercent: entry.potential_decks > 0 ? (entry.num_decks / entry.potential_decks) * 100 : 0,
    })
  }
  return cards
}

// Public interface: give it a commander's name, get back cards the rest of
// the app already knows how to render (CardDTO) plus two simple numbers.
// Never throws and never returns partial garbage — any failure (network,
// unresolvable slug, unexpected page shape, no name matches) just yields
// EMPTY_RESULT, so callers don't need EDHREC-specific error handling.
export async function getCommanderRecommendations(
  prisma: PrismaClient,
  commanderName: string,
): Promise<CommanderRecommendations> {
  const cacheKey = commanderName.trim().toLowerCase()
  const cached = cache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return cached.data

  const cardlists = await fetchCommanderCardlists(commanderName)
  if (!cardlists) return EMPTY_RESULT

  const cardviewsFor = (tag: string) => cardlists.find((l) => l.tag === tag)?.cardviews ?? []
  const [highSynergy, topCards, gameChangers, newCards, creatures, instants, sorceries, enchantments] =
    await Promise.all([
      toRecommendedCards(prisma, cardviewsFor('highsynergycards')),
      toRecommendedCards(prisma, cardviewsFor('topcards')),
      toRecommendedCards(prisma, cardviewsFor('gamechangers')),
      toRecommendedCards(prisma, cardviewsFor('newcards')),
      toRecommendedCards(prisma, cardviewsFor('creatures')),
      toRecommendedCards(prisma, cardviewsFor('instants')),
      toRecommendedCards(prisma, cardviewsFor('sorceries')),
      toRecommendedCards(prisma, cardviewsFor('enchantments')),
    ])

  const data: CommanderRecommendations = {
    highSynergy,
    topCards,
    gameChangers,
    newCards,
    creatures,
    instants,
    sorceries,
    enchantments,
  }
  cache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL_MS })
  return data
}
