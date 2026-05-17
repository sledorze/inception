import { Navigate, NavLink, useParams } from 'react-router'
import { cn } from '@app/design-system/utils'
import { CallCapability } from './CallCapability.tsx'
import { ListTools } from './ListTools.tsx'
import { ReadWorkspace } from './ReadWorkspace.tsx'
import { WriteWorkspace } from './WriteWorkspace.tsx'

const TOOLS = {
  call: { El: CallCapability, label: 'call-tool' },
  list: { El: ListTools, label: 'list-tools' },
  read: { El: ReadWorkspace, label: 'read' },
  write: { El: WriteWorkspace, label: 'write' },
} as const

const navBase =
  'inline-flex items-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 h-9 px-3'
const navActive = 'bg-secondary text-secondary-foreground'
const navInactive = 'hover:bg-accent hover:text-accent-foreground'

export function DevToolsSection() {
  const { tool } = useParams()

  if (tool === undefined || !(tool in TOOLS)) {
    return <Navigate replace to="/devtools/call" />
  }

  const { El } = TOOLS[tool as keyof typeof TOOLS]

  return (
    <div className="space-y-4">
      <nav aria-label="Dev tools" className="flex gap-1 overflow-x-auto">
        {(Object.keys(TOOLS) as Array<keyof typeof TOOLS>).map(k => (
          <NavLink
            className={({ isActive }) => cn(navBase, isActive ? navActive : navInactive)}
            key={k}
            to={`/devtools/${k}`}
          >
            {TOOLS[k].label}
          </NavLink>
        ))}
      </nav>
      <El />
    </div>
  )
}
