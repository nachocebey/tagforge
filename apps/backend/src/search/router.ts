import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { router, publicProcedure } from '../trpc.js'
import { parseSearchQuery } from './query-parser.js'
import { buildCardSearchWhere } from './build-where.js'
import { toCardDTOs } from './card-dto.js'
import { resolveCardsByNames } from './resolve-names.js'

const COLOR_LETTER = z.enum(['W', 'U', 'B', 'R', 'G'])
// 'color' has no direct SQL ordering (colors is a WUBRG array, not a single
// sortable scalar) — the search panel re-sorts its capped result page by
// color client-side, so the server just falls through to name order for it.
const SORT = z.enum(['name', 'cmc', 'color', 'price', 'released'])
const DIRECTION = z.enum(['asc', 'desc'])

// Shared by search results and the deck-block hydration below, since the
// brief's "global sort" selector (mana cost / price / release date) applies
// to cards inside every block at once, not just to search results.
function resolveOrderBy(
  sort: z.infer<typeof SORT>,
  direction: z.infer<typeof DIRECTION> = 'asc',
): Prisma.CardOrderByWithRelationInput[] {
  switch (sort) {
    case 'cmc':
      return [{ cmc: direction }, { name: 'asc' }]
    case 'price':
      // Postgres defaults to NULLS FIRST on DESC, which would bury every
      // priced card under the ones with no price data at all — pin nulls to
      // the end regardless of direction.
      return [{ priceUsd: { sort: direction, nulls: 'last' } }, { name: 'asc' }]
    case 'released':
      return [{ releasedAt: direction }, { name: 'asc' }]
    case 'name':
      return [{ name: direction }]
    default:
      return [{ name: 'asc' }]
  }
}

export const cardRouter = router({
  // Powers both the commander picker (query starts with "is:commander" and
  // no commanderColorIdentity) and the per-block card search (identity
  // constraint + excludeOracleIds for the singleton rule).
  search: publicProcedure
    .input(
      z.object({
        query: z.string().max(500).default(''),
        commanderColorIdentity: z.array(COLOR_LETTER).optional(),
        excludeOracleIds: z.array(z.string()).max(1000).default([]),
        sort: SORT.default('name'),
        // Named sortDirection, not "direction" — tRPC's useInfiniteQuery
        // input type reserves the field name "direction" for its own
        // forward/backward pagination concept, and silently rejects a
        // same-named field of a different type at the call site.
        sortDirection: DIRECTION.default('asc'),
        limit: z.number().int().min(1).max(100).default(50),
        // Offset-based, not an opaque id — resolveOrderBy always has a
        // stable `name asc` tiebreaker, so `skip`/`take` paging is
        // consistent across pages for every sort option.
        cursor: z.number().int().min(0).default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      const clauses = parseSearchQuery(input.query)
      const where = await buildCardSearchWhere(ctx.prisma, clauses, {
        commanderColorIdentity: input.commanderColorIdentity,
        excludeOracleIds: input.excludeOracleIds,
      })

      const items = await ctx.prisma.card.findMany({
        where,
        orderBy: resolveOrderBy(input.sort, input.sortDirection),
        skip: input.cursor,
        take: input.limit,
      })

      return {
        items: toCardDTOs(items),
        nextCursor: items.length === input.limit ? input.cursor + items.length : undefined,
      }
    }),

  // Resolves the full Card rows for a deck's block contents. deck.get only
  // returns oracle_ids in `structure` (and the resolved commander cards) —
  // this hydrates everything else the UI needs to render mana cost, name,
  // and price per card row.
  byOracleIds: publicProcedure
    .input(
      z.object({
        // 500 fit the deck alone; raised to cover deck + the unbounded
        // Considering "maybe pile" combined without silently failing.
        oracleIds: z.array(z.string()).max(1000),
        sort: SORT.default('name'),
        direction: DIRECTION.default('asc'),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (input.oracleIds.length === 0) return []
      return toCardDTOs(
        await ctx.prisma.card.findMany({
          where: { oracleId: { in: input.oracleIds } },
          orderBy: resolveOrderBy(input.sort, input.direction),
        }),
      )
    }),

  // Real signal (which commanders show up most often across all saved
  // decks on this instance), not an external popularity metric — that's
  // what edhrec/ is for. Tops up with recently
  // printed legendary creatures when there isn't enough deck data yet
  // (e.g. a fresh install) so the section is never empty.
  trendingCommanders: publicProcedure
    .input(z.object({ limit: z.number().int().min(1).max(20).default(8) }))
    .query(async ({ ctx, input }) => {
      const decks = await ctx.prisma.deck.findMany({ select: { commanderOracleIds: true } })
      const counts = new Map<string, number>()
      for (const deck of decks) {
        for (const oracleId of deck.commanderOracleIds) {
          counts.set(oracleId, (counts.get(oracleId) ?? 0) + 1)
        }
      }

      const topIds = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([id]) => id)
        .slice(0, input.limit)

      const cards = await ctx.prisma.card.findMany({ where: { oracleId: { in: topIds } } })
      const byId = new Map(cards.map((c) => [c.oracleId, c]))
      const ordered = topIds.flatMap((id) => byId.get(id) ?? [])

      if (ordered.length < input.limit) {
        const fallback = await ctx.prisma.card.findMany({
          where: { canBeCommander: true, oracleId: { notIn: ordered.map((c) => c.oracleId) } },
          orderBy: { releasedAt: 'desc' },
          take: input.limit - ordered.length,
        })
        return toCardDTOs([...ordered, ...fallback])
      }

      return toCardDTOs(ordered)
    }),

  // Tags assigned to one card, for the search panel's hover preview. `select`
  // (not `include`) keeps the return shape to plain scalar fields — Tag has
  // no Json columns, but narrowing explicitly avoids any risk of the same
  // "type instantiation is excessively deep" issue Card's Json fields cause
  // (see card-dto.ts).
  tags: publicProcedure.input(z.object({ oracleId: z.string() })).query(async ({ ctx, input }) => {
    const taggings = await ctx.prisma.tagging.findMany({
      where: { cardId: input.oracleId },
      select: { tag: { select: { id: true, slug: true, label: true, description: true } } },
    })
    return taggings.map((t) => t.tag)
  }),

  // Same shape as `tags`, batched — powers "Replace with...": matching a
  // card against every card in Considering by shared tags means fetching
  // taggings for the whole candidate pool at once, not one round trip per
  // candidate.
  tagsByOracleIds: publicProcedure
    .input(z.object({ oracleIds: z.array(z.string()).max(500) }))
    .query(async ({ ctx, input }) => {
      const uniqueOracleIds = [...new Set(input.oracleIds)]
      if (uniqueOracleIds.length === 0) return {}

      const taggings = await ctx.prisma.tagging.findMany({
        where: { cardId: { in: uniqueOracleIds } },
        select: { cardId: true, tag: { select: { id: true, slug: true, label: true, description: true } } },
      })

      const byOracleId: Record<string, typeof taggings[number]['tag'][]> = {}
      for (const oracleId of uniqueOracleIds) byOracleId[oracleId] = []
      for (const t of taggings) byOracleId[t.cardId]?.push(t.tag)
      return byOracleId
    }),

  // Tag lookup by free text — matches slug or label (a search for "draw"
  // should surface the tag literally called "draw", not just ones whose
  // description happens to mention it). Powers a "what tags exist" search
  // independent of any one card, e.g. an autocomplete while composing a
  // `tag:` search clause.
  searchTags: publicProcedure
    .input(z.object({ query: z.string().min(1).max(100), limit: z.number().int().min(1).max(50).default(20) }))
    .query(async ({ ctx, input }) => {
      const tags = await ctx.prisma.tag.findMany({
        where: {
          OR: [{ slug: { contains: input.query, mode: 'insensitive' } }, { label: { contains: input.query, mode: 'insensitive' } }],
        },
        select: { id: true, slug: true, label: true, description: true },
        orderBy: { slug: 'asc' },
        take: input.limit,
      })
      return tags
    }),

  // Resolves plain card names (as pasted from a decklist) to real cards, for
  // deck import. Two passes: exact case-insensitive name match first, then
  // a "Front // " prefix match for whatever's left — double-faced cards are
  // stored under their combined "Front // Back" name, but a pasted decklist
  // almost always only names the front face (verified against real data:
  // "Delver of Secrets" doesn't match anything by itself, but does match
  // "Delver of Secrets // Insectile Aberration" via startsWith).
  resolveByNames: publicProcedure
    .input(z.object({ names: z.array(z.string().min(1)).max(300) }))
    .query(async ({ ctx, input }) => {
      const uniqueNames = [...new Set(input.names.map((n) => n.trim()).filter(Boolean))]
      const resolved = await resolveCardsByNames(ctx.prisma, uniqueNames)
      return uniqueNames.map((name) => ({ queriedName: name, card: resolved.get(name) ?? null }))
    }),
})
