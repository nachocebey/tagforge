import { z } from 'zod'
import { router, publicProcedure } from '../trpc.js'
import { getCommanderRecommendations } from './recommendations.js'

// Kept as its own top-level namespace (edhrec.*, not bolted onto card.*)
// so the "this talks to an unofficial external page" boundary is visible
// at the API surface too, not just in the file layout.
export const edhrecRouter = router({
  recommendations: publicProcedure
    .input(z.object({ commanderName: z.string().min(1) }))
    .query(({ ctx, input }) => getCommanderRecommendations(ctx.prisma, input.commanderName)),
})
