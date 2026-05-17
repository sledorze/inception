import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@/': `${path.resolve(import.meta.dirname, 'packages/app/src')}/`,
    },
  },
  test: {
    environment: 'happy-dom',
    include: ['packages/app/src/**/*.test.ts', 'packages/app/src/**/*.test.tsx'],
  },
})
