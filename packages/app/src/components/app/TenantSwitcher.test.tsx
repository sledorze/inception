// @vitest-environment happy-dom
import { RegistryProvider } from '@effect/atom-react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TenantSummary } from '../../hooks/chat.ts'

const switchTenantMock = vi.fn<(id: string) => void>()

vi.mock('../../hooks/auth.ts', () => ({
  clearTenantId: vi.fn(),
  clearToken: vi.fn(),
  getTenantId: vi.fn(() => null),
  getToken: vi.fn(() => null),
  login: vi.fn(),
  setTenantId: vi.fn(),
  setToken: vi.fn(),
  switchTenant: (id: string) => switchTenantMock(id),
}))

const tenants: readonly TenantSummary[] = [
  { id: 'default', name: 'Default' },
  { id: 'acme', name: 'Acme Corp' },
]
const listTenants = vi.fn<() => Promise<readonly TenantSummary[]>>(() => Promise.resolve(tenants))
const createTenant = vi.fn<(id: string, name: string) => Promise<void>>(() => Promise.resolve())
const renameTenant = vi.fn<(id: string, name: string) => Promise<void>>(() => Promise.resolve())

vi.mock('../../hooks/chat.ts', () => ({
  createTenant: (id: string, name: string) => createTenant(id, name),
  deleteSession: vi.fn(),
  getTurns: vi.fn(() => Promise.resolve([])),
  listSessions: vi.fn(() => Promise.resolve([])),
  listTenants: () => listTenants(),
  renameTenant: (id: string, name: string) => renameTenant(id, name),
  respondToGoal: vi.fn(),
  sendMessage: vi.fn(),
}))

const { TenantSwitcher } = await import('./TenantSwitcher.tsx')

const renderSwitcher = () =>
  render(
    <RegistryProvider>
      <MemoryRouter>
        <TenantSwitcher />
      </MemoryRouter>
    </RegistryProvider>,
  )

describe('TenantSwitcher', () => {
  beforeEach(() => {
    switchTenantMock.mockClear()
    listTenants.mockClear()
    createTenant.mockClear()
    renameTenant.mockClear()
    listTenants.mockResolvedValue(tenants)
    createTenant.mockResolvedValue(undefined)
    renameTenant.mockResolvedValue(undefined)
  })

  it('shows the current tenant name on the trigger button', async () => {
    renderSwitcher()
    // currentTenantAtom initialises to 'default' (localStorage empty in happy-dom)
    // tenantsAtom loads and resolves to the mocked list; 'default' maps to 'Default'
    expect(await screen.findByTestId('tenant-switcher-trigger')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId('tenant-switcher-trigger')).toHaveTextContent('Default'))
  })

  it('opens a dropdown listing entitled tenants when trigger is clicked', async () => {
    renderSwitcher()
    await userEvent.click(await screen.findByTestId('tenant-switcher-trigger'))
    expect(screen.getByTestId('tenant-switcher-dropdown')).toBeInTheDocument()
    expect(await screen.findByTestId('tenant-option-default')).toHaveTextContent('Default')
    expect(screen.getByTestId('tenant-option-acme')).toHaveTextContent('Acme Corp')
  })

  it('calls switchTenant and closes dropdown when a tenant is selected', async () => {
    renderSwitcher()
    await userEvent.click(await screen.findByTestId('tenant-switcher-trigger'))
    await userEvent.click(await screen.findByTestId('tenant-option-acme'))
    expect(switchTenantMock).toHaveBeenCalledWith('acme')
    expect(screen.queryByTestId('tenant-switcher-dropdown')).not.toBeInTheDocument()
  })

  it('shows create form on "New project" click and dispatches createTenant on confirm', async () => {
    renderSwitcher()
    await userEvent.click(await screen.findByTestId('tenant-switcher-trigger'))
    await userEvent.click(await screen.findByTestId('new-tenant-button'))
    expect(screen.getByTestId('new-tenant-name')).toBeInTheDocument()

    await userEvent.type(screen.getByTestId('new-tenant-name'), 'Acme Two')
    await userEvent.click(screen.getByTestId('create-tenant-confirm'))

    await waitFor(() => expect(createTenant).toHaveBeenCalledWith('acme-two', 'Acme Two'))
    // form closes after create
    expect(screen.queryByTestId('new-tenant-name')).not.toBeInTheDocument()
  })

  it('shows rename input when rename trigger is clicked and calls renameTenant on save', async () => {
    renderSwitcher()
    await userEvent.click(await screen.findByTestId('tenant-switcher-trigger'))
    await userEvent.click(await screen.findByTestId('rename-trigger-acme'))
    const input = screen.getByTestId('rename-input-acme')
    expect(input).toBeInTheDocument()

    await userEvent.clear(input)
    await userEvent.type(input, 'Acme Renamed')
    await userEvent.click(screen.getByTestId('rename-save-acme'))

    await waitFor(() => expect(renameTenant).toHaveBeenCalledWith('acme', 'Acme Renamed'))
    expect(screen.queryByTestId('rename-input-acme')).not.toBeInTheDocument()
  })
})
