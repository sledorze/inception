import { useEffect, useState } from 'react'
import { BrowserRouter } from 'react-router'
import { clearToken, getToken } from './api/auth.ts'
import { Login } from './components/app/Login.tsx'
import { Shell } from './components/app/AppShell.tsx'

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
    <BrowserRouter>
      <Shell onLogout={handleLogout} />
    </BrowserRouter>
  )
}
