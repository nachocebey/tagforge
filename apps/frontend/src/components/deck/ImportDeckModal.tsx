import { useState } from 'react'
import { trpc } from '../../lib/trpc'
import { parseDecklist } from '../../lib/decklist-format'
import { BASIC_LAND_NAMES } from '../../lib/basic-lands'
import { CloseIcon } from './icons'

interface ImportDeckModalProps {
  onClose: () => void
  existingOracleIds: string[]
  onImport: (sections: { name: string; cardOracleIds: string[] }[]) => void
}

const COMMANDER_SECTION_NAMES = new Set(['commander', 'commanders'])

export default function ImportDeckModal({ onClose, existingOracleIds, onImport }: ImportDeckModalProps) {
  const [text, setText] = useState('')
  const [importing, setImporting] = useState(false)
  const [report, setReport] = useState<{ added: number; notFound: string[]; skipped: number } | null>(null)
  const utils = trpc.useUtils()

  async function handleImport() {
    setImporting(true)
    setReport(null)

    const sections = parseDecklist(text).filter((s) => !COMMANDER_SECTION_NAMES.has(s.name.toLowerCase()))
    const allNames = [...new Set(sections.flatMap((s) => s.entries.map((e) => e.name)))]

    const resolved = allNames.length > 0 ? await utils.client.card.resolveByNames.query({ names: allNames }) : []
    const cardByName = new Map(resolved.map((r) => [r.queriedName.toLowerCase(), r.card]))

    const seen = new Set(existingOracleIds)
    const notFound: string[] = []
    let added = 0
    let skipped = 0

    const built = sections.map((section) => {
      const cardOracleIds: string[] = []
      for (const entry of section.entries) {
        const card = cardByName.get(entry.name.toLowerCase())
        if (!card) {
          notFound.push(entry.name)
          continue
        }
        const isBasic = BASIC_LAND_NAMES.includes(card.name)
        const copies = isBasic ? entry.qty : 1
        for (let i = 0; i < copies; i++) {
          if (!isBasic && seen.has(card.oracleId)) {
            skipped++
            continue
          }
          seen.add(card.oracleId)
          cardOracleIds.push(card.oracleId)
          added++
        }
      }
      return { name: section.name, cardOracleIds }
    })

    onImport(built.filter((b) => b.cardOracleIds.length > 0))
    setReport({ added, notFound: [...new Set(notFound)], skipped })
    setImporting(false)
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 border border-forge-border bg-forge-surface p-6 shadow-[0_0_60px_rgba(0,0,0,0.6)]">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg uppercase tracking-wide text-forge-text">Import deck</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-forge-text-muted hover:text-forge-ember">
            <CloseIcon />
          </button>
        </div>
        <p className="mt-1 text-xs text-forge-text-muted">
          Paste a plain-text decklist ("1 Sol Ring" per line). Blank lines starting a new section become blocks; a
          "Commander" section is skipped since your commander is already set.
        </p>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={12}
          placeholder={'Ramp\n1 Sol Ring\n1 Arcane Signet\n\nRemoval\n1 Swords to Plowshares'}
          className="mt-3 w-full resize-none border border-forge-border bg-forge-bg p-3 font-mono text-xs text-forge-text outline-none focus:border-forge-ember"
        />

        {report && (
          <div className="mt-3 text-xs text-forge-text-muted">
            <p>
              Added <span className="text-forge-ember">{report.added}</span> card
              {report.added === 1 ? '' : 's'}
              {report.skipped > 0 && ` (${report.skipped} already in deck, skipped)`}.
            </p>
            {report.notFound.length > 0 && (
              <p className="mt-1 text-red-400">Not found: {report.notFound.join(', ')}</p>
            )}
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="border border-forge-border px-4 py-2 text-xs uppercase tracking-wide text-forge-text-muted hover:text-forge-text"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={importing || !text.trim()}
            className="border border-forge-ember bg-forge-ember px-4 py-2 text-xs font-semibold uppercase tracking-wide text-forge-bg hover:bg-forge-ember-dark disabled:opacity-50"
          >
            {importing ? 'Importing...' : 'Import'}
          </button>
        </div>
      </div>
    </>
  )
}
