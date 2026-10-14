import { CONSIDERING_BLOCK_ID, CONSIDERING_BLOCK_NAME } from './considering'
import type { CardResult, DeckBlock } from './trpc-types'

// Double-faced cards are stored under their combined "Front // Back" name;
// decklist conventions (Moxfield, Archidekt, etc.) only ever name the front.
function displayName(card: CardResult): string {
  return card.name.includes(' // ') ? card.name.split(' // ')[0] : card.name
}

function pushCardLines(lines: string[], oracleIds: string[], cardsById: Map<string, CardResult>) {
  const counts = new Map<string, number>()
  for (const id of oracleIds) counts.set(id, (counts.get(id) ?? 0) + 1)
  for (const [oracleId, qty] of counts) {
    const card = cardsById.get(oracleId)
    lines.push(`${qty} ${card ? displayName(card) : oracleId}`)
  }
}

export interface ExportOptions {
  // true: one section per block ("tags"), matching the build screen's
  // organization. false: every non-Considering card flattened into a
  // single "Deck" section, ignoring block boundaries.
  withTags: boolean
  // Considering is normally never exported (it's a maybe-pile, not part of
  // the deck) — this adds it back as its own "Considering" section,
  // regardless of withTags, so it's never silently merged into the deck.
  includeConsidering: boolean
  // Off by default (a prior version always included it, unconditionally,
  // which the user explicitly asked to stop doing) — when on, adds the
  // commander(s) as the first line(s) of the export. No "Commander" header
  // of its own, just the card line(s) — the deck's own sections already
  // start with a blank-line separator, so this reads as its own group.
  includeCommander: boolean
}

// Plain-text, Moxfield-compatible: either one section per block or a
// single flattened "Deck" section, blank-line separated, "<qty> <name>"
// per line.
export function formatDecklist(
  blocks: DeckBlock[],
  cardsById: Map<string, CardResult>,
  commanders: CardResult[],
  options: ExportOptions,
): string {
  const lines: string[] = []

  if (options.includeCommander) {
    for (const commander of commanders) lines.push(`1 ${displayName(commander)}`)
  }

  const normalBlocks = blocks.filter((b) => b.id !== CONSIDERING_BLOCK_ID)
  const consideringBlock = blocks.find((b) => b.id === CONSIDERING_BLOCK_ID)

  if (options.withTags) {
    for (const block of normalBlocks) {
      if (block.cardOracleIds.length === 0) continue
      if (lines.length > 0) lines.push('')
      lines.push(block.name)
      pushCardLines(lines, block.cardOracleIds, cardsById)
    }
  } else {
    const allIds = normalBlocks.flatMap((b) => b.cardOracleIds)
    if (allIds.length > 0) {
      if (lines.length > 0) lines.push('')
      pushCardLines(lines, allIds, cardsById)
    }
  }

  if (options.includeConsidering && consideringBlock && consideringBlock.cardOracleIds.length > 0) {
    if (lines.length > 0) lines.push('')
    lines.push(CONSIDERING_BLOCK_NAME)
    pushCardLines(lines, consideringBlock.cardOracleIds, cardsById)
  }

  return lines.join('\n')
}

// Same "<qty> <name>" lines as a section of formatDecklist, for copying a
// single block to the clipboard on its own (no deck name/commander header).
export function formatBlock(block: DeckBlock, cardsById: Map<string, CardResult>): string {
  const lines: string[] = []
  pushCardLines(lines, block.cardOracleIds, cardsById)
  return lines.join('\n')
}

export interface ParsedDecklistEntry {
  name: string
  qty: number
}

export interface ParsedDecklistSection {
  name: string
  entries: ParsedDecklistEntry[]
}

const QTY_LINE_RE = /^(\d+)\s*x?\s+(.+)$/i
// Strips trailing set/collector info some exporters include, e.g.
// "Sol Ring (C21) 263" or "Sol Ring (C21)".
const SET_SUFFIX_RE = /\s*\([A-Za-z0-9]{2,6}\)\s*[\w-]*\s*$/

// Any line without a leading quantity starts a new named section (a block
// name); blank lines and "//" comments are ignored. Lines before the first
// header collect into a default "Imported" section.
export function parseDecklist(text: string): ParsedDecklistSection[] {
  const sections: ParsedDecklistSection[] = []
  let current: ParsedDecklistSection = { name: 'Imported', entries: [] }
  let sawHeader = false

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('//')) continue

    const match = line.match(QTY_LINE_RE)
    if (match) {
      const qty = parseInt(match[1], 10)
      const name = match[2].replace(SET_SUFFIX_RE, '').trim()
      if (name) current.entries.push({ name, qty: Number.isFinite(qty) && qty > 0 ? qty : 1 })
      continue
    }

    if (current.entries.length > 0 || sawHeader) sections.push(current)
    current = { name: line, entries: [] }
    sawHeader = true
  }
  sections.push(current)

  return sections.filter((s) => s.entries.length > 0)
}
