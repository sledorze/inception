import { TENANT_ID_KEY, TOKEN_KEY } from './contract.ts'

export { AUTH_HEADER, TENANT_HEADER, TENANT_ID_KEY, TOKEN_KEY } from './contract.ts'
export { TestIds } from './testIds.ts'

export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY)
export const setToken = (t: string): void => {
  localStorage.setItem(TOKEN_KEY, t)
}
export const clearToken = (): void => {
  localStorage.removeItem(TOKEN_KEY)
}

export const getTenantId = (): string | null => localStorage.getItem(TENANT_ID_KEY)
export const setTenantId = (id: string): void => {
  localStorage.setItem(TENANT_ID_KEY, id)
}
export const clearTenantId = (): void => {
  localStorage.removeItem(TENANT_ID_KEY)
}

export const switchTenant = (tenantId: string): void => {
  setTenantId(tenantId)
  globalThis.dispatchEvent(new CustomEvent('tenant:changed'))
}

export const copyConversationLink = async (): Promise<void> => {
  await globalThis.navigator.clipboard.writeText(globalThis.location.href)
}

export const handleErr = (res: Response): Promise<Response> => {
  if (!res.ok) {
    if (res.status === 401) {
      clearToken()
      clearTenantId()
      globalThis.dispatchEvent(new CustomEvent('auth:expired'))
    }
    return res.text().then(t => {
      throw new Error(`${res.status}: ${t}`)
    })
  }
  return Promise.resolve(res)
}

export const login = (username: string, password: string): Promise<{ token: string; tenantIds: readonly string[] }> =>
  fetch('/api/login', {
    body: JSON.stringify({ password, username }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })
    .then(handleErr)
    .then(res => res.json() as Promise<{ token: string; tenantIds: readonly string[] }>)

export const authedFetch = (url: string, init: RequestInit = {}): Promise<Response> => {
  const token = getToken()
  const headers = new Headers(init.headers as HeadersInit | undefined)
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  if (token !== null) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  // Always include X-Tenant-Id; defaults to 'default' when no tenant is selected yet.
  headers.set('X-Tenant-Id', getTenantId() ?? 'default')
  return fetch(url, { ...init, headers })
}

export const getJson = <T>(url: string, init: RequestInit = {}): Promise<T> =>
  authedFetch(url, init)
    .then(handleErr)
    .then(res => res.json() as Promise<T>)
