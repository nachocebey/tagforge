// Whether two chosen commanders may legally sit together in the command
// zone. Real Magic rules for Partner/Partner-with/Background are more
// textured than this (e.g. "Partner — Father & Son" variants), but this
// covers the mechanics that actually show up: plain Partner, "Partner with
// <name>", and "Choose a Background" + Background.
export interface CommanderLike {
  name: string
  canBeCommander: boolean
  isBackground: boolean
  hasPartner: boolean
  partnerWith: string | null
  choosesBackground: boolean
}

export function validateCommanderPair(
  first: CommanderLike,
  second: CommanderLike | null,
): { ok: true } | { ok: false; reason: string } {
  if (!first.canBeCommander) {
    return { ok: false, reason: `${first.name} can't be a commander.` }
  }
  if (!second) {
    return { ok: true }
  }

  const genericPartner = (c: CommanderLike) => c.hasPartner && !c.partnerWith
  const namesSpecificPartner = (c: CommanderLike, otherName: string) => c.partnerWith === otherName
  const backgroundPair =
    (first.choosesBackground && second.isBackground) || (second.choosesBackground && first.isBackground)

  const specificPartner = namesSpecificPartner(first, second.name) || namesSpecificPartner(second, first.name)
  const bothGenericPartner = genericPartner(first) && genericPartner(second)

  if (specificPartner || bothGenericPartner || backgroundPair) {
    return { ok: true }
  }

  return { ok: false, reason: `${first.name} and ${second.name} can't be paired as commanders.` }
}
