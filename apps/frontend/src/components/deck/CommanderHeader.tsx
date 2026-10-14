import { useState } from 'react'
import { trpc } from '../../lib/trpc'
import type { CardResult } from '../../lib/trpc-types'
import { COLOR_DOT, COLOR_LABEL, type ColorLetter } from '../../lib/colors'
import { FlipIcon } from './icons'
import OracleText from './OracleText'

function ColorIdentity({ colors }: { colors: string[] }) {
  if (colors.length === 0) {
    return <span className="text-xs uppercase tracking-wide text-forge-text-muted">Colorless</span>
  }
  return (
    <div className="flex items-center gap-1.5">
      {colors.map((c) => (
        <span
          key={c}
          title={COLOR_LABEL[c as ColorLetter] ?? c}
          className={`h-3.5 w-3.5 rounded-full border border-forge-bg ${COLOR_DOT[c as ColorLetter] ?? 'bg-forge-text-muted'}`}
        />
      ))}
    </div>
  )
}

function CommanderRow({ card }: { card: CardResult }) {
  const [faceIndex, setFaceIndex] = useState(0)
  // Only transform/modal_dfc/flip layouts carry a real second face image —
  // split/adventure cards' faces share one combined card-level image.
  const faces = card.cardFaces
  const isFlippable = Boolean(faces && faces.length >= 2 && faces.every((f) => f.image_uris))
  const activeFace = isFlippable ? faces![faceIndex % faces!.length] : null
  const image = activeFace
    ? (activeFace.image_uris!.large ?? activeFace.image_uris!.normal)
    : (card.imageUris?.large ?? card.imageUris?.normal)
  const tags = trpc.card.tags.useQuery({ oracleId: card.oracleId })

  return (
    <div className="flex flex-col-reverse gap-6 p-6 sm:flex-row sm:items-stretch sm:gap-8">
      <div className="flex flex-1 flex-col justify-center">
        <ColorIdentity colors={card.colorIdentity} />
        <h2 className="mt-2 font-display text-3xl uppercase leading-none tracking-wide text-forge-text sm:text-4xl">
          {card.name}
        </h2>
        <p className="mt-2 text-sm uppercase tracking-wide text-forge-text-muted">{card.typeLine}</p>
        <p className="mt-4 max-w-2xl whitespace-pre-line text-sm leading-relaxed text-forge-text-muted">
          <OracleText text={card.oracleText} />
        </p>
        {tags.data && tags.data.length > 0 && (
          <div className="mt-4 max-w-2xl">
            <p className="text-xs uppercase tracking-wide text-forge-text-muted">Tagger tags</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {tags.data.map((tag) => (
                <span
                  key={tag.id}
                  title={tag.description ?? `Search cards tagged ${tag.label}`}
                  className="border border-forge-border px-2 py-0.5 text-[11px] text-forge-text-muted"
                >
                  {tag.label}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
      {image && (
        <div className="relative self-center sm:self-auto">
          <img
            src={image}
            alt={activeFace?.name ?? card.name}
            className="h-64 w-auto rounded-lg border border-forge-border shadow-[0_12px_40px_rgba(0,0,0,0.6)] sm:h-72"
          />
          {isFlippable && (
            <button
              type="button"
              onClick={() => setFaceIndex((i) => i + 1)}
              title="Flip to the other face"
              aria-label="Flip to the other face"
              className="absolute bottom-2 right-2 flex items-center gap-1.5 rounded-full border border-forge-border bg-forge-bg/90 px-3 py-1.5 text-xs text-forge-text shadow-[0_4px_16px_rgba(0,0,0,0.6)] hover:border-forge-ember hover:text-forge-ember"
            >
              <FlipIcon className="h-3.5 w-3.5" />
              Flip
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default function CommanderHeader({ commanders }: { commanders: CardResult[] }) {
  return (
    <div className="divide-y divide-forge-border border border-forge-border bg-forge-surface">
      {commanders.map((card) => (
        <CommanderRow key={card.oracleId} card={card} />
      ))}
    </div>
  )
}
