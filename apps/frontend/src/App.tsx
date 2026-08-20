import { trpc } from './lib/trpc'

export default function App() {
  const health = trpc.health.useQuery()

  return (
    <div className="min-h-screen flex flex-col bg-neutral-950 text-neutral-100">
      <main className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold">Commander Deck Builder</h1>
          <p className="text-neutral-400">
            Backend status: {health.isLoading ? 'checking...' : (health.data?.status ?? 'unreachable')}
          </p>
        </div>
      </main>
      <footer className="text-center text-xs text-neutral-500 py-4">
        Card data and images provided by Scryfall
      </footer>
    </div>
  )
}
