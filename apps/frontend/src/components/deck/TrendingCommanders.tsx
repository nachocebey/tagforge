import { Link } from 'react-router-dom'
import { trpc } from '../../lib/trpc'

export default function TrendingCommanders() {
  const trending = trpc.card.trendingCommanders.useQuery({ limit: 8 })

  if (trending.isLoading) return null

  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <h2 className="font-display text-2xl uppercase tracking-wide text-forge-text">
        Commanders in the <span className="text-forge-ember">forge</span>
      </h2>
      <div className="no-scrollbar mt-6 flex gap-4 overflow-x-auto pb-2">
        {trending.data?.map((card, i) => {
          const art = card.imageUris?.art_crop
          return (
            <Link
              key={card.oracleId}
              to={`/decks?new=1&commander=${card.oracleId}`}
              style={{ animationDelay: `${i * 60}ms` }}
              className="animate-rise-in group relative h-64 w-44 shrink-0 overflow-hidden border border-forge-border bg-forge-surface"
            >
              {art && (
                <img
                  src={art}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover opacity-60 transition-all duration-300 group-hover:opacity-90 group-hover:scale-105"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-forge-bg via-forge-bg/40 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-3">
                <p className="font-display text-base uppercase leading-tight text-forge-text">{card.name}</p>
                <p className="mt-1 truncate text-[11px] uppercase tracking-wide text-forge-text-muted">
                  {card.typeLine}
                </p>
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
