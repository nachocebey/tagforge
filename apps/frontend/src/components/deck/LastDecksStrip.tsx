import { Link } from 'react-router-dom'
import { trpc } from '../../lib/trpc'

export default function LastDecksStrip() {
  const decks = trpc.deck.list.useQuery()
  const recent = decks.data?.slice(0, 8) ?? []
  const allCommanderIds = recent.flatMap((d) => d.commanderOracleIds)

  const commanders = trpc.card.byOracleIds.useQuery(
    { oracleIds: allCommanderIds },
    { enabled: allCommanderIds.length > 0 },
  )
  const cardById = new Map((commanders.data ?? []).map((c) => [c.oracleId, c]))

  if (decks.isLoading || recent.length === 0) return null

  return (
    <section className="mx-auto max-w-6xl px-6 pt-16">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-2xl uppercase tracking-wide text-forge-text">Your last decks</h2>
        <Link to="/decks" className="text-xs uppercase tracking-wide text-forge-text-muted hover:text-forge-ember">
          View all
        </Link>
      </div>
      <div className="no-scrollbar mt-6 flex gap-4 overflow-x-auto pb-2">
        {recent.map((deck, i) => {
          const commanderCard = cardById.get(deck.commanderOracleIds[0])
          const art = commanderCard?.imageUris?.art_crop
          return (
            <Link
              key={deck.id}
              to={`/decks/${deck.id}`}
              style={{ animationDelay: `${i * 60}ms` }}
              className="animate-rise-in group relative h-40 w-64 shrink-0 overflow-hidden border border-forge-border bg-forge-surface"
            >
              {art && (
                <img
                  src={art}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover opacity-30 transition-opacity duration-300 group-hover:opacity-50"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-forge-bg via-forge-bg/60 to-forge-bg/20" />
              <div className="absolute inset-x-0 bottom-0 p-4">
                <p className="truncate font-display text-lg uppercase leading-tight text-forge-text">{deck.name}</p>
                <p className="mt-1 truncate text-xs uppercase tracking-wide text-forge-text-muted">
                  {commanderCard?.name ?? 'Loading...'}
                </p>
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
