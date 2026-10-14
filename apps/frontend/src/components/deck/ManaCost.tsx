import { manaSymbolSvgUrl, parseManaSymbols } from '../../lib/mana-symbols'

interface ManaCostProps {
  cost: string | null
  size?: number
  // Lets a many-pip cost (e.g. a 6-color ultimatum) wrap onto a second
  // line inside a fixed-width slot instead of overflowing it horizontally.
  wrap?: boolean
}

export default function ManaCost({ cost, size = 16, wrap = false }: ManaCostProps) {
  const symbols = parseManaSymbols(cost)
  if (symbols.length === 0) return null

  return (
    <span className={`inline-flex items-center gap-0.5 align-middle ${wrap ? 'flex-wrap content-start' : ''}`}>
      {symbols.map((symbol, i) => {
        const url = manaSymbolSvgUrl(symbol)
        return url ? (
          <img key={i} src={url} alt={symbol} width={size} height={size} className="shrink-0" />
        ) : (
          <span key={i} className="text-xs text-forge-text-muted">
            {symbol}
          </span>
        )
      })}
    </span>
  )
}
