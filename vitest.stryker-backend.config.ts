import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: [
      'packages/host/src/**/*.unit.test.ts',
      'packages/host/src/**/*.integration.test.ts',
      'packages/host/tests/**/*.unit.test.ts',
      'packages/host/tests/**/*.integration.test.ts',
      'packages/host/tests/**/*.spec.ts',
    ],
  },
})
