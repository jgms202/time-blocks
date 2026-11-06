import { useState } from 'react'
import { SupabaseClient } from '@supabase/supabase-js'
import { googleEnabled } from '../lib/cloud'

type Mode = 'signIn' | 'signUp' | 'reset'

const COPY: Record<Mode, { title: string; action: string }> = {
  signIn: { title: 'Sign in', action: 'Sign in' },
  signUp: { title: 'Create your account', action: 'Create account' },
  reset: { title: 'Reset your password', action: 'Email me a reset link' },
}

const returnUrl = () => window.location.origin + window.location.pathname

export default function SignIn({ client }: { client: SupabaseClient }) {
  const [mode, setMode] = useState<Mode>('signIn')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
    setNote(null)
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    setNote(null)
    try {
      if (mode === 'signIn') {
        const { error } = await client.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else if (mode === 'signUp') {
        const { data, error } = await client.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: returnUrl() },
        })
        if (error) throw error
        if (!data.session) setNote('Check your email for a link to confirm your account.')
      } else {
        const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: returnUrl() })
        if (error) throw error
        setNote('If that email has an account, a reset link is on its way.')
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function signInWithGoogle() {
    setError(null)
    const { error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: returnUrl() },
    })
    if (error) setError(error.message)
  }

  return (
    <div className="tb-auth-page">
      <form className="tb-auth" onSubmit={submit}>
        <h1>Time Blocks</h1>
        <p className="tb-auth-sub">{COPY[mode].title}</p>
        {googleEnabled && mode !== 'reset' && (
          <>
            <button type="button" className="tb-auth-google" onClick={signInWithGoogle}>
              Continue with Google
            </button>
            <p className="tb-auth-divider">or</p>
          </>
        )}
        <input
          className="tb-input"
          type="email"
          required
          autoComplete="email"
          placeholder="Email"
          aria-label="Email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        {mode !== 'reset' && (
          <input
            className="tb-input"
            type="password"
            required
            minLength={8}
            autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
            placeholder="Password (at least 8 characters)"
            aria-label="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        )}
        {error && (
          <p className="tb-auth-error" role="alert">
            {error}
          </p>
        )}
        {note && (
          <p className="tb-auth-note" role="status">
            {note}
          </p>
        )}
        <button className="tb-auth-primary" disabled={busy}>
          {COPY[mode].action}
        </button>
        <div className="tb-auth-links">
          <button
            type="button"
            className="tb-text-button"
            onClick={() => switchMode(mode === 'signIn' ? 'signUp' : 'signIn')}
          >
            {mode === 'signIn' ? 'Create an account' : 'Back to sign in'}
          </button>
          {mode === 'signIn' && (
            <button type="button" className="tb-text-button" onClick={() => switchMode('reset')}>
              Forgot password?
            </button>
          )}
        </div>
      </form>
    </div>
  )
}

/** Shown after following a password reset link. */
export function NewPassword({ client, onDone }: { client: SupabaseClient; onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const { error } = await client.auth.updateUser({ password })
    if (error) setError(error.message)
    else onDone()
  }

  return (
    <div className="tb-auth-page">
      <form className="tb-auth" onSubmit={submit}>
        <h1>Time Blocks</h1>
        <p className="tb-auth-sub">Choose a new password</p>
        <input
          className="tb-input"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="New password (at least 8 characters)"
          aria-label="New password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        {error && (
          <p className="tb-auth-error" role="alert">
            {error}
          </p>
        )}
        <button className="tb-auth-primary">Save password</button>
      </form>
    </div>
  )
}
