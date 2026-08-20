import { Readable } from 'node:stream'
import { createGunzip } from 'node:zlib'
import { createInterface } from 'node:readline'
import type { BulkDataEntry } from './scryfall-types.js'

// Scryfall requires a descriptive User-Agent + Accept header on every
// request; requests without them get an opaque 403. See
// https://scryfall.com/docs/api
const SCRYFALL_HEADERS = {
  'User-Agent': 'CommanderDeckBuilder/0.1 (dev ingestion script)',
  Accept: 'application/json',
}

export async function fetchBulkDataIndex(): Promise<BulkDataEntry[]> {
  const res = await fetch('https://api.scryfall.com/bulk-data', { headers: SCRYFALL_HEADERS })
  if (!res.ok) {
    throw new Error(`Scryfall bulk-data index request failed: ${res.status} ${res.statusText}`)
  }
  const body = (await res.json()) as { data: BulkDataEntry[] }
  return body.data
}

export async function getBulkDataEntry(type: string): Promise<BulkDataEntry> {
  const entries = await fetchBulkDataIndex()
  const entry = entries.find((e) => e.type === type)
  if (!entry) {
    throw new Error(`No Scryfall bulk-data entry found for type "${type}"`)
  }
  return entry
}

// Streams a Scryfall bulk file (gzip-compressed JSON Lines) without buffering
// the whole download or the whole parsed array in memory at once.
export async function* streamJsonl(url: string): AsyncGenerator<unknown> {
  const res = await fetch(url, { headers: SCRYFALL_HEADERS })
  if (!res.ok || !res.body) {
    throw new Error(`Failed to download ${url}: ${res.status} ${res.statusText}`)
  }

  const nodeStream = Readable.fromWeb(res.body as never)
  const rl = createInterface({ input: nodeStream.pipe(createGunzip()), crlfDelay: Infinity })

  for await (const line of rl) {
    if (!line.trim()) continue
    yield JSON.parse(line)
  }
}
