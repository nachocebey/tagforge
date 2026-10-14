import { useState, type ReactNode } from 'react'

interface CollapsiblePanelProps {
  title: string
  // Small italic note next to the title (e.g. "drag a card into any block").
  subtitle?: string
  // Right-aligned, e.g. an attribution badge like "via EDHREC".
  trailing?: ReactNode
  defaultCollapsed?: boolean
  children: ReactNode
}

// Shared shell for the build screen's collapsible info panels
// (Recommendations, Mana Base, Opening Hand, ...) — same dashed-border card
// with a chevron + title header, so the pattern doesn't get re-implemented
// (and drift) every time a new one is added. Content layout is entirely up
// to the caller; this only owns the collapse toggle and the header row.
export default function CollapsiblePanel({
  title,
  subtitle,
  trailing,
  defaultCollapsed = false,
  children,
}: CollapsiblePanelProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)

  return (
    <div className="flex w-full flex-col border border-dashed border-forge-border bg-forge-surface">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
        className="flex items-center gap-2 border-b border-forge-border px-3 py-2 text-left hover:bg-forge-surface-hover"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          className={`h-4 w-4 shrink-0 text-forge-text-muted transition-transform ${collapsed ? '-rotate-90' : ''}`}
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="font-display text-base uppercase tracking-wide text-forge-text">{title}</span>
        {subtitle && <span className="ml-2 text-xs italic text-forge-text-muted">{subtitle}</span>}
        {trailing && <span className="ml-auto text-[11px] text-forge-text-muted">{trailing}</span>}
      </button>

      {!collapsed && children}
    </div>
  )
}
