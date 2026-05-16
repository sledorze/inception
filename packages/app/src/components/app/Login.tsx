import { useState } from 'react'
import { Button } from '@app/design-system/button'
import { Card } from '@app/design-system/card'
import { Input } from '@app/design-system/input'
import { login, setToken } from '../../api/auth.ts'

interface LoginProps {
  onSuccess: () => void
}

export function Login({ onSuccess }: LoginProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = () => {
    if (!username.trim() || !password.trim()) {
      return
    }
    setBusy(true)
    setError(null)
    login(username, password)
      .then(({ token }) => {
        setToken(token)
        onSuccess()
      })
      .catch((err: unknown) => {
        setError(String(err))
        setBusy(false)
      })
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm space-y-4 p-6">
        <h1 className="text-xl font-bold">Georges — Sign in</h1>
        <Input
          autoComplete="username"
          data-testid="login-username"
          onChange={e => setUsername(e.target.value)}
          placeholder="Username"
          type="text"
          value={username}
        />
        <Input
          autoComplete="current-password"
          data-testid="login-password"
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          placeholder="Password"
          type="password"
          value={password}
        />
        <Button className="w-full" data-testid="login-submit" disabled={busy} onClick={handleSubmit} type="button">
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </Card>
    </div>
  )
}
