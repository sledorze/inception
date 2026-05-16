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
      ],
      // app/backoffice are SPA packages — their coverage is measured separately
      // via browser-based tests once React Testing Library is wired up (TODO Phase 7.D+).
      include: ['packages/host/src/**/*.ts'],
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
      'tests/**/*.test.ts',
    ],
    setupFiles: ['packages/app/src/setupTests.ts'],
  },
})
