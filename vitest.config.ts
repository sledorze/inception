import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, 'packages/frontend/src'),
    },
  },
  test: {
    benchmark: {
      include: ['packages/host/tests/perf/**/*.bench.ts'],
    },
    coverage: {
      exclude: [
        'packages/**/*.test.ts',
        'packages/**/*.test.tsx',
        'packages/**/*.spec.ts',
        'packages/**/*.bench.ts',
        'packages/**/*.d.ts',
        'packages/host/src/main.ts',
        'packages/frontend/src/setupTests.ts',
      ],
      include: ['packages/host/src/**/*.ts', 'packages/frontend/src/**/*.{ts,tsx}'],
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      thresholds: {
        branches: 60,
        functions: 75,
        lines: 73,
        statements: 73,
      },
    },
    include: [
      'packages/host/src/**/*.test.ts',
      'packages/host/tests/**/*.spec.ts',
      'packages/host/tests/**/*.unit.test.ts',
      'packages/host/tests/**/*.integration.test.ts',
      'packages/monitor/tests/**/*.unit.test.ts',
      'packages/frontend/src/**/*.test.ts',
      'packages/frontend/src/**/*.test.tsx',
    ],
    setupFiles: ['packages/frontend/src/setupTests.ts'],
  },
})
