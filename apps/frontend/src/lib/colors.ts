export type ColorLetter = 'W' | 'U' | 'B' | 'R' | 'G'

export const COLOR_LABEL: Record<ColorLetter, string> = {
  W: 'White',
  U: 'Blue',
  B: 'Black',
  R: 'Red',
  G: 'Green',
}

// Shared WUBRG swatch mapping — was duplicated verbatim between
// CommanderHeader and CardSearchBox, which risked the two drifting apart
// on a future palette tweak.
export const COLOR_DOT: Record<ColorLetter, string> = {
  W: 'bg-[#f8f2d4]',
  U: 'bg-[#3b8fd6]',
  B: 'bg-[#8b7ba3]',
  R: 'bg-[#e06a4a]',
  G: 'bg-[#4f9e6e]',
}
