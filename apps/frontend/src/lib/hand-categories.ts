import type { CardResult } from './trpc-types'

// Isolated on purpose — see hypergeometric.ts. Classification is a text
// heuristic against type_line/oracle_text (no live Scryfall Tagger tags):
// tags would need a new batch backend endpoint (fetching per-card would
// mean one request per deck card), which trades this feature's isolation
// for a small accuracy gain the heuristic already gets close enough to.

// 'Other' stays a valid classification (the fallback for anything that
// doesn't match) but isn't a chip on its own — HAND_CATEGORIES (what's
// actually rendered/countable) deliberately excludes it.
export type HandCategory = 'Lands' | 'Ramp' | 'Removal' | 'Draw' | 'Other'

export const HAND_CATEGORIES: HandCategory[] = ['Lands', 'Ramp', 'Removal', 'Draw']

// The headline number on each chip is "P(>= this many)" — Lands defaults
// to 3+ (whether you're on track to hit land drops matters more than just
// having any land at all); everything else defaults to 1+.
export const DEFAULT_THRESHOLD: Partial<Record<HandCategory, number>> = { Lands: 3 }

// Checked in this order — the first match wins, so a card matching more
// than one pattern (rare) lands in whichever category is listed first.
const RAMP_RE = /\badd\s*(\{|one mana|\d+ mana)|search your library for a[n]? (?:basic )?land|create[s]? .*treasure/i
const REMOVAL_RE =
  /destroy target|exile target|deals? \d+ damage to target|-\d+\/-\d+ to target|target creature gets? -\d+\/-\d+|return target creature .* to (?:its|their) owner's hand|fight/i
const DRAW_RE = /draw (a|an additional|\d+|two|three) cards?/i

export function classifyCard(card: Pick<CardResult, 'typeLine' | 'oracleText'>): HandCategory {
  if (card.typeLine.includes('Land')) return 'Lands'
  const text = card.oracleText ?? ''
  if (RAMP_RE.test(text)) return 'Ramp'
  if (REMOVAL_RE.test(text)) return 'Removal'
  if (DRAW_RE.test(text)) return 'Draw'
  return 'Other'
}
