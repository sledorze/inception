import { Navigate, NavLink, Route, Routes, useLocation } from 'react-router'
import { Button } from '@app/design-system/button'
import { cn, navLinkClass } from '@app/design-system/utils'
import { Conversation } from './Conversation.tsx'
import { ConversationEmpty } from './ConversationEmpty.tsx'
import { SessionList } from './SessionList.tsx'

const NAV = [{ label: 'Conversations', to: '/' }] as const

export function Shell({ onLogout }: { onLogout: () => void }) {
  const onDetail = useLocation().pathname.startsWith('/sessions/')
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
        <Button data-testid="logout" onClick={onLogout} size="sm" type="button" variant="ghost">
          Sign out
        </Button>
      </header>
      <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
        <nav
          aria-label="Sections"
          className={cn(
            'shrink-0 gap-1 overflow-x-auto border-b border-border px-2 py-2 sm:flex sm:w-44 sm:flex-col sm:overflow-visible sm:border-b-0 sm:border-r',
            onDetail ? 'hidden sm:flex' : 'flex',
          )}
        >
          {NAV.map(s => (
            <NavLink key={s.to} to={s.to} className={({ isActive }) => navLinkClass(isActive)}>
              {s.label}
            </NavLink>
          ))}
        </nav>
        <div
          className={cn(
            'min-h-0 flex-col sm:flex sm:w-72 sm:flex-none sm:border-r sm:border-border',
            onDetail ? 'hidden sm:flex' : 'flex flex-1',
          )}
        >
          <SessionList />
        </div>
        <main className={cn('min-h-0 flex-1 flex-col sm:flex', onDetail ? 'flex' : 'hidden sm:flex')} id="main">
          <Routes>
            <Route element={<ConversationEmpty />} path="/" />
            <Route element={<Conversation />} path="/sessions/:sessionId" />
            <Route element={<Navigate replace to="/" />} path="*" />
          </Routes>
        </main>
      </div>
    </div>
  )
}
