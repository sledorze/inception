import { useState } from 'react'
import { clearToken, getToken } from './api/auth.ts'
import { Login } from './components/app/Login.tsx'
import { Conversation } from './components/app/Conversation.tsx'
import { SubmitGoal } from './components/app/SubmitGoal.tsx'
import { Button } from '@app/design-system/button'

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
    <div className="mx-auto max-w-2xl space-y-4 p-4 sm:p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Georges</h1>
        <Button data-testid="logout" onClick={handleLogout} size="sm" type="button" variant="ghost">
          Sign out
        </Button>
      </div>
      <Conversation />
      <SubmitGoal />
    </div>
  )
}
