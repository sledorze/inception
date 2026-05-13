import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['packages/host/src/**/*.unit.test.ts', 'packages/host/src/**/*.integration.test.ts'],
  },
})
