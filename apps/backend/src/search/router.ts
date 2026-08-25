import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { router, publicProcedure } from '../trpc.js'
import { parseSearchQuery } from './query-parser.js'
import { buildCardSearchWhere } from './build-where.js'
import { toCardDTO, toCardDTOs } from './card-dto.js'

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
        direction: DIRECTION.default('asc'),
        limit: z.number().int().min(1).max(100).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      const clauses = parseSearchQuery(input.query)
      const where = await buildCardSearchWhere(ctx.prisma, clauses, {
        commanderColorIdentity: input.commanderColorIdentity,
        excludeOracleIds: input.excludeOracleIds,
      })

      return toCardDTOs(
        await ctx.prisma.card.findMany({
          where,
          orderBy: resolveOrderBy(input.sort, input.direction),
          take: input.limit,
        }),
      )
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
  // decks), not an external popularity metric — EDHREC integration is
  // explicitly out of scope for this project. Tops up with recently
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
      select: { tag: { select: { id: true, slug: true, label: true } } },
    })
    return taggings.map((t) => t.tag)
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
      if (uniqueNames.length === 0) return []

      const exactMatches = await ctx.prisma.card.findMany({
        where: { name: { in: uniqueNames, mode: 'insensitive' } },
      })
      const byLowerName = new Map(exactMatches.map((c) => [c.name.toLowerCase(), c]))

      const results: { queriedName: string; card: ReturnType<typeof toCardDTO> | null }[] = []
      const unresolved: string[] = []

      for (const name of uniqueNames) {
        const match = byLowerName.get(name.toLowerCase())
        if (match) results.push({ queriedName: name, card: toCardDTO(match) })
        else unresolved.push(name)
      }

      if (unresolved.length > 0) {
        // One batched query instead of one findFirst per unresolved name —
        // a decklist heavy on DFCs (transform, modal_dfc) could otherwise
        // mean dozens of sequential round trips just to resolve fronts.
        const dfcMatches = await ctx.prisma.card.findMany({
          where: { OR: unresolved.map((name) => ({ name: { startsWith: `${name} // `, mode: 'insensitive' } })) },
        })
        for (const name of unresolved) {
          const prefix = `${name.toLowerCase()} // `
          const match = dfcMatches.find((c) => c.name.toLowerCase().startsWith(prefix))
          results.push({ queriedName: name, card: match ? toCardDTO(match) : null })
        }
      }

      return results
    }),
})
