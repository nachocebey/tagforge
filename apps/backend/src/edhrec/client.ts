import { commanderNameToSlug } from './slug.js'

// Everything in this file is tied to EDHREC's actual page structure — an
// unofficial, undocumented surface with no stability guarantee. If EDHREC
// changes their markup or the shape of __NEXT_DATA__, this is the only
// file that should need touching; recommendations.ts (the public
// interface the rest of the app depends on) doesn't know any of this.

const USER_AGENT = 'Mozilla/5.0 (compatible; TagforgeDeckBuilder/0.1)'
const NEXT_DATA_RE = /<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s

export interface EdhrecCardEntry {
  name: string
  synergy: number
  num_decks: number
  potential_decks: number
}

interface EdhrecCardlist {
  tag: string
  cardviews: EdhrecCardEntry[]
}

// Raw fetch + __NEXT_DATA__ scrape of a commander's EDHREC page. Returns
// null on absolutely anything going wrong (network error, 404, unexpected
// page shape) — callers treat "no data" and "EDHREC is having a bad day"
// identically, since there's nothing actionable to do differently either
// way for a nice-to-have recommendations panel.
export async function fetchCommanderCardlists(commanderName: string): Promise<EdhrecCardlist[] | null> {
  const slug = commanderNameToSlug(commanderName)
  if (!slug) return null

  try {
    const res = await fetch(`https://edhrec.com/commanders/${slug}`, {
      headers: { 'User-Agent': USER_AGENT },
    })
    if (!res.ok) return null

    const html = await res.text()
    const match = html.match(NEXT_DATA_RE)
    if (!match) return null

    const nextData = JSON.parse(match[1])
    const cardlists = nextData?.props?.pageProps?.data?.container?.json_dict?.cardlists
    if (!Array.isArray(cardlists)) return null

    return cardlists
  } catch {
    return null
  }
}
