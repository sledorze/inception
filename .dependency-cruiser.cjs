/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    // Add project-specific dependency rules here.
    //
    // Example — prevent test infrastructure from becoming a hub module:
    // {
    //   name: 'no-test-barrel-re-exports',
    //   severity: 'error',
    //   comment: 'Test infra files must not import from test-helpers.ts.',
    //   from: { path: 'src/__tests__/test-fake-api\\.ts$' },
    //   to:   { path: 'src/__tests__/test-helpers\\.ts$' },
    // },
    //
    // Example — enforce per-entity event imports in services:
    // {
    //   name: 'no-service-import-event-union',
    //   severity: 'error',
    //   comment: 'Services must import from per-entity event files, not the aggregated union.',
    //   from: { path: 'src/services/(?!EventBus\\.ts$).*\\.ts$' },
    //   to:   { path: 'src/domain/events/DomainEvent\\.ts$' },
    // },
  ],
  options: {
    doNotFollow: {
      path: 'node_modules',
    },
    moduleSystems: ['es6', 'cjs'],
    reporterOptions: {
      text: {
        highlightFocused: true,
      },
    },
    tsPreCompilationDeps: true,
  },
}
