import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { clearToken, getToken } from './api/auth.ts'
import { Login } from './components/app/Login.tsx'
import { AppShell } from './components/app/AppShell.tsx'
import { ObservabilitySection } from './components/app/ObservabilitySection.tsx'
import { GovernanceSection } from './components/app/GovernanceSection.tsx'
import { DevToolsSection } from './components/app/DevToolsSection.tsx'
import { ConfigSection } from './components/app/ConfigSection.tsx'

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
      <AppShell onLogout={handleLogout}>
        <Routes>
          <Route element={<Navigate replace to="/observability" />} path="/" />
          <Route element={<ObservabilitySection />} path="/observability" />
          <Route element={<ObservabilitySection />} path="/observability/sessions/:sessionId" />
          <Route element={<GovernanceSection />} path="/governance" />
          <Route element={<GovernanceSection />} path="/governance/proposals/:contentHash" />
          <Route element={<DevToolsSection />} path="/devtools" />
          <Route element={<DevToolsSection />} path="/devtools/:tool" />
          <Route element={<ConfigSection />} path="/config" />
          <Route element={<Navigate replace to="/observability" />} path="*" />
        </Routes>
      </AppShell>
    </BrowserRouter>
  )
}
