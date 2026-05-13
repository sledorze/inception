import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    coverage: {
      exclude: ['packages/**/*.test.ts', 'packages/**/*.test.tsx', 'packages/**/*.d.ts'],
      include: ['packages/host/src/**/*.ts', 'packages/frontend/src/**/*.{ts,tsx}'],
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      // Uncomment once tests are established (increase thresholds as coverage improves):
      // thresholds: {
      //   lines: 50,
      //   statements: 50,
      //   functions: 40,
      //   branches: 30,
      // },
    },
    include: [
      'packages/host/src/**/*.test.ts',
      'packages/frontend/src/**/*.test.ts',
      'packages/frontend/src/**/*.test.tsx',
    ],
  },
})
