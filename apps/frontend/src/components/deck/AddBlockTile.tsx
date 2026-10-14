import { useState, type FormEvent } from 'react'

interface AddBlockTileProps {
  existingNames: string[]
  onCreate: (name: string) => void
}

export default function AddBlockTile({ existingNames, onCreate }: AddBlockTileProps) {
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    if (existingNames.some((n) => n.toLowerCase() === trimmed.toLowerCase())) {
      setError(`A block named "${trimmed}" already exists`)
      return
    }
    onCreate(trimmed)
    setName('')
    setError(null)
    setNaming(false)
  }

  if (naming) {
    return (
      <form
        onSubmit={handleSubmit}
        className="flex min-h-[6rem] w-full flex-col items-center justify-center gap-3 border-2 border-dashed border-forge-ember bg-forge-surface p-4"
      >
        <input
          autoFocus
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setError(null)
          }}
          onBlur={() => {
            if (!name.trim()) setNaming(false)
          }}
          placeholder="Block name..."
          className="w-full border border-forge-border bg-forge-bg px-3 py-2 text-center text-sm text-forge-text outline-none focus:border-forge-ember"
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
        <button
          type="submit"
          className="border border-forge-ember bg-forge-ember px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-forge-bg hover:bg-forge-ember-dark"
        >
          Create
        </button>
      </form>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setNaming(true)}
      className="flex min-h-[6rem] w-full flex-col items-center justify-center gap-2 border-2 border-dashed border-forge-border text-forge-text-muted transition-colors hover:border-forge-ember hover:text-forge-ember"
    >
      <span className="text-3xl leading-none">+</span>
      <span className="text-xs uppercase tracking-wide">Click here to add a block</span>
    </button>
  )
}
