import { useState, type MouseEvent, type ReactNode } from 'react'
import { trpc } from '../../lib/trpc'

const IMAGE_WIDTH = 224 // matches the w-56 image below
const TAG_COLUMN_WIDTH = 144 // matches the w-36 tag column
const TAG_COLUMN_GAP = 8 // gap-2
// ~ Scryfall's card aspect ratio at IMAGE_WIDTH — approximate, not measured.
// Tags sit beside the image now, not below it, so they no longer add height.
const PREVIEW_HEIGHT = 320
const CURSOR_OFFSET = 18

interface HoverCardPreviewProps {
  image: string | undefined
  oracleId?: string
  disabled?: boolean
  children: ReactNode
}

// Moxfield-style: hovering a card row floats its full image (plus its
// Tagger tags) near the cursor, above everything else. `fixed` positioning
// (not a portal) is enough here since nothing in this app puts a transform
// on an ancestor, which is the one thing that would break fixed
// positioning's escape from overflow/clipping.
export default function HoverCardPreview({ image, oracleId, disabled, children }: HoverCardPreviewProps) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const showPreview = Boolean(pos) && !disabled
  const tags = trpc.card.tags.useQuery(
    { oracleId: oracleId ?? '' },
    { enabled: Boolean(oracleId) && showPreview },
  )

  function updatePosition(e: MouseEvent) {
    if (!image || disabled) return
    setPos({ x: e.clientX, y: e.clientY })
  }

  if (!image) return <>{children}</>

  const hasTags = Boolean(oracleId) && Boolean(tags.data) && (tags.data?.length ?? 0) > 0
  const previewWidth = IMAGE_WIDTH + (hasTags ? TAG_COLUMN_GAP + TAG_COLUMN_WIDTH : 0)

  const left =
    showPreview && pos && pos.x + CURSOR_OFFSET + previewWidth > window.innerWidth
      ? pos.x - CURSOR_OFFSET - previewWidth
      : (pos?.x ?? 0) + CURSOR_OFFSET
  // Rather than clamping `top` to a guessed height (which still clips the
  // tag chips when a card has more of them than expected), flip to
  // anchoring from the bottom once there's not enough room below the
  // cursor — the box then grows upward from that point, so it never
  // overflows the viewport regardless of how tall the tag list turns out.
  const flipUp = showPreview && pos && pos.y + CURSOR_OFFSET + PREVIEW_HEIGHT > window.innerHeight
  const verticalStyle =
    showPreview && pos
      ? flipUp
        ? { bottom: window.innerHeight - pos.y + CURSOR_OFFSET }
        : { top: pos.y + CURSOR_OFFSET }
      : {}

  return (
    <div
      className="flex min-w-0 flex-1"
      onMouseEnter={updatePosition}
      onMouseMove={updatePosition}
      onMouseLeave={() => setPos(null)}
    >
      {children}
      {showPreview && (
        <div className="pointer-events-none fixed z-[100] flex items-start gap-2" style={{ left, ...verticalStyle }}>
          <img
            src={image}
            alt=""
            className="w-56 shrink-0 rounded-lg border border-forge-border shadow-[0_16px_50px_rgba(0,0,0,0.7)]"
          />
          {hasTags && (
            <div className="flex w-36 shrink-0 flex-wrap content-start gap-1.5 rounded-lg border border-forge-border bg-forge-surface p-2.5 shadow-[0_16px_50px_rgba(0,0,0,0.7)]">
              {tags.data!.map((tag) => (
                // Shown as the literal `tag:<slug>` search token, not the
                // display label — this is what you'd type in the search box.
                <span
                  key={tag.id}
                  className="rounded border border-forge-ember/50 bg-forge-ember/15 px-2 py-1 text-xs font-medium text-forge-text"
                >
                  {tag.slug}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
