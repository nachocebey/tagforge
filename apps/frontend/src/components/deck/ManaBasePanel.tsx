import type { CardResult } from '../../lib/trpc-types'
import { COLOR_DOT, COLOR_LABEL, type ColorLetter } from '../../lib/colors'
import { analyzeManaPips, countManaSources } from '../../lib/mana-pips'
import CollapsiblePanel from './CollapsiblePanel'

const WUBRG: ColorLetter[] = ['W', 'U', 'B', 'R', 'G']

interface ManaBasePanelProps {
  // Commanders + every normal block's cards — same scope as DeckBuildPage's
  // other deck-wide stats (type counts, price total). Considering is
  // deliberately excluded, same reason: it isn't part of the deck yet.
  deckOracleIds: string[]
  cardsById: Map<string, CardResult>
  // Only these colors ever get a row — a Rakdos deck has no legal way to
  // need or produce green/white/blue, so showing empty rows for them is
  // just noise, not a "you're missing this color" signal.
  commanderColorIdentity: ColorLetter[]
}

function ManaColorRow({
  color,
  pips,
  doublePips,
  sources,
  pipShare,
  sourceShare,
}: {
  color: ColorLetter
  pips: number
  doublePips: number
  sources: number
  pipShare: number
  sourceShare: number
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <span
        className={`h-3 w-3 shrink-0 rounded-full ${COLOR_DOT[color]}`}
        title={COLOR_LABEL[color]}
        aria-hidden
      />
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <span className="w-14 shrink-0 text-[10px] uppercase tracking-wide text-forge-text-muted">Needs</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-forge-bg">
            <div className={`h-full ${COLOR_DOT[color]}`} style={{ width: `${pipShare}%` }} />
          </div>
          <span className="w-28 shrink-0 text-right text-xs text-forge-text-muted">
            {pips} pip{pips === 1 ? '' : 's'}
            {doublePips > 0 ? ` (${doublePips} 2+)` : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-14 shrink-0 text-[10px] uppercase tracking-wide text-forge-text-muted">Sources</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-forge-bg">
            <div className={`h-full ${COLOR_DOT[color]}`} style={{ width: `${sourceShare}%` }} />
          </div>
          <span className="w-28 shrink-0 text-right text-xs text-forge-text-muted">
            {sources} source{sources === 1 ? '' : 's'}
          </span>
        </div>
      </div>
    </div>
  )
}

// Moxfield's own mana-base analysis, adapted: "the ratio of colors of your
// cards versus the colors you can produce" — total colored pips (plus how
// many cards double up on the same color, which is what actually strains a
// mana base) against how many cards in the deck can produce each color, via
// Scryfall's `produced_mana`. Both bars are shares of their own total, so a
// color that's proportionally bigger on "Needs" than on "Sources" is under-
// supported relative to what the deck actually asks for.
export default function ManaBasePanel({ deckOracleIds, cardsById, commanderColorIdentity }: ManaBasePanelProps) {
  const cards = deckOracleIds.map((id) => cardsById.get(id)).filter((c): c is CardResult => Boolean(c))
  if (cards.length === 0) return null

  const colors = WUBRG.filter((c) => commanderColorIdentity.includes(c))
  if (colors.length === 0) return null

  const { totalPips, doublePipCards } = analyzeManaPips(cards.map((c) => c.manaCost))
  const sources = countManaSources(cards.map((c) => c.producedMana))

  const pipTotal = colors.reduce((sum, c) => sum + totalPips[c], 0) || 1
  const sourceTotal = colors.reduce((sum, c) => sum + sources[c], 0) || 1

  return (
    <CollapsiblePanel title="Mana Base" subtitle="pips needed vs. mana sources, per color">
      <div className="divide-y divide-forge-border">
        {colors.map((color) => (
          <ManaColorRow
            key={color}
            color={color}
            pips={totalPips[color]}
            doublePips={doublePipCards[color]}
            sources={sources[color]}
            pipShare={(totalPips[color] / pipTotal) * 100}
            sourceShare={(sources[color] / sourceTotal) * 100}
          />
        ))}
      </div>
    </CollapsiblePanel>
  )
}
