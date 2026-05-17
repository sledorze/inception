import { useState } from 'react'
import { Button } from '@app/design-system/button'
import { Card } from '@app/design-system/card'
import { Input } from '@app/design-system/input'
import { login, setToken } from '../../hooks/auth.ts'

interface LoginProps {
  onSuccess: () => void
}

export function Login({ onSuccess }: LoginProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!username.trim() || !password.trim()) {
      return
    }
    setBusy(true)
    setError(null)
    try {
      const { token } = await login(username, password)
      setToken(token)
      onSuccess()
    } catch (err: unknown) {
      setError(String(err))
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm p-6">
        <form
          className="space-y-4"
          onSubmit={e => {
            e.preventDefault()
            handleSubmit()
          }}
        >
          <h1 className="text-xl font-bold tracking-tight">Georges — Sign in</h1>
          <div className="space-y-1">
            <label
              className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
              htmlFor="login-username"
            >
              Username
            </label>
            <Input
              autoComplete="username"
              data-testid="login-username"
              id="login-username"
              onChange={e => setUsername(e.target.value)}
              placeholder="Username"
              type="text"
              value={username}
            />
          </div>
          <div className="space-y-1">
            <label
              className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
              htmlFor="login-password"
            >
              Password
            </label>
            <Input
              autoComplete="current-password"
              data-testid="login-password"
              id="login-password"
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
              type="password"
              value={password}
            />
          </div>
          <Button className="w-full" data-testid="login-submit" disabled={busy} type="submit">
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
          {error && (
            <p aria-live="polite" className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </form>
      </Card>
    </div>
  )
}
