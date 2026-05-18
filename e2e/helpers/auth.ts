import type { APIRequestContext, Page } from '@playwright/test'

// UI login helper (fills form, submits, waits for app to load)
export async function loginViaUi(page: Page, username: string, password: string): Promise<void> {
  await page.goto('/')
  await page.getByTestId('login-username').fill(username)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
  // wait for app shell or session list to appear
  await page
    .waitForSelector('[data-testid="new-conversation"], [data-testid="session-list"]', { timeout: 5000 })
    .catch(() => {})
}

// HTTP API admin login — returns the auth token
export async function loginViaApi(request: APIRequestContext, username: string, password: string): Promise<string> {
  const resp = await request.post('/api/login', { data: { password, username } })
  const session = (await resp.json()) as { token: string }
  return session.token
}
