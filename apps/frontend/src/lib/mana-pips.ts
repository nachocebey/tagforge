import { parseManaSymbols } from './mana-symbols'
import type { ColorLetter } from './colors'

const WUBRG: readonly ColorLetter[] = ['W', 'U', 'B', 'R', 'G']

function emptyColorRecord(): Record<ColorLetter, number> {
  return { W: 0, U: 0, B: 0, R: 0, G: 0 }
}

// Which WUBRG colors a single mana symbol counts toward. A true hybrid
// ({W/U}) counts toward both halves — either color's sources can cast it,
// so both sides "see" it as a requirement. A Phyrexian/generic-hybrid
// symbol ({W/P}, {2/W}, {C/W}) counts only toward its one real color: the
// alternative (life, or 2 generic) isn't a color requirement at all.
function symbolColors(symbol: string): ColorLetter[] {
  const inner = symbol.slice(1, -1)
  return inner.split('/').filter((part): part is ColorLetter => (WUBRG as string[]).includes(part))
}

export interface ManaPipStats {
  // Total colored-pip count across every card's mana cost, per color — the
  // raw "how much of this color does the deck want" figure.
  totalPips: Record<ColorLetter, number>
  // Count of cards with 2+ pips of the same color in their own cost (e.g.
  // {U}{U}) — the figure that actually stresses a mana base, since one card
  // needing double-blue demands far more blue sources than two separate
  // cards each needing a single blue pip. Moxfield's own panel splits this
  // out for the same reason.
  doublePipCards: Record<ColorLetter, number>
}

export function analyzeManaPips(manaCosts: (string | null | undefined)[]): ManaPipStats {
  const totalPips = emptyColorRecord()
  const doublePipCards = emptyColorRecord()

  for (const manaCost of manaCosts) {
    const perCard = emptyColorRecord()
    for (const symbol of parseManaSymbols(manaCost ?? null)) {
      for (const color of symbolColors(symbol)) perCard[color]++
    }
    for (const color of WUBRG) {
      totalPips[color] += perCard[color]
      if (perCard[color] >= 2) doublePipCards[color]++
    }
  }

  return { totalPips, doublePipCards }
}

// How many of the given cards can produce each color, per Scryfall's own
// `produced_mana` (lands, mana rocks, dorks, etc. all carry it — plain
// spells simply have an empty array).
export function countManaSources(producedManaByCard: (string[] | undefined)[]): Record<ColorLetter, number> {
  const sources = emptyColorRecord()
  for (const produced of producedManaByCard) {
    for (const color of WUBRG) {
      if (produced?.includes(color)) sources[color]++
    }
  }
  return sources
}
