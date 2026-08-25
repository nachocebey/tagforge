import type { CardResult } from '../../lib/trpc-types'
import { COLOR_DOT, COLOR_LABEL, type ColorLetter } from '../../lib/colors'

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
  const image = card.imageUris?.large ?? card.imageUris?.normal

  return (
    <div className="flex flex-col-reverse gap-6 p-6 sm:flex-row sm:items-stretch sm:gap-8">
      <div className="flex flex-1 flex-col justify-center">
        <ColorIdentity colors={card.colorIdentity} />
        <h2 className="mt-2 font-display text-3xl uppercase leading-none tracking-wide text-forge-text sm:text-4xl">
          {card.name}
        </h2>
        <p className="mt-2 text-sm uppercase tracking-wide text-forge-text-muted">{card.typeLine}</p>
        <p className="mt-4 max-w-2xl whitespace-pre-line text-sm leading-relaxed text-forge-text-muted">
          {card.oracleText}
        </p>
      </div>
      {image && (
        <img
          src={image}
          alt={card.name}
          className="h-64 w-auto self-center rounded-lg border border-forge-border shadow-[0_12px_40px_rgba(0,0,0,0.6)] sm:h-72 sm:self-auto"
        />
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
