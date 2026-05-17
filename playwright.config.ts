import { defineConfig } from '@playwright/test'

// Default LLM_MODE to 'fake' so e2e tests run deterministically without LMStudio.
// Override with LLM_MODE=record (record cassette) or LLM_MODE=replay (lock to cassette).
process.env['LLM_MODE'] ??= 'fake'

// Cassette hashes = SHA-256(model + messages + tools). LLM_MODEL must match the value
// used during recording so replay hashes are stable. Default matches the cassette set
// committed with the P42 fix. Pass LLM_MODEL env to override (e.g. when re-recording).
const LLM_MODEL = process.env['LLM_MODEL'] ?? 'qwopus3.6-35b-a3b-v1@q4_k_s'
const LLM_MODE = process.env['LLM_MODE']

export default defineConfig({
  fullyParallel: false,
  retries: 0,
  testDir: './e2e',
  use: {
    baseURL: 'http://localhost:3100',
    trace: 'on-first-retry',
  },
  webServer: {
    command: `pnpm build:app && LLM_MODE=${LLM_MODE} LLM_MODEL=${LLM_MODEL} PORT=3100 node --import tsx packages/host/src/main.ts`,
    reuseExistingServer: !process.env['CI'],
    timeout: 30_000,
    url: 'http://localhost:3100/health',
  },
  workers: 1,
})
