import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // app uses @/ — point vitest at the app package src
      '@': resolve(import.meta.dirname, 'packages/app/src'),
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
        'packages/app/src/setupTests.ts',
        'packages/backoffice/src/setupTests.ts',
      ],
      include: ['packages/host/src/**/*.ts', 'packages/app/src/**/*.{ts,tsx}', 'packages/backoffice/src/**/*.{ts,tsx}'],
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
      'packages/app/src/**/*.test.ts',
      'packages/app/src/**/*.test.tsx',
      'packages/backoffice/src/**/*.test.ts',
      'packages/backoffice/src/**/*.test.tsx',
    ],
    setupFiles: ['packages/app/src/setupTests.ts'],
  },
})
