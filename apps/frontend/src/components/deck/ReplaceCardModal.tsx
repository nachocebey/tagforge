import { useMemo, useState } from 'react'
import { trpc } from '../../lib/trpc'
import type { CardResult, CardTag } from '../../lib/trpc-types'
import ManaCost from './ManaCost'
import { CloseIcon } from './icons'

interface ReplaceCardModalProps {
  sourceOracleId: string
  // Considering's own cardOracleIds — the only pool a replacement is ever
  // drawn from, since it's the deck's "maybe" pile.
  consideringOracleIds: string[]
  cardsById: Map<string, CardResult>
  onReplace: (newOracleId: string) => void
  onClose: () => void
}

interface Match {
  card: CardResult
  sharedTags: CardTag[]
}

// Shared tags first — they're the reason two cards are being compared at
// all, so they shouldn't be buried wherever Scryfall happened to order the
// rest. Stable sort keeps the original relative order within each group.
function sortSharedFirst(tags: CardTag[], highlightIds: Set<string>): CardTag[] {
  return [...tags].sort((a, b) => Number(highlightIds.has(b.id)) - Number(highlightIds.has(a.id)))
}

function CardPreviewPane({
  label,
  card,
  tags,
  highlightTagIds,
  highlightTitle,
  emptyMessage,
}: {
  label: string
  card: CardResult | undefined
  tags: CardTag[]
  highlightTagIds: Set<string>
  highlightTitle: string
  emptyMessage: string
}) {
  return (
    <div className="w-72 shrink-0 overflow-y-auto p-4">
      <p className="mb-3 text-xs uppercase tracking-wide text-forge-text-muted">{label}</p>
      {card ? (
        <>
          {card.imageUris?.normal ? (
            <img
              src={card.imageUris.normal}
              alt={card.name}
              className="w-full rounded-lg border border-forge-border"
            />
          ) : (
            <div className="flex aspect-[5/7] w-full items-center justify-center border border-forge-border bg-forge-bg text-xs text-forge-text-muted">
              No image
            </div>
          )}
          <p className="mt-2 truncate text-sm text-forge-text">{card.name}</p>

          <p className="mt-3 text-xs uppercase tracking-wide text-forge-text-muted">Tags</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {tags.length === 0 && <span className="text-xs text-forge-text-muted">None</span>}
            {tags.map((tag) => {
              const isShared = highlightTagIds.has(tag.id)
              return (
                <span
                  key={tag.id}
                  title={tag.description ?? (isShared ? highlightTitle : undefined)}
                  className={`border px-2 py-0.5 text-[11px] ${
                    isShared
                      ? 'border-forge-ember bg-forge-ember/15 text-forge-ember'
                      : 'border-forge-border text-forge-text-muted'
                  }`}
                >
                  {tag.label}
                </span>
              )
            })}
          </div>
        </>
      ) : (
        <p className="text-sm text-forge-text-muted">{emptyMessage}</p>
      )}
    </div>
  )
}

// "Replace with...": finds cards sitting in Considering that share at least
// one Tagger tag with the card being replaced, ranked by how many tags they
// share — a quick way to swap in something functionally similar without
// leaving the build screen to search by hand. Three columns: the card being
// replaced (fixed, left), the candidate list (middle), and whichever
// candidate is hovered (right) — each preview highlights the tags it shares
// with the *other* card, so the connection reads in both directions.
export default function ReplaceCardModal({
  sourceOracleId,
  consideringOracleIds,
  cardsById,
  onReplace,
  onClose,
}: ReplaceCardModalProps) {
  const sourceCard = cardsById.get(sourceOracleId)
  const [hoveredOracleId, setHoveredOracleId] = useState<string | null>(null)
  const uniqueConsideringIds = useMemo(() => [...new Set(consideringOracleIds)], [consideringOracleIds])
  const oracleIds = useMemo(
    () => [sourceOracleId, ...uniqueConsideringIds],
    [sourceOracleId, uniqueConsideringIds],
  )

  const tagsQuery = trpc.card.tagsByOracleIds.useQuery({ oracleIds })

  const sourceTagIds = useMemo(
    () => new Set((tagsQuery.data?.[sourceOracleId] ?? []).map((t) => t.id)),
    [tagsQuery.data, sourceOracleId],
  )

  const matches = useMemo<Match[]>(() => {
    const byOracleId = tagsQuery.data
    if (!byOracleId || sourceTagIds.size === 0) return []

    const results: Match[] = []
    for (const oracleId of uniqueConsideringIds) {
      const card = cardsById.get(oracleId)
      if (!card) continue
      const sharedTags = (byOracleId[oracleId] ?? []).filter((t) => sourceTagIds.has(t.id))
      if (sharedTags.length > 0) results.push({ card, sharedTags })
    }
    return results.sort(
      (a, b) => b.sharedTags.length - a.sharedTags.length || a.card.name.localeCompare(b.card.name),
    )
  }, [tagsQuery.data, sourceTagIds, uniqueConsideringIds, cardsById])

  // Defaults to the top match so the preview pane never sits empty before
  // the user has hovered anything — same fallback CardSearchBox uses.
  const previewOracleId = hoveredOracleId ?? matches[0]?.card.oracleId ?? null
  const previewCard = previewOracleId ? cardsById.get(previewOracleId) : undefined
  const rawPreviewTags = previewOracleId ? tagsQuery.data?.[previewOracleId] ?? [] : []
  const previewTagIds = useMemo(() => new Set(rawPreviewTags.map((t) => t.id)), [rawPreviewTags])
  const previewTags = useMemo(() => sortSharedFirst(rawPreviewTags, sourceTagIds), [rawPreviewTags, sourceTagIds])

  const rawSourceTags = tagsQuery.data?.[sourceOracleId] ?? []
  const sourceTags = useMemo(() => sortSharedFirst(rawSourceTags, previewTagIds), [rawSourceTags, previewTagIds])

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60" onClick={onClose} />
      {/* Fixed height on the whole modal, not just the list — a preview
          pane's tag count varies per card, and letting it drive the modal's
          height meant the whole thing resized every time the hover target
          changed. Every column scrolls internally within this instead. */}
      <div className="fixed left-1/2 top-1/2 z-50 flex h-[34rem] w-full max-w-6xl -translate-x-1/2 -translate-y-1/2 border border-forge-border bg-forge-surface shadow-[0_0_60px_rgba(0,0,0,0.6)]">
        <CardPreviewPane
          label="Replacing"
          card={sourceCard}
          tags={sourceTags}
          highlightTagIds={previewTagIds}
          highlightTitle={`Shared with ${previewCard?.name ?? 'the hovered card'}`}
          emptyMessage="Card not found."
        />

        <div className="flex min-w-0 flex-1 flex-col border-x border-forge-border p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg uppercase tracking-wide text-forge-text">Replace with...</h2>
            <button type="button" onClick={onClose} aria-label="Close" className="text-forge-text-muted hover:text-forge-ember">
              <CloseIcon />
            </button>
          </div>
          <p className="mt-1 text-xs text-forge-text-muted">
            Cards in Considering sharing a tag with{' '}
            <span className="text-forge-text">{sourceCard?.name ?? sourceOracleId}</span>.
          </p>

          <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
            {tagsQuery.isLoading && <p className="px-1 py-4 text-sm text-forge-text-muted">Loading...</p>}

            {!tagsQuery.isLoading && matches.length === 0 && (
              <p className="px-1 py-4 text-sm text-forge-text-muted">
                No cards in Considering share a tag with this one.
              </p>
            )}

            {matches.length > 0 && (
              <ul className="divide-y divide-forge-border border border-forge-border bg-forge-bg">
                {matches.map(({ card, sharedTags }) => (
                  <li key={card.oracleId}>
                    <button
                      type="button"
                      onMouseEnter={() => setHoveredOracleId(card.oracleId)}
                      onClick={() => onReplace(card.oracleId)}
                      className={`flex w-full flex-col gap-1 px-3 py-2.5 text-left transition-colors ${
                        previewOracleId === card.oracleId ? 'bg-forge-surface-hover' : 'hover:bg-forge-surface-hover'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-2">
                          {card.manaCost && (
                            <span className="shrink-0">
                              <ManaCost cost={card.manaCost} size={14} wrap />
                            </span>
                          )}
                          <span className="truncate text-sm text-forge-text">{card.name}</span>
                        </span>
                        <span className="shrink-0 text-xs text-forge-text-muted">
                          {card.priceUsd ? `$${card.priceUsd}` : '—'}
                        </span>
                      </div>
                      <p className="truncate text-[11px] text-forge-text-muted">
                        Shared: {sharedTags.map((t) => t.label).join(', ')}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <CardPreviewPane
          label="Preview"
          card={previewCard}
          tags={previewTags}
          highlightTagIds={sourceTagIds}
          highlightTitle={`Shared with ${sourceCard?.name ?? 'the card being replaced'}`}
          emptyMessage="Hover a card to preview it here."
        />
      </div>
    </>
  )
}
