import { manaSymbolSvgUrl } from '../../lib/mana-symbols'

const SYMBOL_SPLIT_RE = /(\{[^}]+\})/g
const SYMBOL_RE = /^\{[^}]+\}$/

// Renders oracle text with inline mana/tap/etc. symbols instead of literal
// "{T}"/"{W}" tokens. Relies on the parent keeping `whitespace-pre-line` (or
// similar) so the raw "\n" characters still embedded in the plain-text
// pieces below produce real line breaks.
export default function OracleText({ text, size = 14 }: { text: string | null; size?: number }) {
  if (!text) return null

  return (
    <>
      {text.split(SYMBOL_SPLIT_RE).map((part, i) => {
        const url = SYMBOL_RE.test(part) ? manaSymbolSvgUrl(part) : null
        return url ? (
          <img
            key={i}
            src={url}
            alt={part}
            width={size}
            height={size}
            className="mx-px mb-0.5 inline-block align-middle"
          />
        ) : (
          <span key={i}>{part}</span>
        )
      })}
    </>
  )
}
