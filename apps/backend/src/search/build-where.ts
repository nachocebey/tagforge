import type { Prisma, PrismaClient } from '@prisma/client'
import type { QueryClause } from './query-parser.js'
import { BASIC_LAND_NAMES } from './basic-lands.js'

const ALL_COLORS = ['W', 'U', 'B', 'R', 'G']

function parseColorLetters(value: string): string[] {
  const letters = new Set<string>()
  for (const ch of value.toUpperCase()) {
    if (ALL_COLORS.includes(ch)) letters.add(ch)
  }
  return [...letters]
}

function complementOf(colors: string[]): string[] {
  return ALL_COLORS.filter((c) => !colors.includes(c))
}

interface BuildWhereOptions {
  // undefined = no commander chosen yet (e.g. the commander picker itself),
  // so no identity constraint applies. [] means a real colorless commander.
  commanderColorIdentity?: string[]
  excludeOracleIds: string[]
}

export async function buildCardSearchWhere(
  prisma: PrismaClient,
  clauses: QueryClause[],
  options: BuildWhereOptions,
): Promise<Prisma.CardWhereInput> {
  const and: Prisma.CardWhereInput[] = []

  // Positive (non-negated) bare/quoted text is joined into a single phrase
  // rather than AND'd word-by-word — "sol ring" should look for that
  // substring, not (contains "sol") AND (contains "ring"), which also
  // matches unrelated cards through words like "during" or "spring".
  // Negated words keep independent exclusion semantics.
  const positiveTextWords: string[] = []

  for (const clause of clauses) {
    if (clause.kind === 'text' && !clause.negate) {
      if (clause.value) positiveTextWords.push(clause.value)
      continue
    }
    const condition = await clauseToWhere(prisma, clause)
    if (!condition) continue
    and.push(clause.negate ? { NOT: condition } : condition)
  }

  if (positiveTextWords.length > 0) {
    // Bare/quoted text matches by NAME only. Rules text is its own search
    // mode via o:/oracle: — matching it here too means a common word like
    // "plains" (which shows up in tons of fetch-effect oracle text) drowns
    // out the actual card named Plains.
    and.push({ name: { contains: positiveTextWords.join(' '), mode: 'insensitive' } })
  }

  if (options.commanderColorIdentity) {
    // Every color in the card's identity must be within the commander's.
    and.push({ NOT: { colorIdentity: { hasSome: complementOf(options.commanderColorIdentity) } } })
  }

  if (options.excludeOracleIds.length > 0) {
    // Singleton rule: cards already in the deck are excluded from results,
    // except the 6 basic lands.
    and.push({
      OR: [{ name: { in: BASIC_LAND_NAMES } }, { NOT: { oracleId: { in: options.excludeOracleIds } } }],
    })
  }

  return { AND: and }
}

async function clauseToWhere(prisma: PrismaClient, clause: QueryClause): Promise<Prisma.CardWhereInput | null> {
  // Only reached for negated text clauses — positive bare/quoted text is
  // pre-collected into one phrase by the caller. Name-only, matching that.
  if (clause.kind === 'text') {
    if (!clause.value) return null
    return { name: { contains: clause.value, mode: 'insensitive' } }
  }

  const { field, comparator, value } = clause
  if (!value) return null

  switch (field) {
    case 't':
    case 'type':
      return { typeLine: { contains: value, mode: 'insensitive' } }

    case 'o':
    case 'oracle':
      return { oracleText: { contains: value, mode: 'insensitive' } }

    case 'c':
    case 'color': {
      const letters = parseColorLetters(value)
      if (comparator === '<=') return { NOT: { colors: { hasSome: complementOf(letters) } } }
      return { colors: { hasEvery: letters } }
    }

    case 'id':
    case 'identity': {
      const letters = parseColorLetters(value)
      if (comparator === '<=') return { NOT: { colorIdentity: { hasSome: complementOf(letters) } } }
      return { colorIdentity: { hasEvery: letters } }
    }

    case 'cmc':
    case 'mv': {
      const num = Number(value)
      if (Number.isNaN(num)) return null
      switch (comparator) {
        case '>':
          return { cmc: { gt: num } }
        case '>=':
          return { cmc: { gte: num } }
        case '<':
          return { cmc: { lt: num } }
        case '<=':
          return { cmc: { lte: num } }
        case '!=':
          return { cmc: { not: num } }
        default:
          return { cmc: num }
      }
    }

    case 'is':
      switch (value.toLowerCase()) {
        case 'commander':
          return { canBeCommander: true }
        case 'background':
          return { isBackground: true }
        case 'partner':
          return { hasPartner: true }
        default:
          return null
      }

    case 'tag': {
      const tagIds = await resolveTagAndDescendants(prisma, value)
      if (tagIds.length === 0) return { oracleId: { in: [] } }
      return { taggings: { some: { tagId: { in: tagIds } } } }
    }

    default:
      // Unknown field: degrade to a literal text match instead of erroring
      // on a typo'd operator.
      return { name: { contains: `${field}${comparator}${value}`, mode: 'insensitive' } }
  }
}

// Tags nest via parent/child ids; the bulk file only has direct taggings, so
// matching a parent category (e.g. "removal") means walking child_ids and
// unioning every descendant tag's taggings.
async function resolveTagAndDescendants(prisma: PrismaClient, slug: string): Promise<string[]> {
  const root = await prisma.tag.findFirst({ where: { slug } })
  if (!root) return []

  const collected = new Set<string>([root.id])
  let frontier = root.childIds

  while (frontier.length > 0) {
    const newIds = frontier.filter((id) => !collected.has(id))
    if (newIds.length === 0) break
    for (const id of newIds) collected.add(id)

    const children = await prisma.tag.findMany({
      where: { id: { in: newIds } },
      select: { childIds: true },
    })
    frontier = children.flatMap((c) => c.childIds)
  }

  return [...collected]
}
