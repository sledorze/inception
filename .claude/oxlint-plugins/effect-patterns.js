/**
 * oxlint JS plugin — Effect pattern enforcement for packages/host/.
 *
 * Replaces the grep-based checks in check-effect-patterns.sh with AST-accurate
 * oxlint rules so they are testable, fast, and co-located with the lint pipeline.
 *
 * Rules (wired in .oxlintrc.json via jsPlugins + overrides):
 *   effect-patterns/no-date-clock              — ban Date.now() and bare new Date()
 *   effect-patterns/no-runpromise-in-tests     — ban Effect.runPromise in test files
 *   effect-patterns/no-effect-gen-without-vitest — require @effect/vitest when Effect.gen is used
 *   effect-patterns/no-inline-correlation-id   — ban correlationId: randomUUID() property
 *
 * Plugin API: ESLint v9-compatible (oxlint jsPlugins alpha, Node.js 22 required for .ts plugins;
 * this file stays as .js for compatibility with Node 22.16.0 which predates the >=22.18.0 cutoff).
 */

// ── Rule: no-date-clock ────────────────────────────────────────────────────────

/** @type {import('eslint').Rule.RuleModule} */
const noDateClock = {
  create(context) {
    return {
      CallExpression(node) {
        const { callee } = node
        if (
          callee.type === 'MemberExpression' &&
          !callee.computed &&
          callee.object.type === 'Identifier' &&
          callee.object.name === 'Date' &&
          callee.property.type === 'Identifier' &&
          callee.property.name === 'now'
        ) {
          context.report({
            message:
              'Date.now() is non-deterministic. ' +
              'Use: const ms = yield* Clock.currentTimeMillis — enables TestClock in tests. ' +
              'Format with new Date(ms).toISOString() only when needed.',
            node,
          })
        }
      },
      NewExpression(node) {
        if (node.callee.type === 'Identifier' && node.callee.name === 'Date' && node.arguments.length === 0) {
          context.report({
            message:
              'new Date() is non-deterministic. ' +
              'Use: const ms = yield* Clock.currentTimeMillis, then new Date(ms) for formatting. ' +
              'new Date(ms) with an argument is allowed.',
            node,
          })
        }
      },
    }
  },
  meta: {
    docs: { description: 'Disallow Date.now() and bare new Date() — use Clock.currentTimeMillis' },
    type: 'problem',
  },
}

// ── Rule: no-runpromise-in-tests ───────────────────────────────────────────────

/** @type {import('eslint').Rule.RuleModule} */
const noRunpromiseInTests = {
  create(context) {
    return {
      CallExpression(node) {
        const { callee } = node
        if (
          callee.type === 'MemberExpression' &&
          !callee.computed &&
          callee.object.type === 'Identifier' &&
          callee.object.name === 'Effect' &&
          callee.property.type === 'Identifier' &&
          callee.property.name === 'runPromise'
        ) {
          context.report({
            message:
              'Effect.runPromise in tests bypasses TestClock and structured error channels. ' +
              "Use: import { it } from '@effect/vitest'; it.effect('name', () => Effect.gen(...)). " +
              'Exception: ManagedRuntime.runPromise bridge — use rt.runPromise instead.',
            node,
          })
        }
      },
    }
  },
  meta: {
    docs: {
      description: 'Disallow Effect.runPromise in test files — use it.effect from @effect/vitest',
    },
    type: 'problem',
  },
}

// ── Rule: no-effect-gen-without-vitest ────────────────────────────────────────

/** @type {import('eslint').Rule.RuleModule} */
const noEffectGenWithoutVitest = {
  create(context) {
    let usesEffectGen = false
    let importsEffectVitest = false
    let usesRunPromise = false
    /** @type {import('eslint').Rule.Node | null} */
    let firstGenNode = null

    return {
      CallExpression(node) {
        const { callee } = node
        if (
          callee.type === 'MemberExpression' &&
          !callee.computed &&
          callee.object.type === 'Identifier' &&
          callee.object.name === 'Effect' &&
          callee.property.type === 'Identifier' &&
          callee.property.name === 'gen'
        ) {
          usesEffectGen = true
          if (firstGenNode === null) {
            firstGenNode = node
          }
        }
        // ManagedRuntime bridge: rt.runPromise(...) or any .runPromise(...)
        if (
          callee.type === 'MemberExpression' &&
          !callee.computed &&
          callee.property.type === 'Identifier' &&
          callee.property.name === 'runPromise'
        ) {
          usesRunPromise = true
        }
      },
      ImportDeclaration(node) {
        if (node.source.value === '@effect/vitest') {
          importsEffectVitest = true
        }
      },
      'Program:exit'() {
        if (usesEffectGen && !importsEffectVitest && !usesRunPromise) {
          context.report({
            message:
              "Effect.gen used without importing from '@effect/vitest'. " +
              "Use: import { it } from '@effect/vitest'; it.effect('name', () => Effect.gen(...)). " +
              'Exception: ManagedRuntime bridge — the file must contain a .runPromise() call.',
            // firstGenNode set by CallExpression visitor above
            node: firstGenNode,
          })
        }
      },
    }
  },
  meta: {
    docs: {
      description: 'Require @effect/vitest import when Effect.gen is used in tests',
    },
    type: 'problem',
  },
}

// ── Rule: no-inline-correlation-id ────────────────────────────────────────────

/** @type {import('eslint').Rule.RuleModule} */
const noInlineCorrelationId = {
  create(context) {
    return {
      Property(node) {
        // Match key named "correlationId" (identifier or string literal)
        const keyName =
          node.key.type === 'Identifier' ? node.key.name
          : node.key.type === 'Literal' && typeof node.key.value === 'string' ? node.key.value
          : null
        if (keyName !== 'correlationId') {
          return
        }

        // Match value that is a call to randomUUID() or crypto.randomUUID()
        const { value } = node
        if (value.type !== 'CallExpression') {
          return
        }

        const { callee } = value
        const callName =
          callee.type === 'Identifier' ? callee.name
          : callee.type === 'MemberExpression' && !callee.computed && callee.property.type === 'Identifier' ?
            callee.property.name
          : null

        if (callName === 'randomUUID') {
          context.report({
            message:
              'correlationId: randomUUID() breaks goal-level correlation (P8). ' +
              'Use: const correlationId = yield* CurrentCorrelationId  (src/domain/tracing.ts). ' +
              'CurrentCorrelationId defaults to "bootstrap" outside a submitGoal context.',
            node,
          })
        }
      },
    }
  },
  meta: {
    docs: {
      description: 'Disallow correlationId: randomUUID() in object literals — inherit via CurrentCorrelationId',
    },
    type: 'problem',
  },
}

// ── Plugin export ──────────────────────────────────────────────────────────────

const plugin = {
  meta: { name: 'effect-patterns' },
  rules: {
    'no-date-clock': noDateClock,
    'no-effect-gen-without-vitest': noEffectGenWithoutVitest,
    'no-inline-correlation-id': noInlineCorrelationId,
    'no-runpromise-in-tests': noRunpromiseInTests,
  },
}

export default plugin
