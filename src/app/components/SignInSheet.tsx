import { type FormEvent, useEffect, useId, useRef, useState } from 'react'

import { ApiError } from '../../client/api.ts'
import { useStoreData } from '../context.tsx'
import { useBggAccount } from '../hooks/useBggAccount.ts'
import { Sheet } from './Sheet.tsx'
import { useToast } from './Toast.tsx'

/**
 * F008 (docs/design.md "Sign in to BoardGameGeek"): BGG username and password, Cancel / Sign in. The
 * password stays in this sheet's state and the one request (never stored or logged); the sheet
 * returns to what asked for it through `onSignedIn` or `onCancel`.
 */
export function SignInSheet({ onSignedIn, onCancel }: { onSignedIn: (bggUser: string) => void; onCancel: () => void }) {
  const { signIn } = useBggAccount()
  const toast = useToast()
  const id = useId()
  const passwordRef = useRef<HTMLInputElement>(null)
  const saved = useStoreData(store => store.bggUsername())
  const [username, setUsername] = useState<string>()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (saved !== undefined) setUsername(current => current ?? saved ?? '')
  }, [saved])
  useEffect(() => {
    if (saved !== undefined && saved) passwordRef.current?.focus()
  }, [saved])
  const name = username ?? ''
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim() || !password || busy) return
    setBusy(true)
    setError(undefined)
    try {
      const bggUser = await signIn(name.trim(), password)
      setPassword('')
      toast(`Signed in to BoardGameGeek as ${bggUser}`)
      onSignedIn(bggUser)
    } catch (e) {
      setBusy(false)
      setError(
        e instanceof ApiError && e.code === 'bgg_signed_out'
          ? 'BoardGameGeek did not accept this username or password.'
          : e instanceof ApiError && e.code === 'offline'
            ? 'Signing in needs a connection.'
            : 'BoardGameGeek cannot be reached. Try again in a moment.',
      )
    }
  }
  return (
    <Sheet open title="Sign in to BoardGameGeek" onClose={onCancel}>
      <p className="hint">Your password is used once to sign in and is not kept. The sign-in stays on this device.</p>
      <form className="form" onSubmit={e => void submit(e)}>
        <div>
          <label className="label" htmlFor={`${id}-user`}>
            BGG username
          </label>
          <div className="field">
            <input
              id={`${id}-user`}
              value={name}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              onChange={e => setUsername(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="label" htmlFor={`${id}-password`}>
            Password
          </label>
          <div className="field">
            <input
              id={`${id}-password`}
              ref={passwordRef}
              type="password"
              value={password}
              autoComplete="current-password"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? `${id}-error` : undefined}
              onChange={e => setPassword(e.target.value)}
            />
          </div>
        </div>
        {error && (
          <p className="hint error" id={`${id}-error`} role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy || !name.trim() || !password}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </div>
      </form>
    </Sheet>
  )
}
