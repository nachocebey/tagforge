---
paths:
  - "apps/backend/src/auth/**/*"
  - "apps/backend/src/context.ts"
  - "apps/backend/src/trpc.ts"
  - "apps/frontend/src/lib/trpc.ts"
---

# Auth

`password.ts`, `session.ts`, `rate-limit.ts`, `router.ts` — the `auth.*` procedures: `register`, `login`, `logout`, `me`.

- Sessions are httpOnly cookies (`session_id`) pointing at a `Session` row, not JWTs — `protectedProcedure` reads `ctx.user` (populated in `context.ts` from the cookie) and throws `UNAUTHORIZED` if absent.
- `verifyPassword` always runs a bcrypt compare (against a fixed dummy hash when no user exists) so a login attempt against an unregistered email takes the same time as a real one — otherwise timing leaks which emails are registered.
- CORS is locked to `FRONTEND_URL` (not `origin: true`) with `credentials: true` — reflecting any origin would let another site ride a logged-in user's cookies.
- The login rate limiter is in-memory, keyed by `ip:email`, 10 attempts/15min — resets on restart, not distributed, and counts successful logins toward the same limit (simplest correct behavior).
- **Fastify plugin decorators need an explicit type import wherever they're used.** `@fastify/cookie` adds `req.cookies`/`res.setCookie` via module augmentation, which only applies within a TS program that includes the plugin's import. `apps/frontend/src/lib/trpc.ts` imports `AppRouter`'s *type* through a path into the backend that never imports `@fastify/cookie` itself, silently losing the augmentation and failing to typecheck. Fixed with a side-effect `import type {} from '@fastify/cookie'` in both files — same pattern applies to any future Fastify plugin decorator used outside `index.ts`.
