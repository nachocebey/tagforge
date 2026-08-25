// Verified against the live Scryfall symbology API (GET /symbology,
// filtered to appears_in_mana_costs: true — 59 symbols as of writing). The
// URL isn't a simple transform of the symbol text (e.g. "{W/U}" -> "WU.svg",
// "{B/G/P}" -> "BGP.svg"), so this is a baked lookup rather than a computed
// pattern. Static reference data — mana symbols only change a few times a
// year when new mechanics print, unlike card/tag data which needs the daily
// ingestion job.
const MANA_SYMBOL_SVG: Record<string, string> = {
  '{X}': 'https://svgs.scryfall.io/card-symbols/X.svg',
  '{Y}': 'https://svgs.scryfall.io/card-symbols/Y.svg',
  '{Z}': 'https://svgs.scryfall.io/card-symbols/Z.svg',
  '{0}': 'https://svgs.scryfall.io/card-symbols/0.svg',
  '{1}': 'https://svgs.scryfall.io/card-symbols/1.svg',
  '{2}': 'https://svgs.scryfall.io/card-symbols/2.svg',
  '{3}': 'https://svgs.scryfall.io/card-symbols/3.svg',
  '{4}': 'https://svgs.scryfall.io/card-symbols/4.svg',
  '{5}': 'https://svgs.scryfall.io/card-symbols/5.svg',
  '{6}': 'https://svgs.scryfall.io/card-symbols/6.svg',
  '{7}': 'https://svgs.scryfall.io/card-symbols/7.svg',
  '{8}': 'https://svgs.scryfall.io/card-symbols/8.svg',
  '{9}': 'https://svgs.scryfall.io/card-symbols/9.svg',
  '{10}': 'https://svgs.scryfall.io/card-symbols/10.svg',
  '{11}': 'https://svgs.scryfall.io/card-symbols/11.svg',
  '{12}': 'https://svgs.scryfall.io/card-symbols/12.svg',
  '{13}': 'https://svgs.scryfall.io/card-symbols/13.svg',
  '{14}': 'https://svgs.scryfall.io/card-symbols/14.svg',
  '{15}': 'https://svgs.scryfall.io/card-symbols/15.svg',
  '{16}': 'https://svgs.scryfall.io/card-symbols/16.svg',
  '{1000000}': 'https://svgs.scryfall.io/card-symbols/1000000.svg',
  '{W/U}': 'https://svgs.scryfall.io/card-symbols/WU.svg',
  '{W/B}': 'https://svgs.scryfall.io/card-symbols/WB.svg',
  '{B/R}': 'https://svgs.scryfall.io/card-symbols/BR.svg',
  '{B/G}': 'https://svgs.scryfall.io/card-symbols/BG.svg',
  '{U/B}': 'https://svgs.scryfall.io/card-symbols/UB.svg',
  '{U/R}': 'https://svgs.scryfall.io/card-symbols/UR.svg',
  '{R/G}': 'https://svgs.scryfall.io/card-symbols/RG.svg',
  '{R/W}': 'https://svgs.scryfall.io/card-symbols/RW.svg',
  '{G/W}': 'https://svgs.scryfall.io/card-symbols/GW.svg',
  '{G/U}': 'https://svgs.scryfall.io/card-symbols/GU.svg',
  '{G/U/P}': 'https://svgs.scryfall.io/card-symbols/GUP.svg',
  '{G/W/P}': 'https://svgs.scryfall.io/card-symbols/GWP.svg',
  '{C/W}': 'https://svgs.scryfall.io/card-symbols/CW.svg',
  '{C/U}': 'https://svgs.scryfall.io/card-symbols/CU.svg',
  '{C/B}': 'https://svgs.scryfall.io/card-symbols/CB.svg',
  '{C/R}': 'https://svgs.scryfall.io/card-symbols/CR.svg',
  '{C/G}': 'https://svgs.scryfall.io/card-symbols/CG.svg',
  '{2/W}': 'https://svgs.scryfall.io/card-symbols/2W.svg',
  '{2/U}': 'https://svgs.scryfall.io/card-symbols/2U.svg',
  '{2/B}': 'https://svgs.scryfall.io/card-symbols/2B.svg',
  '{2/R}': 'https://svgs.scryfall.io/card-symbols/2R.svg',
  '{2/G}': 'https://svgs.scryfall.io/card-symbols/2G.svg',
  '{W/P}': 'https://svgs.scryfall.io/card-symbols/WP.svg',
  '{U/P}': 'https://svgs.scryfall.io/card-symbols/UP.svg',
  '{B/P}': 'https://svgs.scryfall.io/card-symbols/BP.svg',
  '{R/P}': 'https://svgs.scryfall.io/card-symbols/RP.svg',
  '{G/P}': 'https://svgs.scryfall.io/card-symbols/GP.svg',
  '{C/P}': 'https://svgs.scryfall.io/card-symbols/CP.svg',
  '{HW}': 'https://svgs.scryfall.io/card-symbols/HW.svg',
  '{W}': 'https://svgs.scryfall.io/card-symbols/W.svg',
  '{U}': 'https://svgs.scryfall.io/card-symbols/U.svg',
  '{B}': 'https://svgs.scryfall.io/card-symbols/B.svg',
  '{R}': 'https://svgs.scryfall.io/card-symbols/R.svg',
  '{G}': 'https://svgs.scryfall.io/card-symbols/G.svg',
  '{C}': 'https://svgs.scryfall.io/card-symbols/C.svg',
  '{S}': 'https://svgs.scryfall.io/card-symbols/S.svg',
  '{L}': 'https://svgs.scryfall.io/card-symbols/L.svg',
  '{D}': 'https://svgs.scryfall.io/card-symbols/D.svg',
}

const SYMBOL_TOKEN_RE = /\{[^}]+\}/g

export function parseManaSymbols(manaCost: string | null): string[] {
  if (!manaCost) return []
  return manaCost.match(SYMBOL_TOKEN_RE) ?? []
}

export function manaSymbolSvgUrl(symbol: string): string | null {
  if (MANA_SYMBOL_SVG[symbol]) return MANA_SYMBOL_SVG[symbol]
  // Generic numeric costs above {16} aren't in the baked table but follow
  // the same "strip braces" pattern as the ones that are.
  const digits = symbol.match(/^\{(\d+)\}$/)?.[1]
  return digits ? `https://svgs.scryfall.io/card-symbols/${digits}.svg` : null
}
