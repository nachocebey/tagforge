import { Prisma, type PrismaClient } from '@prisma/client'
import { getBulkDataEntry, streamJsonl } from './bulk-data.js'
import { buildCheapestPriceMap } from './prices.js'
import { runBatched } from './run-batched.js'
import { toCardRow, toTagRow, toTaggingRows } from './transform.js'
import type { ScryfallCard, ScryfallTag } from './scryfall-types.js'

const CARD_BATCH_SIZE = 200
const CARD_CONCURRENCY = 8
const TAGGING_CONCURRENCY = 16
const TRANSIENT_ERROR_RETRIES = 3

function isForeignKeyViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003'
}

function shortReason(err: unknown): string {
  // Prisma errors are multi-line formatted blocks (code frame, then the
  // actual reason as the last line); keep the log to one line per skip.
  const raw = err instanceof Error ? err.message : String(err)
  const lines = raw.trim().split('\n').filter(Boolean)
  return lines.at(-1) ?? raw
}

// A foreign-key violation (a tagging pointing at an oracle_id we
// intentionally didn't ingest) is expected and deterministic — retrying
// won't help. Anything else (e.g. the connection pool being saturated under
// this script's concurrent batches) is likely transient, so it gets a few
// short retries before being counted as a real skip.
async function safeUpsert(fn: () => Promise<unknown>, context: string): Promise<boolean> {
  for (let attempt = 0; attempt <= TRANSIENT_ERROR_RETRIES; attempt++) {
    try {
      await fn()
      return true
    } catch (err) {
      if (isForeignKeyViolation(err)) {
        console.warn(`  ! skipped ${context}: ${shortReason(err)}`)
        return false
      }
      if (attempt < TRANSIENT_ERROR_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)))
        continue
      }
      console.warn(`  ! skipped ${context} after ${TRANSIENT_ERROR_RETRIES + 1} attempts: ${shortReason(err)}`)
      return false
    }
  }
  return false
}

export async function ingestCards(prisma: PrismaClient): Promise<{ upserted: number; skipped: number }> {
  const cheapestPriceByOracleId = await buildCheapestPriceMap()

  const entry = await getBulkDataEntry('oracle_cards')
  console.log(`Downloading oracle_cards (updated ${entry.updated_at})...`)

  let upserted = 0
  let skipped = 0
  let batch: NonNullable<ReturnType<typeof toCardRow>>[] = []

  const flush = async () => {
    if (batch.length === 0) return
    const current = batch
    batch = []
    await runBatched(current, CARD_CONCURRENCY, async (row) => {
      const ok = await safeUpsert(
        () =>
          prisma.card.upsert({
            where: { oracleId: row.oracleId },
            create: row,
            update: row,
          }),
        `card ${row.oracleId} (${row.name})`,
      )
      if (ok) upserted++
      else skipped++
    })
  }

  for await (const raw of streamJsonl(entry.jsonl_download_uri)) {
    const row = toCardRow(raw as ScryfallCard)
    if (!row) continue
    // Override the canonical printing's price with the cheapest one found
    // across every printing of this card — see prices.ts for why.
    const cheapest = cheapestPriceByOracleId.get(row.oracleId)
    if (cheapest !== undefined) row.priceUsd = cheapest
    batch.push(row)
    if (batch.length >= CARD_BATCH_SIZE) {
      await flush()
      if (upserted % 2000 < CARD_BATCH_SIZE) console.log(`  ...${upserted} cards upserted`)
    }
  }
  await flush()

  console.log(`Cards done: ${upserted} upserted, ${skipped} skipped.`)
  return { upserted, skipped }
}

// Cards must be ingested first: Tagging.cardId has a foreign key into Card,
// and oracle_tags can reference oracle_ids that momentarily don't exist yet
// (or ever) in oracle_cards — those taggings are skipped, not fatal.
export async function ingestTags(
  prisma: PrismaClient,
): Promise<{ tags: number; taggings: number; taggingsSkipped: number }> {
  const entry = await getBulkDataEntry('oracle_tags')
  console.log(`Downloading oracle_tags (updated ${entry.updated_at})...`)

  let tags = 0
  let taggings = 0
  let taggingsSkipped = 0

  for await (const raw of streamJsonl(entry.jsonl_download_uri)) {
    const tag = raw as ScryfallTag
    const tagRow = toTagRow(tag)

    const ok = await safeUpsert(
      () => prisma.tag.upsert({ where: { id: tagRow.id }, create: tagRow, update: tagRow }),
      `tag ${tagRow.id} (${tagRow.slug})`,
    )
    if (!ok) continue
    tags++

    const taggingRows = toTaggingRows(tag)
    await runBatched(taggingRows, TAGGING_CONCURRENCY, async (t) => {
      const ok = await safeUpsert(
        () =>
          prisma.tagging.upsert({
            where: { tagId_cardId: { tagId: t.tagId, cardId: t.cardId } },
            create: t,
            update: t,
          }),
        `tagging ${t.tagId}/${t.cardId}`,
      )
      if (ok) taggings++
      else taggingsSkipped++
    })

    if (tags % 500 === 0) console.log(`  ...${tags} tags, ${taggings} taggings`)
  }

  console.log(`Tags done: ${tags} tags, ${taggings} taggings (${taggingsSkipped} taggings skipped).`)
  return { tags, taggings, taggingsSkipped }
}

export async function ingestAll(prisma: PrismaClient) {
  const cardResult = await ingestCards(prisma)
  const tagResult = await ingestTags(prisma)
  return { cards: cardResult, tags: tagResult }
}
