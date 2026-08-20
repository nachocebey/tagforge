import { router, publicProcedure } from './trpc.js'

export const appRouter = router({
  health: publicProcedure.query(() => ({
    status: 'ok' as const,
    timestamp: new Date().toISOString(),
  })),
})

export type AppRouter = typeof appRouter
