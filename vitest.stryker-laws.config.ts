import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['packages/host/tests/laws/**/*.spec.ts'],
  },
})
