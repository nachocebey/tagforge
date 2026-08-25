// Mirrors apps/backend/src/search/basic-lands.ts — the 6 basics are exempt
// from the singleton rule, so importing "10 Forest" should add 10 copies
// instead of being clamped to 1 like every other card.
export const BASIC_LAND_NAMES = ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest', 'Wastes']
