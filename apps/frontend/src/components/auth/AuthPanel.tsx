import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { trpc } from '../../lib/trpc'

interface AuthPanelProps {
  initialMode: 'login' | 'register'
}

export default function AuthPanel({ initialMode }: AuthPanelProps) {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const utils = trpc.useUtils()

  const onSuccess = () => {
    utils.auth.me.invalidate()
    navigate('/')
  }

  const login = trpc.auth.login.useMutation({ onSuccess, onError: (err) => setError(err.message) })
  const register = trpc.auth.register.useMutation({ onSuccess, onError: (err) => setError(err.message) })

  const pending = login.isPending || register.isPending

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (mode === 'login') login.mutate({ email, password })
    else register.mutate({ email, password })
  }

  return (
    <div className="mx-auto mt-20 max-w-sm border border-forge-border bg-forge-surface p-8">
      <h1 className="font-display text-2xl uppercase tracking-wide text-forge-text">
        {mode === 'login' ? 'Log in' : 'Register'}
      </h1>
      <p className="mt-1 text-sm text-forge-text-muted">
        {mode === 'login' ? (
          <>
            New here?{' '}
            <button type="button" onClick={() => setMode('register')} className="text-forge-ember hover:underline">
              Create an account
            </button>
          </>
        ) : (
          <>
            Already have one?{' '}
            <button type="button" onClick={() => setMode('login')} className="text-forge-ember hover:underline">
              Log in
            </button>
          </>
        )}
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-3">
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-forge-border bg-forge-bg px-3 py-2 text-sm text-forge-text outline-none focus:border-forge-ember"
        />
        <input
          type="password"
          required
          minLength={8}
          placeholder="Password (min. 8 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-forge-border bg-forge-bg px-3 py-2 text-sm text-forge-text outline-none focus:border-forge-ember"
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="w-full border border-forge-ember bg-forge-ember px-3 py-2.5 text-sm font-semibold uppercase tracking-wide text-forge-bg transition-colors hover:bg-forge-ember-dark hover:border-forge-ember-dark disabled:opacity-50"
        >
          {mode === 'login' ? 'Log in' : 'Create account'}
        </button>
      </form>
    </div>
  )
}
