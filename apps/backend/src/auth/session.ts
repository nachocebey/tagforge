import type { PrismaClient } from '@prisma/client'

export const SESSION_COOKIE_NAME = 'session_id'

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days
export const SESSION_COOKIE_MAX_AGE_SECONDS = SESSION_TTL_MS / 1000

export function createSession(prisma: PrismaClient, userId: string) {
  return prisma.session.create({
    data: { userId, expiresAt: new Date(Date.now() + SESSION_TTL_MS) },
  })
}
