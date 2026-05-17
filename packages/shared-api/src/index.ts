const TOKEN_KEY = 'auth_token'

export const handleErr = (res: Response): Promise<Response> => {
  if (!res.ok) {
    if (res.status === 401) {
      clearToken()
      globalThis.dispatchEvent(new CustomEvent('auth:expired'))
    }
    return res.text().then(t => {
      throw new Error(`${res.status}: ${t}`)
    })
  }
  return Promise.resolve(res)
}

export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY)
export const setToken = (t: string): void => {
  localStorage.setItem(TOKEN_KEY, t)
}
export const clearToken = (): void => {
  localStorage.removeItem(TOKEN_KEY)
}

export const login = (username: string, password: string): Promise<{ token: string }> =>
  fetch('/api/login', {
    body: JSON.stringify({ password, username }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })
    .then(handleErr)
    .then(res => res.json() as Promise<{ token: string }>)

export const authedFetch = (url: string, init: RequestInit = {}): Promise<Response> => {
  const token = getToken()
  const headers = new Headers(init.headers as HeadersInit | undefined)
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  if (token !== null) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  return fetch(url, { ...init, headers })
}

export const getJson = <T>(url: string, init: RequestInit = {}): Promise<T> =>
  authedFetch(url, init)
    .then(handleErr)
    .then(res => res.json() as Promise<T>)
