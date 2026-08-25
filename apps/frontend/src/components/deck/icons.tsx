interface IconProps {
  className?: string
}

// Replaces "&times;"/emoji glyphs, which render inconsistently (thin,
// tiny, or a completely different glyph) depending on the OS/browser font
// — an SVG stroke icon looks the same everywhere and scales cleanly.
export function CloseIcon({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} className={className}>
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  )
}

// A simple owned/not-owned toggle — not a collection-tracking icon set,
// just checked vs. unchecked, colored via the button's own text color.
export function OwnedIcon({ owned, className = 'h-4 w-4' }: IconProps & { owned: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4" fill="currentColor" fillOpacity={owned ? 0.15 : 0} />
      {owned && <path d="M7 12.5l3.2 3.2L17 9" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  )
}

// Drag handle for reordering whole blocks — the standard 6-dot grip motif.
export function GripIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <circle cx="8" cy="6" r="1.6" />
      <circle cx="8" cy="12" r="1.6" />
      <circle cx="8" cy="18" r="1.6" />
      <circle cx="16" cy="6" r="1.6" />
      <circle cx="16" cy="12" r="1.6" />
      <circle cx="16" cy="18" r="1.6" />
    </svg>
  )
}

export function TrashIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className}>
      <path
        d="M4 7h16M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7m3 0-.85 12.14A2 2 0 0 1 15.16 21H8.84a2 2 0 0 1-1.99-1.86L6 7m4 4v6m4-6v6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
