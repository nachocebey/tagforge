import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { router, publicProcedure } from '../trpc.js'
import { parseSearchQuery } from './query-parser.js'
import { buildCardSearchWhere } from './build-where.js'

const COLOR_LETTER = z.enum(['W', 'U', 'B', 'R', 'G'])

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
        sort: z.enum(['name', 'cmc', 'price', 'released']).default('name'),
        limit: z.number().int().min(1).max(100).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      const clauses = parseSearchQuery(input.query)
      const where = await buildCardSearchWhere(ctx.prisma, clauses, {
        commanderColorIdentity: input.commanderColorIdentity,
        excludeOracleIds: input.excludeOracleIds,
      })

      const orderBy: Prisma.CardOrderByWithRelationInput[] =
        input.sort === 'cmc'
          ? [{ cmc: 'asc' }, { name: 'asc' }]
          : input.sort === 'price'
            ? [{ priceUsd: 'asc' }, { name: 'asc' }]
            : input.sort === 'released'
              ? [{ releasedAt: 'desc' }, { name: 'asc' }]
              : [{ name: 'asc' }]

      return ctx.prisma.card.findMany({ where, orderBy, take: input.limit })
    }),
})
