import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['packages/backend/src/**/*.unit.test.ts', 'packages/backend/src/**/*.integration.test.ts'],
  },
})
