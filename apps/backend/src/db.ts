import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

// `max` defaults to 10 in node-postgres, which the ingestion script's
// concurrent batch upserts (see src/ingest/run.ts) can exceed and start
// timing out on. 20 gives it headroom without a real DB config in play yet.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, max: 20 })

export const prisma = new PrismaClient({ adapter })
