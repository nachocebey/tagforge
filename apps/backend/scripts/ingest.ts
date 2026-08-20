import 'dotenv/config'
import { prisma } from '../src/db.js'
import { ingestAll } from '../src/ingest/run.js'

const start = Date.now()

ingestAll(prisma)
  .then((result) => {
    const seconds = ((Date.now() - start) / 1000).toFixed(1)
    console.log(`Done in ${seconds}s`, result)
  })
  .catch((err) => {
    console.error('Ingestion failed:', err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
