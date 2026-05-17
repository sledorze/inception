import type { KnipConfig } from 'knip'

const config: KnipConfig = {
  ignore: ['.claude/**', 'vendor/**'],
  workspaces: {
    '.': {
      entry: [
        'e2e/**/*.ts',
        // Stryker vitest runner configs — referenced by stryker.*.config.json, not imported
        'vitest.stryker-backend.config.ts',
        'vitest.stryker-frontend.config.ts',
        'vitest.stryker-laws.config.ts',
      ],
      ignoreDependencies: [
        // Frontend UI packages live in root node_modules (pnpm hoisting) but are
        // consumed by packages/app and packages/backoffice — knip attributes them to root instead.
        '@testing-library/jest-dom',
        '@testing-library/react',
        '@testing-library/user-event',
        'class-variance-authority',
        'clsx',
        'tailwind-merge',
        'tw-animate-css',
        // CLI tools invoked via pnpm scripts, not imported.
        'shadcn',
      ],
    },
    'packages/app': {
      ignore: ['src/lib/utils.ts'],
      project: ['src/**/*.{ts,tsx}'],
    },
    'packages/backoffice': {
      ignore: ['src/lib/utils.ts'],
      project: ['src/**/*.{ts,tsx}'],
    },
    'packages/host': {
      entry: [
        // Public API surfaces — exports from entry files are not flagged as unused
        'src/ports/**/*.ts',
        'src/domain/**/*.ts',
        'src/runtime/bind.ts',
        // Future entry points (planned adapters not yet wired in main.ts)
        'src/adapters/driving/StdioMcpObservabilityAdapter.ts',
        'src/adapters/driven/OpenAiCompatLlmProvider.ts',
        // Tool definitions consumed by Toolkit.make in the same file
        'src/adapters/driving/GeorgesToolkit.ts',
      ],
      project: ['src/**/*.ts'],
    },
    'packages/monitor': {
      project: ['src/**/*.ts'],
    },
  },
}

export default config
