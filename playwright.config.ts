import { defineConfig } from '@playwright/test'

// Default LLM_MODE to 'fake' so e2e tests run deterministically without LMStudio.
// Override with LLM_MODE=record (record cassette) or LLM_MODE=replay (lock to cassette).
process.env['LLM_MODE'] ??= 'fake'

export default defineConfig({
  fullyParallel: false,
  retries: 0,
  testDir: './e2e',
  use: {
    baseURL: 'http://localhost:3100',
    trace: 'on-first-retry',
  },
  webServer: {
    command: `pnpm build:frontend && LLM_MODE=${process.env['LLM_MODE']} PORT=3100 node --import tsx packages/host/src/main.ts`,
    reuseExistingServer: !process.env['CI'],
    timeout: 30_000,
    url: 'http://localhost:3100/health',
  },
  workers: 1,
})
