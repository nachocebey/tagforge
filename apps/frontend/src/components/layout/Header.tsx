import { Link } from 'react-router-dom'
import { trpc } from '../../lib/trpc'
import ProfileMenu from './ProfileMenu'

export default function Header() {
  const me = trpc.auth.me.useQuery()

  return (
    <header className="sticky top-0 z-40 border-b border-forge-border bg-forge-bg/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link to="/" className="font-display text-2xl uppercase tracking-wider">
          <span className="text-forge-text">Tag</span>
          <span className="text-forge-ember">forge</span>
        </Link>

        <div className="flex items-center gap-3">
          {!me.isLoading &&
            (me.data ? (
              <ProfileMenu email={me.data.email} />
            ) : (
              <>
                <Link
                  to="/login"
                  className="border border-forge-border px-4 py-2 text-xs font-semibold uppercase tracking-wide text-forge-text transition-colors hover:border-forge-ember hover:text-forge-ember"
                >
                  Log in
                </Link>
                <Link
                  to="/register"
                  className="border border-forge-ember bg-forge-ember px-4 py-2 text-xs font-semibold uppercase tracking-wide text-forge-bg transition-colors hover:bg-forge-ember-dark hover:border-forge-ember-dark"
                >
                  Register
                </Link>
              </>
            ))}
        </div>
      </div>
    </header>
  )
}
