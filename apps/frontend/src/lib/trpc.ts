import { createTRPCReact } from '@trpc/react-query'
import { httpBatchLink } from '@trpc/client'
import type { AppRouter } from '../../../backend/src/router'

export const trpc = createTRPCReact<AppRouter>()

const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:4000'

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: `${apiUrl}/trpc`,
    }),
  ],
})
