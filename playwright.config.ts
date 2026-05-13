import { defineConfig } from '@playwright/test'

export default defineConfig({
  fullyParallel: false,
  retries: 0,
  testDir: './e2e',
  use: {
    baseURL: 'http://localhost:3100',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'pnpm build:frontend && PORT=3100 node --import tsx packages/host/src/main.ts',
    reuseExistingServer: !process.env['CI'],
    timeout: 30_000,
    url: 'http://localhost:3100/health',
  },
  workers: 1,
})
