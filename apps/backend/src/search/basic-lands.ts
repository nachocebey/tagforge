// The 6 basic lands are exempt from the deck singleton rule and always show
// up in search regardless of how many copies are already in the deck.
// Matched by name (not oracle_id) — stable, self-documenting, and doesn't
// depend on which oracle_id Scryfall's ingestion happens to resolve.
// (5 more cards share this exception by their own oracle text — Shadowborn
// Apostle, Relentless Rats, Persistent Petitioners, Dragon's Approach,
// Rat Colony — deferred post-MVP per the project brief.)
export const BASIC_LAND_NAMES = ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest', 'Wastes']
