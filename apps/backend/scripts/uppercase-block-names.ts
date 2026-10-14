// One-off backfill: block names are now always upper-cased on write (see
// deck/structure.ts), but that only covers new writes going forward —
// this uppercases every block name already sitting in the DB from before
// that change. Safe to re-run; a deck whose names are already upper-case
// is left untouched.
import 'dotenv/config'
import { prisma } from '../src/db.js'

// Read the raw JSONB directly, not through deckStructureSchema — that
// schema's `name` field now transforms to upper-case on parse, which would
// make every deck look "already upper-case" and defeat the changed-check
// below before it ever compares against the real stored value.
interface RawBlock {
  name: string
  [key: string]: unknown
}
interface RawStructure {
  blocks: RawBlock[]
}

async function main() {
  const decks = await prisma.deck.findMany({ select: { id: true, structure: true } })
  let updated = 0

  for (const deck of decks) {
    const structure = deck.structure as unknown as RawStructure
    let changed = false
    const blocks = structure.blocks.map((block) => {
      const upper = block.name.toUpperCase()
      if (upper === block.name) return block
      changed = true
      return { ...block, name: upper }
    })

    if (!changed) continue
    await prisma.deck.update({ where: { id: deck.id }, data: { structure: { blocks } } })
    updated++
  }

  console.log(`Checked ${decks.length} deck(s), upper-cased block names in ${updated}.`)
}

main()
  .catch((err) => {
    console.error('Backfill failed:', err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
