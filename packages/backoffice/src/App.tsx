import { useState } from 'react'
import { clearToken, getToken } from './api/auth.ts'
import { Login } from './components/app/Login.tsx'
import { Metrics } from './components/app/Metrics.tsx'
import { PainBoard } from './components/app/PainBoard.tsx'
import { WorkBoard } from './components/app/WorkBoard.tsx'
import { Proposals } from './components/app/Proposals.tsx'
import { CallCapability } from './components/app/CallCapability.tsx'
import { ListTools } from './components/app/ListTools.tsx'
import { ReadWorkspace } from './components/app/ReadWorkspace.tsx'
import { WriteWorkspace } from './components/app/WriteWorkspace.tsx'
import { Button } from '@/components/ui/button'

export function App() {
  const [authed, setAuthed] = useState(() => getToken() !== null)

  if (!authed) {
    return <Login onSuccess={() => setAuthed(true)} />
  }

  const handleLogout = () => {
    clearToken()
    setAuthed(false)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 sm:p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Georges Back-office</h1>
        <Button data-testid="logout" onClick={handleLogout} size="sm" type="button" variant="ghost">
          Sign out
        </Button>
      </div>
      <Metrics />
      <PainBoard />
      <WorkBoard />
      <Proposals />
      <CallCapability />
      <ListTools />
      <ReadWorkspace />
      <WriteWorkspace />
    </div>
  )
}
