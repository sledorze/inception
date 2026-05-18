import { useEffect, useState } from 'react'
import { BrowserRouter } from 'react-router'
import { useAtomSet } from '@effect/atom-react'
import { clearToken, getTenantId, getToken } from './api/auth.ts'
import { Login } from './components/app/Login.tsx'
import { Shell } from './components/app/AppShell.tsx'
import { currentTenantAtom } from './atoms.ts'

export function App() {
  const [authed, setAuthed] = useState(() => getToken() !== null)
  const setCurrentTenant = useAtomSet(currentTenantAtom)

  useEffect(() => {
    const onExpired = () => setAuthed(false)
    const onTenantChanged = () => setCurrentTenant(getTenantId() ?? 'default')
    window.addEventListener('auth:expired', onExpired)
    window.addEventListener('tenant:changed', onTenantChanged)
    return () => {
      window.removeEventListener('auth:expired', onExpired)
      window.removeEventListener('tenant:changed', onTenantChanged)
    }
  }, [setCurrentTenant])

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
