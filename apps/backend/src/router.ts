import { router, publicProcedure } from './trpc.js'
import { authRouter } from './auth/router.js'
import { cardRouter } from './search/router.js'
import { deckRouter } from './deck/router.js'
import { collectionRouter } from './collection/router.js'
import { edhrecRouter } from './edhrec/router.js'

export const appRouter = router({
  health: publicProcedure.query(() => ({
    status: 'ok' as const,
    timestamp: new Date().toISOString(),
  })),
  auth: authRouter,
  card: cardRouter,
  deck: deckRouter,
  collection: collectionRouter,
  edhrec: edhrecRouter,
})

export type AppRouter = typeof appRouter
