import { createTRPCReact } from '@trpc/react-query'
import { httpBatchLink } from '@trpc/client'
import type { AppRouter } from '../../../backend/src/router'

export const trpc = createTRPCReact<AppRouter>()

const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:4000'

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: `${apiUrl}/trpc`,
      // Frontend (5173) and backend (4000) are different origins in dev —
      // fetch defaults to credentials: 'same-origin', which silently drops
      // the session cookie both on the way out and on Set-Cookie from the
      // response. Without this, login "succeeds" (200) but the browser
      // never actually stores or resends the session cookie.
      fetch(url, options) {
        return fetch(url, { ...options, credentials: 'include' })
      },
    }),
  ],
})
