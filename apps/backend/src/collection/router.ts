import { z } from 'zod'
import { router, protectedProcedure } from '../trpc.js'

// Deliberately not a full collection system — no quantities, no
// printings/versions, just "do I own this card at all", shared across all
// of a user's decks (not scoped to one deck).
export const collectionRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.prisma.ownedCard.findMany({
      where: { userId: ctx.user.id },
      select: { oracleId: true },
    })
    return rows.map((r) => r.oracleId)
  }),

  mark: protectedProcedure.input(z.object({ oracleId: z.string() })).mutation(async ({ ctx, input }) => {
    await ctx.prisma.ownedCard.upsert({
      where: { userId_oracleId: { userId: ctx.user.id, oracleId: input.oracleId } },
      create: { userId: ctx.user.id, oracleId: input.oracleId },
      update: {},
    })
    return { ok: true as const }
  }),

  unmark: protectedProcedure.input(z.object({ oracleId: z.string() })).mutation(async ({ ctx, input }) => {
    await ctx.prisma.ownedCard.deleteMany({
      where: { userId: ctx.user.id, oracleId: input.oracleId },
    })
    return { ok: true as const }
  }),
})
