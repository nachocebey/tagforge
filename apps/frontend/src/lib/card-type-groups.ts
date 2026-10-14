import type { CardResult } from './trpc-types'

// A single "primary" type per card (unlike the deck build page's type
// counter, which counts a multi-typed card toward every type it has) —
// used to group Considering's card list into type sections. First match
// wins, so an "Artifact Creature" groups under Creature, not Artifact.
export const TYPE_GROUPS = [
  'Creature',
  'Planeswalker',
  'Battle',
  'Instant',
  'Sorcery',
  'Artifact',
  'Enchantment',
  'Land',
  'Other',
] as const

export type TypeGroup = (typeof TYPE_GROUPS)[number]

export const TYPE_GROUP_LABELS: Record<TypeGroup, string> = {
  Creature: 'Creatures',
  Planeswalker: 'Planeswalkers',
  Battle: 'Battles',
  Instant: 'Instants',
  Sorcery: 'Sorceries',
  Artifact: 'Artifacts',
  Enchantment: 'Enchantments',
  Land: 'Lands',
  Other: 'Other',
}

export function typeGroupOf(card: Pick<CardResult, 'typeLine'>): TypeGroup {
  for (const group of TYPE_GROUPS) {
    if (group !== 'Other' && card.typeLine.includes(group)) return group
  }
  return 'Other'
}
