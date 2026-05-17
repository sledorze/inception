import { useEffect, useState } from 'react'
import { clearToken, getToken } from './api/auth.ts'
import { Login } from './components/app/Login.tsx'
import { Conversation } from './components/app/Conversation.tsx'
import { Button } from '@app/design-system/button'

export function App() {
  const [authed, setAuthed] = useState(() => getToken() !== null)

  useEffect(() => {
    const onExpired = () => setAuthed(false)
    window.addEventListener('auth:expired', onExpired)
    return () => window.removeEventListener('auth:expired', onExpired)
  }, [])

  if (!authed) {
    return <Login onSuccess={() => setAuthed(true)} />
  }

  const handleLogout = () => {
    clearToken()
    setAuthed(false)
  }

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <a
        className="fixed left-2 top-2 z-50 -translate-y-16 rounded bg-card px-3 py-2 text-sm ring-2 ring-ring transition-transform focus:translate-y-0"
        href="#main"
      >
        Skip to conversation
      </a>
      <header className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3 sm:px-6">
        <h1 className="text-lg font-semibold">Georges</h1>
        <Button data-testid="logout" onClick={handleLogout} size="sm" type="button" variant="ghost">
          Sign out
        </Button>
      </header>
      <main className="flex min-h-0 flex-1 flex-col" id="main">
        <Conversation />
      </main>
    </div>
  )
}
