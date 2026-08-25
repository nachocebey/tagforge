import { manaSymbolSvgUrl, parseManaSymbols } from '../../lib/mana-symbols'

export default function ManaCost({ cost, size = 16 }: { cost: string | null; size?: number }) {
  const symbols = parseManaSymbols(cost)
  if (symbols.length === 0) return null

  return (
    <span className="inline-flex items-center gap-0.5 align-middle">
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
