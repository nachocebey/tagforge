// EDHREC's own URL convention for a commander page: lowercase, apostrophes
// dropped entirely (not hyphenated), everything else non-alphanumeric
// collapsed to a single hyphen. Verified live against several commanders,
// including ones with apostrophes ("K'rrik, Son of Yawgmoth" ->
// "krrik-son-of-yawgmoth") and titles ("Emiel the Blessed").
//
// Only meaningful for a single commander — partner/background pairs get
// their own combined EDHREC slug that this doesn't attempt to derive.
export function commanderNameToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/'/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
