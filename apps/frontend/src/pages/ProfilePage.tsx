import { trpc } from '../lib/trpc'

export default function ProfilePage() {
  const me = trpc.auth.me.useQuery()

  if (me.isLoading) return null
  if (!me.data) return <p className="px-6 py-8 text-sm text-forge-text-muted">You need to log in.</p>

  return (
    <div className="mx-auto max-w-xl px-6 py-16">
      <h1 className="font-display text-3xl uppercase tracking-wide text-forge-text">Profile</h1>
      <div className="mt-6 border border-forge-border bg-forge-surface p-6">
        <p className="text-xs uppercase tracking-wide text-forge-text-muted">Email</p>
        <p className="mt-1 text-sm text-forge-text">{me.data.email}</p>
      </div>
    </div>
  )
}
