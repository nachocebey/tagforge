import { router, publicProcedure } from './trpc.js'
import { authRouter } from './auth/router.js'

export const appRouter = router({
  health: publicProcedure.query(() => ({
    status: 'ok' as const,
    timestamp: new Date().toISOString(),
  })),
  auth: authRouter,
})

export type AppRouter = typeof appRouter
