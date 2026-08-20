// See the comment in ../context.ts — same module-augmentation reason.
import type {} from '@fastify/cookie'
import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import type { FastifyReply } from 'fastify'
import { router, publicProcedure, protectedProcedure } from '../trpc.js'
import { hashPassword, verifyPassword } from './password.js'
import { createSession, SESSION_COOKIE_NAME, SESSION_COOKIE_MAX_AGE_SECONDS } from './session.js'
import { checkRateLimit } from './rate-limit.js'

const LOGIN_MAX_ATTEMPTS = 10
const LOGIN_WINDOW_MS = 15 * 60 * 1000

const emailSchema = z.string().trim().toLowerCase().email()
const passwordSchema = z.string().min(8).max(200)

function setSessionCookie(res: FastifyReply, sessionId: string) {
  res.setCookie(SESSION_COOKIE_NAME, sessionId, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
  })
}

export const authRouter = router({
  register: publicProcedure
    .input(z.object({ email: emailSchema, password: passwordSchema }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.user.findUnique({ where: { email: input.email } })
      if (existing) {
        throw new TRPCError({ code: 'CONFLICT', message: 'Email already registered' })
      }

      const passwordHash = await hashPassword(input.password)
      const user = await ctx.prisma.user.create({ data: { email: input.email, passwordHash } })
      const session = await createSession(ctx.prisma, user.id)
      setSessionCookie(ctx.res, session.id)

      return { id: user.id, email: user.email }
    }),

  login: publicProcedure
    .input(z.object({ email: emailSchema, password: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      if (!checkRateLimit(`login:${ctx.req.ip}:${input.email}`, LOGIN_MAX_ATTEMPTS, LOGIN_WINDOW_MS)) {
        throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'Too many login attempts. Try again later.' })
      }

      const user = await ctx.prisma.user.findUnique({ where: { email: input.email } })
      const valid = await verifyPassword(input.password, user?.passwordHash ?? null)
      if (!user || !valid) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid email or password' })
      }

      const session = await createSession(ctx.prisma, user.id)
      setSessionCookie(ctx.res, session.id)

      return { id: user.id, email: user.email }
    }),

  logout: protectedProcedure.mutation(async ({ ctx }) => {
    const sessionId = ctx.req.cookies[SESSION_COOKIE_NAME]
    if (sessionId) {
      await ctx.prisma.session.deleteMany({ where: { id: sessionId } })
    }
    ctx.res.clearCookie(SESSION_COOKIE_NAME, { path: '/' })
    return { ok: true }
  }),

  me: publicProcedure.query(({ ctx }) => {
    return ctx.user ? { id: ctx.user.id, email: ctx.user.email } : null
  }),
})
