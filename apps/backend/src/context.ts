// Side-effect-only: pulls in @fastify/cookie's module augmentation
// (req.cookies) so it applies even when this file is type-checked from an
// entry point that never imports the plugin itself (e.g. the frontend
// resolving `AppRouter` through a deep relative import).
import type {} from '@fastify/cookie'
import type { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify'
import { prisma } from './db.js'
import { SESSION_COOKIE_NAME } from './auth/session.js'

export async function createContext({ req, res }: CreateFastifyContextOptions) {
  const sessionId = req.cookies[SESSION_COOKIE_NAME]
  let user = null

  if (sessionId) {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { user: true },
    })
    if (session && session.expiresAt > new Date()) {
      user = session.user
    }
  }

  return { req, res, prisma, user }
}

export type Context = Awaited<ReturnType<typeof createContext>>
