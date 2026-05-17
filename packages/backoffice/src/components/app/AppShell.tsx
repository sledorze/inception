import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router'
import { Button } from '@app/design-system/button'
import { cn } from '@app/design-system/utils'

interface Props {
  children: ReactNode
  onLogout: () => void
}

const NAV = [
  { label: 'Observability', to: '/observability' },
  { label: 'Governance', to: '/governance' },
  { label: 'Dev tools', to: '/devtools' },
  { label: 'Config', to: '/config' },
] as const

const navBase =
  'inline-flex items-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 h-9 px-3 w-auto sm:w-full sm:justify-start'
const navActive = 'bg-muted text-foreground font-semibold sm:border-l-2 sm:border-ring'
const navInactive = 'hover:bg-accent hover:text-accent-foreground'

export function AppShell({ children, onLogout }: Props) {
  const location = useLocation()
  const mainRef = useRef<HTMLElement>(null)

  useEffect(() => {
    mainRef.current?.focus({ preventScroll: true })
  }, [location.pathname])

  return (
    <div className="flex h-screen flex-col bg-background text-foreground sm:flex-row">
      <a
        className="fixed left-2 top-2 z-50 -translate-y-16 rounded bg-card px-3 py-2 text-sm ring-2 ring-ring transition-transform focus:translate-y-0"
        href="#main"
      >
        Skip to content
      </a>
      <aside className="flex shrink-0 flex-col border-b border-border sm:h-screen sm:w-56 sm:border-b-0 sm:border-r">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-base font-semibold sm:text-lg">Georges Back-office</h1>
          <Button data-testid="logout" onClick={onLogout} size="sm" type="button" variant="ghost">
            Sign out
          </Button>
        </div>
        <nav
          aria-label="Sections"
          className="flex gap-1 overflow-x-auto px-2 pb-2 sm:flex-col sm:overflow-visible sm:py-1"
        >
          {NAV.map(s => (
            <NavLink key={s.to} to={s.to} className={({ isActive }) => cn(navBase, isActive ? navActive : navInactive)}>
              {s.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-8" id="main" ref={mainRef} tabIndex={-1}>
        <div className="mx-auto max-w-5xl space-y-4">{children}</div>
      </main>
    </div>
  )
}
