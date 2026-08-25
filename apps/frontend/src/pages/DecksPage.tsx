import { Link } from 'react-router-dom'
import { trpc } from '../lib/trpc'
import DeckList from '../components/deck/DeckList'

export default function DecksPage() {
  const me = trpc.auth.me.useQuery()

  if (me.isLoading) return null

  if (!me.data) {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <p className="text-sm text-forge-text-muted">
          <Link to="/login" className="text-forge-ember hover:underline">
            Log in
          </Link>{' '}
          to see your decks.
        </p>
      </div>
    )
  }

  return <DeckList />
}
