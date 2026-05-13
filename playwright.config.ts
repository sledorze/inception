import { defineConfig } from '@playwright/test'

export default defineConfig({
  fullyParallel: false,
  retries: 0,
  testDir: './e2e',
  use: {
    baseURL: 'http://localhost:3100',
    trace: 'on-first-retry',
  },
  workers: 1,
  // Uncomment once you have a server to start:
  // webServer: {
  //   command: 'pnpm build:frontend && PORT=3100 node --import tsx packages/host/src/main.ts',
  //   url: 'http://localhost:3100/health',
  //   reuseExistingServer: false,
  //   timeout: 15000,
  // },
})
