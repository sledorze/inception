/**
 * oxlint JS plugin — design-system enforcement for packages/frontend/.
 *
 * Lint-layer "permission" gate: raw interactive HTML elements are denied;
 * the diagnostic invites the developer to the shadcn/ui component instead.
 * Fires at four gates — editor (oxlint-check.sh PostToolUse), pre-commit
 * (lefthook), CI (lint:ci), and the paired fixture test — so the feedback
 * loop closes long before review.
 *
 * Rules (wired in packages/frontend/.oxlintrc.json via jsPlugins + overrides):
 *   design-system/no-raw-interactive-element — ban raw <button|input|textarea|select>
 *
 * Scoped off for src/components/ui/** — shadcn components legitimately wrap
 * the raw element they replace.
 *
 * Plugin API: ESLint v9-compatible (oxlint jsPlugins alpha). Stays .js to
 * match effect-patterns.js (Node 22.16.0 predates the >=22.18.0 .ts cutoff).
 */

// element → { component, importPath } — also the `npx shadcn add <element>` slug
const COMPONENT_MAP = {
  button: { component: 'Button', from: '@/components/ui/button' },
  input: { component: 'Input', from: '@/components/ui/input' },
  select: { component: 'Select', from: '@/components/ui/select' },
  textarea: { component: 'Textarea', from: '@/components/ui/textarea' },
}

/** @type {import('eslint').Rule.RuleModule} */
const noRawInteractiveElement = {
  create(context) {
    return {
      JSXOpeningElement(node) {
        // Only plain intrinsic tags: <button>. Components (<Button>) and
        // member/namespaced names (<Foo.Bar>) are JSXIdentifier capitalized
        // or non-JSXIdentifier — left alone.
        if (node.name.type !== 'JSXIdentifier') {
          return
        }
        const tag = node.name.name
        const mapping = COMPONENT_MAP[tag]
        if (mapping === undefined) {
          return
        }
        context.report({
          message:
            `Raw <${tag}> bypasses the design system. ` +
            `Use <${mapping.component}> from '${mapping.from}' (shadcn/ui). ` +
            `If it is not installed yet: npx shadcn add ${tag}. ` +
            `Rule rationale: .claude/rules/frontend.md.`,
          node,
        })
      },
    }
  },
  meta: {
    docs: {
      description: 'Disallow raw interactive HTML elements in application code — use shadcn/ui components',
    },
    type: 'problem',
  },
}

// ── Plugin export ──────────────────────────────────────────────────────────────

const plugin = {
  meta: { name: 'design-system' },
  rules: {
    'no-raw-interactive-element': noRawInteractiveElement,
  },
}

export default plugin
