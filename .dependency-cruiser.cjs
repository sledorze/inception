/** @type {import('dependency-cruiser').IConfiguration} */
//
// Hexagonal architecture boundary enforcement for packages/host.
// Shape: domain ← ports ← (adapters implement ports) ← runtime wires layers.
//
// Two-layer enforcement (deny-by-default):
//   allowed[]           — every edge must match ≥1 entry; unmatched → error
//   forbidden[]         — specific patterns the allowlist can't cleanly express
//
// Companion rule: CLAUDE.md §Architecture + .claude/rules/host-package.md
module.exports = {
  // ─── DENY BY DEFAULT ──────────────────────────────────────────────────────
  // Every edge MUST match ≥1 allowed[] entry.  Anything unmatched raises
  // 'not-in-allowed' (severity set via allowedSeverity below).
  // New file / new layer / new package → DENIED by default.
  allowed: [
    // npm dependencies + Node built-ins (single broad wildcard)
    {
      comment: 'Any workspace file may use npm deps or Node built-ins. Specific bans live in forbidden[].',
      from: {},
      to: { path: '^(?:node_modules/|node:|[a-zA-Z@])' },
    },

    // Relative imports within the same package (always allowed)
    {
      comment: 'Relative imports within a package are always allowed.',
      from: { path: '^packages/' },
      to: { dependencyTypes: ['local'] },
    },

    // Cross-package workspace edges (packages/* → packages/*)
    {
      comment: 'Cross-workspace package imports are allowed; forbidden[] carves out denials.',
      from: { path: '^packages/' },
      to: { path: '^packages/' },
    },

    // App + backoffice internals (no host-specific restrictions here)
    {
      comment: 'App and backoffice internals.',
      from: { path: '^packages/(app|backoffice)/src/' },
      to: { path: '^packages/(app|backoffice)/src/' },
    },

    // e2e + scripts
    {
      comment: 'e2e and scripts are top-level tooling with broad access.',
      from: { path: '^(e2e|scripts)/' },
      to: { path: '^(e2e|scripts|packages)/' },
    },
  ],
  allowedSeverity: 'error',

  forbidden: [
    // ── P36/P37: Components must not import api/ directly ─────────────────
    {
      comment: 'Components must not import api/ directly — use hooks/ as the mediation layer (P36/P37).',
      from: { path: '^packages/(app|backoffice)/src/components/' },
      name: 'no-frontend-component-api-import',
      severity: 'error',
      to: { path: '^packages/(app|backoffice)/src/api/' },
    },

    // ── Atom API: Components must use atoms.ts, not useAsyncFetch ────────
    {
      comment: 'Frontend components must not import useAsyncFetch — use @effect/atom-react + atoms.ts instead.',
      from: { path: '^packages/(app|backoffice)/src/' },
      name: 'no-useAsyncFetch-import',
      severity: 'error',
      to: { path: 'useAsyncFetch' },
    },

    // ── Design-system package purity ───────────────────────────────────────
    {
      comment:
        'packages/design-system is a pure leaf — it must not import from app, backoffice, or host. ' +
        'Mirrors host-domain-pure. Component primitives must be dependency-free workspace peers.',
      from: { path: String.raw`^packages/design-system/` },
      name: 'design-system-pure',
      severity: 'error',
      to: { path: String.raw`^packages/(app|backoffice|host)/` },
    },

    // ── L2.14: Non-adapter code cannot import from adapters/ ──────────────
    {
      comment:
        'L2.14: domain, application, and ports must not import from adapters. ' +
        'Adapters implement ports; callers depend on ports only. ' +
        'Layer composition (runtime wiring) lives in runtime/bind.ts (SPEC §2.14).',
      from: {
        path: String.raw`^packages/host/src/(?!adapters/)`,
        pathNot: [String.raw`^packages/host/src/runtime/`, String.raw`^packages/host/src/adapters/`],
      },
      name: 'host-no-adapter-import',
      severity: 'error',
      to: { path: String.raw`^packages/host/src/adapters/` },
    },

    // ── L2.14: Driving adapters cannot import from driven adapters ─────────
    {
      comment:
        'L2.14: Driving adapters (UserGateway, ObservabilityGateway impls) must not ' +
        'import driven adapters (EventStore impl, LlmProvider impl, etc.) directly. ' +
        'Cross-adapter wiring goes through Layer composition at runtime.',
      from: { path: String.raw`^packages/host/src/adapters/driving/` },
      name: 'host-driving-no-driven-adapter',
      severity: 'error',
      to: { path: String.raw`^packages/host/src/adapters/driven/` },
    },

    // ── Domain purity ───────────────────────────────────────────────────────
    {
      comment:
        'Domain is a pure leaf: no imports from ports, adapters, runtime, or application. ' +
        'Domain types (schemas, value objects) may be referenced by ports and application — not the reverse.',
      from: { path: String.raw`^packages/host/src/domain/` },
      name: 'host-domain-pure',
      severity: 'error',
      to: {
        path: [
          String.raw`^packages/host/src/ports/`,
          String.raw`^packages/host/src/adapters/`,
          String.raw`^packages/host/src/runtime/`,
          String.raw`^packages/host/src/application/`,
        ],
      },
    },

    // ── Application layer purity ────────────────────────────────────────────
    {
      comment:
        'Application services (Effect.gen orchestrations) depend on ports only — never adapters or runtime. ' +
        'This is the impureim sandwich outer shell; adapters are injected at runtime via Layer.',
      from: { path: String.raw`^packages/host/src/application/` },
      name: 'host-application-pure',
      severity: 'error',
      to: {
        path: [String.raw`^packages/host/src/adapters/`, String.raw`^packages/host/src/runtime/`],
      },
    },

    // ── Ports don't import adapters ─────────────────────────────────────────
    {
      comment: 'Port interfaces declare contracts; they must not import any adapter.',
      from: { path: String.raw`^packages/host/src/ports/` },
      name: 'host-ports-no-adapters',
      severity: 'error',
      to: { path: String.raw`^packages/host/src/adapters/` },
    },

    // ── Adapters don't import each other across driven boundaries ───────────
    {
      comment:
        'Driven adapters must not import each other. Parametric on adapters/driven/<name>/. ' +
        'Cross-adapter composition goes through Layer merging at runtime.',
      from: { path: String.raw`^packages/host/src/adapters/driven/([^/]+)/` },
      name: 'host-no-cross-driven-adapter',
      severity: 'error',
      to: {
        path: String.raw`^packages/host/src/adapters/driven/[^/]+/`,
        pathNot: [String.raw`^packages/host/src/adapters/driven/$1/`],
      },
    },

    // ── No circular dependencies (ADP) ─────────────────────────────────────
    {
      comment: 'Circular imports violate the Acyclic Dependencies Principle. Error not warn.',
      from: {},
      name: 'no-circular',
      severity: 'error',
      to: { circular: true },
    },

    // ── Tests don't import adapters directly (except integration/protocol) ──
    {
      comment:
        'Unit tests must drive the system through ports (Context.Service), ' +
        'not by importing adapter files directly. ' +
        'Only integration tests and protocol tests may reference adapters.',
      from: { path: [String.raw`\.unit\.test\.ts$`] },
      name: 'host-unit-tests-no-adapters',
      severity: 'error',
      to: { path: String.raw`^packages/host/src/adapters/` },
    },
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
