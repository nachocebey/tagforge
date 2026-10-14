import type { PrismaClient } from '@prisma/client'
import { toCardDTO, type CardDTO } from './card-dto.js'

// Exact case-insensitive match first, then a "Front // " prefix match for
// double-faced cards — an external source (a pasted decklist, EDHREC, etc.)
// almost always names only the front face, but our Card rows are keyed by
// the combined "Front // Back" name. Shared so every name->card lookup in
// the app matches the same way, rather than each caller reimplementing it.
export async function resolveCardsByNames(prisma: PrismaClient, names: string[]): Promise<Map<string, CardDTO>> {
  const uniqueNames = [...new Set(names.map((n) => n.trim()).filter(Boolean))]
  const resolved = new Map<string, CardDTO>()
  if (uniqueNames.length === 0) return resolved

  const exactMatches = await prisma.card.findMany({ where: { name: { in: uniqueNames, mode: 'insensitive' } } })
  const byLowerName = new Map(exactMatches.map((c) => [c.name.toLowerCase(), c]))

  const unresolved: string[] = []
  for (const name of uniqueNames) {
    const match = byLowerName.get(name.toLowerCase())
    if (match) resolved.set(name, toCardDTO(match))
    else unresolved.push(name)
  }

  if (unresolved.length > 0) {
    const dfcMatches = await prisma.card.findMany({
      where: { OR: unresolved.map((name) => ({ name: { startsWith: `${name} // `, mode: 'insensitive' } })) },
    })
    for (const name of unresolved) {
      const prefix = `${name.toLowerCase()} // `
      const match = dfcMatches.find((c) => c.name.toLowerCase().startsWith(prefix))
      if (match) resolved.set(name, toCardDTO(match))
    }
  }

  return resolved
}
