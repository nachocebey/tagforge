import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { trpc } from '../../lib/trpc'

interface ProfileMenuProps {
  email: string
}

export default function ProfileMenu({ email }: ProfileMenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const utils = trpc.useUtils()

  const logout = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.invalidate()
      navigate('/')
    },
  })

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  function go(path: string) {
    setOpen(false)
    navigate(path)
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-9 w-9 items-center justify-center border border-forge-border bg-forge-surface font-display text-sm text-forge-ember transition-colors hover:border-forge-ember"
      >
        {email.charAt(0).toUpperCase()}
      </button>

      {open && (
        <div
          role="menu"
          className="animate-rise-in absolute right-0 top-[calc(100%+0.5rem)] w-56 border border-forge-border bg-forge-surface shadow-[0_8px_30px_rgba(0,0,0,0.5)]"
        >
          <div className="border-b border-forge-border px-4 py-3">
            <p className="truncate text-xs text-forge-text-muted">{email}</p>
          </div>
          <button
            role="menuitem"
            type="button"
            onClick={() => go('/profile')}
            className="block w-full px-4 py-2.5 text-left text-sm text-forge-text hover:bg-forge-surface-hover"
          >
            Profile
          </button>
          <button
            role="menuitem"
            type="button"
            onClick={() => go('/decks')}
            className="block w-full px-4 py-2.5 text-left text-sm text-forge-text hover:bg-forge-surface-hover"
          >
            Your decks
          </button>
          <button
            role="menuitem"
            type="button"
            onClick={() => go('/decks?new=1')}
            className="block w-full px-4 py-2.5 text-left text-sm text-forge-text hover:bg-forge-surface-hover"
          >
            Create a deck
          </button>
          <button
            role="menuitem"
            type="button"
            onClick={() => logout.mutate()}
            className="block w-full border-t border-forge-border px-4 py-2.5 text-left text-sm text-forge-text-muted hover:bg-forge-surface-hover hover:text-forge-ember"
          >
            Log out
          </button>
        </div>
      )}
    </div>
  )
}
