import { getBulkDataEntry, streamJsonl } from './bulk-data.js'
import type { ScryfallCard } from './scryfall-types.js'

// oracle_cards (what ingestCards otherwise reads from) gives one Scryfall-
// chosen "canonical" printing per oracle_id — usually the most recent
// release, which for a freshly-reprinted card can be priced way above its
// cheapest widely-available printing (verified live: Night's Whisper's
// canonical printing was $5.37 from a brand-new set, vs. ~$0.30 for its
// cheapest real printing). default_cards has every printing, so scanning
// it for the minimum non-foil `usd` per oracle_id gives the actual
// cheapest-to-acquire price instead.
export async function buildCheapestPriceMap(): Promise<Map<string, string>> {
  const entry = await getBulkDataEntry('default_cards')
  console.log(`Downloading default_cards (updated ${entry.updated_at}) to compute cheapest price per card...`)

  const cheapest = new Map<string, number>()
  let scanned = 0

  for await (const raw of streamJsonl(entry.jsonl_download_uri)) {
    const card = raw as ScryfallCard
    scanned++
    if (!card.oracle_id) continue

    const usd = card.prices?.usd
    if (!usd) continue
    const price = Number(usd)
    if (!Number.isFinite(price)) continue

    const current = cheapest.get(card.oracle_id)
    if (current === undefined || price < current) cheapest.set(card.oracle_id, price)

    if (scanned % 50000 === 0) console.log(`  ...scanned ${scanned} printings`)
  }

  console.log(`Cheapest-price map built: ${cheapest.size} cards priced, out of ${scanned} printings scanned.`)
  // Prisma's Decimal input accepts a string — toFixed(2) matches the
  // "12.34" format Scryfall's own price strings already use.
  return new Map([...cheapest].map(([oracleId, price]) => [oracleId, price.toFixed(2)]))
}
