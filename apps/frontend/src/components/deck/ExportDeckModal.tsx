import { useMemo, useState } from 'react'
import { formatDecklist } from '../../lib/decklist-format'
import type { CardResult, DeckBlock } from '../../lib/trpc-types'
import { CloseIcon } from './icons'

interface ExportDeckModalProps {
  onClose: () => void
  deckName: string
  blocks: DeckBlock[]
  cardsById: Map<string, CardResult>
  commanders: CardResult[]
  hasConsidering: boolean
}

export default function ExportDeckModal({
  onClose,
  deckName,
  blocks,
  cardsById,
  commanders,
  hasConsidering,
}: ExportDeckModalProps) {
  const [copied, setCopied] = useState(false)
  const [withTags, setWithTags] = useState(false)
  const [includeConsidering, setIncludeConsidering] = useState(false)
  const [includeCommander, setIncludeCommander] = useState(false)

  const text = useMemo(
    () => formatDecklist(blocks, cardsById, commanders, { withTags, includeConsidering, includeCommander }),
    [blocks, cardsById, commanders, withTags, includeConsidering, includeCommander],
  )

  async function handleCopy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  function handleDownload() {
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${deckName.replace(/[^\w\- ]+/g, '').trim() || 'deck'}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 border border-forge-border bg-forge-surface p-6 shadow-[0_0_60px_rgba(0,0,0,0.6)]">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg uppercase tracking-wide text-forge-text">Export deck</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-forge-text-muted hover:text-forge-ember">
            <CloseIcon />
          </button>
        </div>
        <p className="mt-1 text-xs text-forge-text-muted">Plain text, Moxfield-compatible.</p>

        <div className="mt-4 flex items-center gap-4">
          <label className="flex items-center gap-1.5 text-sm text-forge-text">
            <input
              type="checkbox"
              checked={includeCommander}
              onChange={(e) => setIncludeCommander(e.target.checked)}
              className="accent-forge-ember"
            />
            Commander
          </label>
          <label className="flex items-center gap-1.5 text-sm text-forge-text">
            <input
              type="checkbox"
              checked={withTags}
              onChange={(e) => setWithTags(e.target.checked)}
              className="accent-forge-ember"
            />
            Tags
          </label>
          {hasConsidering && (
            <label className="flex items-center gap-1.5 text-sm text-forge-text">
              <input
                type="checkbox"
                checked={includeConsidering}
                onChange={(e) => setIncludeConsidering(e.target.checked)}
                className="accent-forge-ember"
              />
              Considering
            </label>
          )}
        </div>

        <textarea
          readOnly
          value={text}
          rows={12}
          onFocus={(e) => e.currentTarget.select()}
          className="mt-3 w-full resize-none border border-forge-border bg-forge-bg p-3 font-mono text-xs text-forge-text outline-none"
        />

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={handleDownload}
            className="border border-forge-border px-4 py-2 text-xs uppercase tracking-wide text-forge-text-muted hover:text-forge-text"
          >
            Download .txt
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="border border-forge-ember bg-forge-ember px-4 py-2 text-xs font-semibold uppercase tracking-wide text-forge-bg hover:bg-forge-ember-dark"
          >
            {copied ? 'Copied!' : 'Copy to clipboard'}
          </button>
        </div>
      </div>
    </>
  )
}
