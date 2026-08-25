import { useMemo, useState } from 'react'
import { hypergeometricAtLeast, hypergeometricBuckets } from '../../lib/hypergeometric'
import { HAND_CATEGORIES, DEFAULT_THRESHOLD, classifyCard, type HandCategory } from '../../lib/hand-categories'
import { TrashIcon } from './icons'
import type { CardResult } from '../../lib/trpc-types'

const HAND_SIZES = [7, 6, 5] as const

interface HandProbabilityRowProps {
  // Every card in the deck's body, one entry per copy (so a stack of 5
  // Forests counts 5 toward Lands) — commander(s) and Considering excluded.
  deckOracleIds: string[]
  cardsById: Map<string, CardResult>
}

// Self-contained: owns its own hand-size and category-override state,
// reads only card data the page already fetched. Deliberately isolated
// (see hypergeometric.ts) so it can be removed without touching anything
// else if it turns out not to be worth the row it takes up.
export default function HandProbabilityRow({ deckOracleIds, cardsById }: HandProbabilityRowProps) {
  const [handSize, setHandSize] = useState<(typeof HAND_SIZES)[number]>(7)
  const [expanded, setExpanded] = useState<HandCategory | null>(null)
  const [overrides, setOverrides] = useState<Map<string, HandCategory>>(new Map())

  const deckSize = deckOracleIds.length

  const categoryOf = (oracleId: string): HandCategory => {
    const override = overrides.get(oracleId)
    if (override) return override
    const card = cardsById.get(oracleId)
    return card ? classifyCard(card) : 'Other'
  }

  const { counts, membersByCategory } = useMemo(() => {
    const counts = new Map<HandCategory, number>(HAND_CATEGORIES.map((c) => [c, 0]))
    // Deduped by oracle_id — a x5 basic land stack shows once in the
    // reassignment list (an override applies to every copy at once anyway).
    const seen = new Map<HandCategory, Set<string>>(HAND_CATEGORIES.map((c) => [c, new Set()]))
    for (const oracleId of deckOracleIds) {
      const category = categoryOf(oracleId)
      counts.set(category, (counts.get(category) ?? 0) + 1)
      seen.get(category)?.add(oracleId)
    }
    const membersByCategory = new Map<HandCategory, string[]>(
      HAND_CATEGORIES.map((c) => [c, [...(seen.get(c) ?? [])]]),
    )
    return { counts, membersByCategory }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckOracleIds, cardsById, overrides])

  if (deckSize === 0) return null

  function setOverride(oracleId: string, category: HandCategory) {
    setOverrides((prev) => new Map(prev).set(oracleId, category))
  }

  return (
    <div className="mt-6">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-forge-text-muted">Opening hand probability</p>
        <div className="flex items-center gap-1">
          <span className="mr-1 text-xs text-forge-text-muted">Hand size</span>
          {HAND_SIZES.map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => setHandSize(size)}
              className={`h-6 w-6 border text-xs ${
                handSize === size
                  ? 'border-forge-ember text-forge-ember'
                  : 'border-forge-border text-forge-text-muted hover:border-forge-ember hover:text-forge-ember'
              }`}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {HAND_CATEGORIES.map((category) => {
          const count = counts.get(category) ?? 0
          const threshold = DEFAULT_THRESHOLD[category] ?? 1
          const pAtLeastThreshold = hypergeometricAtLeast(deckSize, count, handSize, threshold)
          const isExpanded = expanded === category

          return (
            <div key={category} className="w-48 border border-forge-border bg-forge-surface">
              <button
                type="button"
                onClick={() => setExpanded(isExpanded ? null : category)}
                aria-expanded={isExpanded}
                className="flex w-full flex-col gap-1 px-3 py-2.5 text-left hover:bg-forge-surface-hover"
              >
                <span className="text-xs uppercase tracking-wide text-forge-text-muted">
                  {category} · {count}
                </span>
                <span className="font-display text-2xl text-forge-ember">
                  {Math.round(pAtLeastThreshold * 100)}%
                </span>
                <span className="text-[11px] text-forge-text-muted">chance of {threshold}+ in opening hand</span>
              </button>

              {isExpanded && (
                <div className="border-t border-forge-border p-3">
                  <ul className="space-y-1 text-xs text-forge-text-muted">
                    {hypergeometricBuckets(deckSize, count, handSize, 3).map((p, i) => (
                      <li key={i} className="flex items-center justify-between">
                        <span>{i < 3 ? `${i} in hand` : `${i}+ in hand`}</span>
                        <span className="text-forge-text">{(p * 100).toFixed(1)}%</span>
                      </li>
                    ))}
                  </ul>

                  {count > 0 && (
                    <div className="mt-3 max-h-40 space-y-1 overflow-y-auto border-t border-forge-border pr-2 pt-2">
                      {(membersByCategory.get(category) ?? []).map((oracleId) => {
                        const card = cardsById.get(oracleId)
                        return (
                          <div key={oracleId} className="flex items-center justify-between gap-2">
                            <span className="truncate text-xs text-forge-text">{card?.name ?? oracleId}</span>
                            <div className="flex shrink-0 items-center gap-1">
                              <select
                                value={category}
                                onChange={(e) => setOverride(oracleId, e.target.value as HandCategory)}
                                className="border border-forge-border bg-forge-bg px-1 py-0.5 text-[11px] text-forge-text-muted outline-none focus:border-forge-ember"
                              >
                                {HAND_CATEGORIES.map((c) => (
                                  <option key={c} value={c}>
                                    {c}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => setOverride(oracleId, 'Other')}
                                aria-label={`Remove ${card?.name ?? oracleId} from ${category}`}
                                title="Remove from this category"
                                className="text-forge-text-muted hover:text-red-400"
                              >
                                <TrashIcon className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
