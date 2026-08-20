import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import cookie from '@fastify/cookie'
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify'
import { appRouter } from './router.js'
import { createContext } from './context.js'

const server = Fastify()

await server.register(cors, {
  origin: [process.env.FRONTEND_URL ?? 'http://localhost:5173'],
  credentials: true,
})
await server.register(cookie)
await server.register(fastifyTRPCPlugin, {
  prefix: '/trpc',
  trpcOptions: { router: appRouter, createContext },
})

const port = Number(process.env.PORT ?? 4000)

server.listen({ port }, (err) => {
  if (err) {
    server.log.error(err)
    process.exit(1)
  }
})
