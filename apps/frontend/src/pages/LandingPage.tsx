import { Link } from 'react-router-dom'
import { trpc } from '../lib/trpc'
import LastDecksStrip from '../components/deck/LastDecksStrip'
import TrendingCommanders from '../components/deck/TrendingCommanders'

export default function LandingPage() {
  const me = trpc.auth.me.useQuery()
  const trending = trpc.card.trendingCommanders.useQuery({ limit: 1 })
  const heroArt = trending.data?.[0]?.imageUris?.art_crop

  const ctaHref = me.data ? '/decks?new=1' : '/register'

  return (
    <div>
      <section className="relative flex min-h-[34rem] items-center overflow-hidden border-b border-forge-border">
        <div className="absolute inset-0">
          {heroArt && (
            <img src={heroArt} alt="" className="h-full w-full scale-110 object-cover opacity-25 blur-[2px]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-forge-bg via-forge-bg/85 to-forge-bg/50" />
          <div className="absolute inset-0 bg-gradient-to-r from-forge-bg via-forge-bg/20 to-transparent" />
        </div>

        <div className="relative mx-auto max-w-6xl px-6 py-20">
          <p className="animate-rise-in text-xs font-semibold uppercase tracking-[0.3em] text-forge-ember">
            Commander deck builder
          </p>
          <h1
            className="animate-rise-in mt-4 max-w-3xl font-display text-6xl uppercase leading-[0.95] tracking-tight text-forge-text sm:text-7xl"
            style={{ animationDelay: '80ms' }}
          >
            Forge your <span className="text-forge-ember">commander</span> deck
          </h1>
          <p
            className="animate-rise-in mt-6 max-w-lg text-base text-forge-text-muted"
            style={{ animationDelay: '160ms' }}
          >
            Pick a commander, drag cards into your own blocks, and search the full card pool with real
            Scryfall-style syntax. No spreadsheets, no clutter.
          </p>
          <Link
            to={ctaHref}
            className="animate-rise-in mt-8 inline-block border border-forge-ember bg-forge-ember px-8 py-3 text-sm font-semibold uppercase tracking-wide text-forge-bg transition-colors hover:bg-forge-ember-dark hover:border-forge-ember-dark"
            style={{ animationDelay: '240ms' }}
          >
            Start building
          </Link>
        </div>
      </section>

      {me.data && <LastDecksStrip />}
      <TrendingCommanders />
    </div>
  )
}
