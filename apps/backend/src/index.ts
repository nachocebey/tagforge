import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify'
import { appRouter } from './router.js'

const server = Fastify()

await server.register(cors, { origin: true })
await server.register(fastifyTRPCPlugin, {
  prefix: '/trpc',
  trpcOptions: { router: appRouter },
})

const port = Number(process.env.PORT ?? 4000)

server.listen({ port }, (err) => {
  if (err) {
    server.log.error(err)
    process.exit(1)
  }
})
