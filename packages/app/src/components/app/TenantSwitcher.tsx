import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useAtomRefresh, useAtomSet, useAtomValue } from '@effect/atom-react'
import { Button } from '@app/design-system/button'
import { Input } from '@app/design-system/input'
import { cn } from '@app/design-system/utils'
import { switchTenant } from '../../hooks/auth.ts'
import {
  createTenantAtom,
  createTenantView,
  currentTenantAtom,
  renameTenantAtom,
  tenantsAtom,
  tenantsView,
} from '../../atoms.ts'

const toSlug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

export function TenantSwitcher() {
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameName, setRenameName] = useState('')

  const navigate = useNavigate()
  const currentTenantId = useAtomValue(currentTenantAtom)
  const tenantsResult = useAtomValue(tenantsView)
  const refreshTenants = useAtomRefresh(tenantsAtom)
  const dispatchCreate = useAtomSet(createTenantAtom)
  const createState = useAtomValue(createTenantView)
  const dispatchRename = useAtomSet(renameTenantAtom)

  const tenants = tenantsResult._tag === 'Ready' ? tenantsResult.value : []
  const currentName = tenants.find(t => t.id === currentTenantId)?.name ?? currentTenantId

  const handleSwitch = (tenantId: string) => {
    switchTenant(tenantId)
    setOpen(false)
    navigate('/')
  }

  const handleCreate = () => {
    const slug = toSlug(newName)
    if (!slug || !newName.trim()) {
      return
    }
    dispatchCreate({ id: slug, name: newName.trim() })
    setNewName('')
    setCreating(false)
  }

  const handleRename = (id: string) => {
    if (!renameName.trim()) {
      return
    }
    dispatchRename({ id, name: renameName.trim() })
    setRenamingId(null)
    setRenameName('')
  }

  return (
    <div className="relative">
      <Button
        data-testid="tenant-switcher-trigger"
        disabled={tenantsResult._tag === 'Loading' && !tenantsResult.waiting}
        onClick={() => setOpen(v => !v)}
        size="sm"
        type="button"
        variant="ghost"
      >
        {tenantsResult._tag === 'Loading' && !tenantsResult.waiting ? 'Loading projects…' : currentName}
      </Button>
      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-1 min-w-48 rounded-md border border-border bg-card p-1 shadow-md"
          data-testid="tenant-switcher-dropdown"
        >
          {tenantsResult._tag === 'Loading' && (
            <p className="px-2 py-1 text-sm text-muted-foreground">Loading projects…</p>
          )}
          {tenantsResult._tag === 'Error' && (
            <div className="flex flex-col gap-1 p-1">
              <p className="text-sm text-destructive">Failed to load projects</p>
              <Button data-testid="tenants-retry" onClick={refreshTenants} size="sm" type="button" variant="ghost">
                Retry
              </Button>
            </div>
          )}
          {tenants.map(t => (
            <div className="flex items-center gap-1" key={t.id}>
              {renamingId === t.id ?
                <>
                  <Input
                    autoFocus
                    className="h-7 flex-1 text-sm"
                    data-testid={`rename-input-${t.id}`}
                    onChange={e => setRenameName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        handleRename(t.id)
                      }
                      if (e.key === 'Escape') {
                        setRenamingId(null)
                        setRenameName('')
                      }
                    }}
                    value={renameName}
                  />
                  <Button
                    data-testid={`rename-save-${t.id}`}
                    onClick={() => handleRename(t.id)}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    Save
                  </Button>
                  <Button
                    onClick={() => {
                      setRenamingId(null)
                      setRenameName('')
                    }}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    ✕
                  </Button>
                </>
              : <>
                  <Button
                    className={cn(
                      'h-auto flex-1 justify-start px-2 py-1 text-left text-sm font-normal',
                      t.id === currentTenantId && 'font-semibold',
                    )}
                    data-testid={`tenant-option-${t.id}`}
                    onClick={() => handleSwitch(t.id)}
                    type="button"
                    variant="ghost"
                  >
                    {t.name}
                  </Button>
                  <Button
                    aria-label={`Rename ${t.name}`}
                    data-testid={`rename-trigger-${t.id}`}
                    onClick={() => {
                      setRenamingId(t.id)
                      setRenameName(t.name)
                    }}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    ✎
                  </Button>
                </>
              }
            </div>
          ))}
          <div className="mt-1 border-t border-border pt-1">
            {creating ?
              <div className="flex flex-col gap-1 p-1">
                <Input
                  autoFocus
                  className="h-7 text-sm"
                  data-testid="new-tenant-name"
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      handleCreate()
                    }
                    if (e.key === 'Escape') {
                      setCreating(false)
                    }
                  }}
                  placeholder="Project name"
                  value={newName}
                />
                <div className="flex gap-1">
                  <Button
                    className="flex-1"
                    data-testid="create-tenant-confirm"
                    disabled={!newName.trim() || createState.waiting}
                    onClick={handleCreate}
                    size="sm"
                    type="button"
                  >
                    {createState.waiting ? 'Creating…' : 'Create'}
                  </Button>
                  <Button
                    onClick={() => {
                      setCreating(false)
                      setNewName('')
                    }}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    ✕
                  </Button>
                </div>
              </div>
            : <Button
                className="h-auto w-full justify-start px-2 py-1 text-sm text-muted-foreground"
                data-testid="new-tenant-button"
                onClick={() => setCreating(true)}
                type="button"
                variant="ghost"
              >
                + New project
              </Button>
            }
          </div>
        </div>
      )}
    </div>
  )
}
