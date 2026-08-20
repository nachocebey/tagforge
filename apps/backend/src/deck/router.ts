import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import type { Card, PrismaClient } from '@prisma/client'
import { router, protectedProcedure } from '../trpc.js'
import { deckStructureSchema, emptyDeckStructure } from './structure.js'
import { validateCommanderPair } from './commander-pairing.js'

const MAX_DECKS_PER_USER = 50

const commanderOracleIdsSchema = z.array(z.string()).min(1).max(2)

// Fetches the commander cards and returns them in the same order as
// `oracleIds` (Prisma's findMany with `in` doesn't preserve input order).
async function resolveCommanders(prisma: PrismaClient, oracleIds: string[]): Promise<Card[]> {
  const cards = await prisma.card.findMany({ where: { oracleId: { in: oracleIds } } })
  const byId = new Map(cards.map((c) => [c.oracleId, c]))
  const ordered = oracleIds.map((id) => byId.get(id))

  if (ordered.some((c) => !c)) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'One or more commander cards were not found.' })
  }
  return ordered as Card[]
}

async function assertValidCommanderPair(prisma: PrismaClient, oracleIds: string[]): Promise<Card[]> {
  const commanders = await resolveCommanders(prisma, oracleIds)
  const result = validateCommanderPair(commanders[0], commanders[1] ?? null)
  if (!result.ok) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: result.reason })
  }
  return commanders
}

async function requireOwnedDeck(prisma: PrismaClient, deckId: string, userId: string) {
  const deck = await prisma.deck.findUnique({ where: { id: deckId } })
  // Same NOT_FOUND for "doesn't exist" and "exists but isn't yours" — don't
  // reveal other users' deck ids.
  if (!deck || deck.userId !== userId) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Deck not found' })
  }
  return deck
}

export const deckRouter = router({
  create: protectedProcedure
    .input(z.object({ name: z.string().min(1).max(100), commanderOracleIds: commanderOracleIdsSchema }))
    .mutation(async ({ ctx, input }) => {
      const deckCount = await ctx.prisma.deck.count({ where: { userId: ctx.user.id } })
      if (deckCount >= MAX_DECKS_PER_USER) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: `You've reached the ${MAX_DECKS_PER_USER}-deck limit.` })
      }

      const commanders = await assertValidCommanderPair(ctx.prisma, input.commanderOracleIds)

      const deck = await ctx.prisma.deck.create({
        data: {
          userId: ctx.user.id,
          name: input.name,
          commanderOracleIds: input.commanderOracleIds,
          structure: emptyDeckStructure,
        },
      })

      return { ...deck, commanders }
    }),

  list: protectedProcedure.query(({ ctx }) =>
    ctx.prisma.deck.findMany({
      where: { userId: ctx.user.id },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, name: true, commanderOracleIds: true, createdAt: true, updatedAt: true },
    }),
  ),

  get: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const deck = await requireOwnedDeck(ctx.prisma, input.id, ctx.user.id)
    const commanders = await resolveCommanders(ctx.prisma, deck.commanderOracleIds)
    return { ...deck, commanders }
  }),

  // Used for autosave — any subset of fields may be provided.
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(100).optional(),
        commanderOracleIds: commanderOracleIdsSchema.optional(),
        structure: deckStructureSchema.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireOwnedDeck(ctx.prisma, input.id, ctx.user.id)

      if (input.commanderOracleIds) {
        await assertValidCommanderPair(ctx.prisma, input.commanderOracleIds)
      }

      return ctx.prisma.deck.update({
        where: { id: input.id },
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.commanderOracleIds !== undefined && { commanderOracleIds: input.commanderOracleIds }),
          ...(input.structure !== undefined && { structure: input.structure }),
        },
      })
    }),

  remove: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    await requireOwnedDeck(ctx.prisma, input.id, ctx.user.id)
    await ctx.prisma.deck.delete({ where: { id: input.id } })
    return { ok: true }
  }),
})
