import type { ReactNode } from 'react'
import Header from './layout/Header'

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen bg-forge-bg text-forge-text">
      <div className="bg-grain pointer-events-none fixed inset-0 z-0 opacity-[0.04] mix-blend-overlay" />
      <div className="relative z-10 flex min-h-screen flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-forge-border px-6 py-4 text-center text-xs text-forge-text-muted">
          Card data and images provided by Scryfall
        </footer>
      </div>
    </div>
  )
}
