import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { router, publicProcedure } from '../trpc.js'
import { parseSearchQuery } from './query-parser.js'
import { buildCardSearchWhere } from './build-where.js'

const COLOR_LETTER = z.enum(['W', 'U', 'B', 'R', 'G'])
const SORT = z.enum(['name', 'cmc', 'price', 'released'])

// Shared by search results and the deck-block hydration below, since the
// brief's "global sort" selector (mana cost / price / release date) applies
// to cards inside every block at once, not just to search results.
function resolveOrderBy(sort: z.infer<typeof SORT>): Prisma.CardOrderByWithRelationInput[] {
  switch (sort) {
    case 'cmc':
      return [{ cmc: 'asc' }, { name: 'asc' }]
    case 'price':
      return [{ priceUsd: 'asc' }, { name: 'asc' }]
    case 'released':
      return [{ releasedAt: 'desc' }, { name: 'asc' }]
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
        excludeOracleIds: z.array(z.string()).max(500).default([]),
        sort: SORT.default('name'),
        limit: z.number().int().min(1).max(100).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      const clauses = parseSearchQuery(input.query)
      const where = await buildCardSearchWhere(ctx.prisma, clauses, {
        commanderColorIdentity: input.commanderColorIdentity,
        excludeOracleIds: input.excludeOracleIds,
      })

      return ctx.prisma.card.findMany({ where, orderBy: resolveOrderBy(input.sort), take: input.limit })
    }),

  // Resolves the full Card rows for a deck's block contents. deck.get only
  // returns oracle_ids in `structure` (and the resolved commander cards) —
  // this hydrates everything else the UI needs to render mana cost, name,
  // and price per card row.
  byOracleIds: publicProcedure
    .input(z.object({ oracleIds: z.array(z.string()).max(500), sort: SORT.default('name') }))
    .query(({ ctx, input }) => {
      if (input.oracleIds.length === 0) return []
      return ctx.prisma.card.findMany({
        where: { oracleId: { in: input.oracleIds } },
        orderBy: resolveOrderBy(input.sort),
      })
    }),
})
