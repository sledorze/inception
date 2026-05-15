/**
 * oxlint JS plugin — design-system enforcement for packages/frontend/.
 *
 * Lint-layer "permission" gates: raw interactive elements and raw palette
 * colors are denied; diagnostics invite the shadcn/ui component or semantic
 * token instead. Fires at four gates — editor (oxlint-check.sh PostToolUse),
 * pre-commit (lefthook), CI (lint:ci), and the paired fixture test.
 *
 * Rules (wired in packages/frontend/.oxlintrc.json via jsPlugins + overrides):
 *   design-system/no-raw-interactive-element — ban raw <button|input|textarea|select>
 *   design-system/no-raw-color-utility       — ban raw palette color utilities in className
 *   design-system/no-inline-style            — ban style={{}} (bypasses theme)
 *
 * Scoped off for src/components/ui/** — shadcn components legitimately use
 * the raw primitives they wrap.
 *
 * Plugin API: ESLint v9-compatible (oxlint jsPlugins alpha). Stays .js to
 * match effect-patterns.js (Node 22.16.0 predates the >=22.18.0 .ts cutoff).
 */

// ── Rule: no-raw-interactive-element ──────────────────────────────────────────

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

// ── Rule: no-raw-color-utility ─────────────────────────────────────────────────

// Tailwind palette color names (all standard palette entries)
const PALETTE_NAMES = [
  'slate',
  'gray',
  'zinc',
  'neutral',
  'stone',
  'red',
  'orange',
  'amber',
  'yellow',
  'lime',
  'green',
  'emerald',
  'teal',
  'cyan',
  'sky',
  'blue',
  'indigo',
  'violet',
  'purple',
  'fuchsia',
  'pink',
  'rose',
].join('|')

// Numeric shade requirement: naturally excludes semantic tokens (bg-primary,
// text-muted-foreground) and opacity modifiers (bg-primary/90).
const RAW_COLOR_RE = new RegExp(
  `\\b(?:bg|text|border|ring|from|via|to|fill|stroke|divide|shadow|accent|caret|decoration|outline|ring-offset)-(?:${PALETTE_NAMES})-(?:50|100|200|300|400|500|600|700|800|900|950)\\b|\\b(?:bg|text|border)-(?:white|black)\\b`,
  'u',
)

/**
 * Recursively collect static string values from an AST expression so the
 * rule fires inside template literals, cn() calls, and ternaries.
 * @param {import('eslint').Rule.Node} node
 * @returns {string[]}
 */
function collectStrings(node) {
  if (!node) {
    return []
  }
  if (node.type === 'Literal' && typeof node.value === 'string') {
    return [node.value]
  }
  if (node.type === 'TemplateLiteral') {
    return [...node.quasis.map(q => q.value.raw), ...node.expressions.flatMap(e => collectStrings(e))]
  }
  if (node.type === 'ConditionalExpression') {
    return [...collectStrings(node.consequent), ...collectStrings(node.alternate)]
  }
  if (node.type === 'BinaryExpression' && node.operator === '+') {
    return [...collectStrings(node.left), ...collectStrings(node.right)]
  }
  if (node.type === 'CallExpression') {
    // cn(...), clsx(...), or any call with string args
    return node.arguments.flatMap(a => collectStrings(a))
  }
  return []
}

/** @type {import('eslint').Rule.RuleModule} */
const noRawColorUtility = {
  create(context) {
    return {
      JSXAttribute(node) {
        const attrName =
          node.name.type === 'JSXIdentifier' ? node.name.name
          : node.name.type === 'JSXNamespacedName' ? node.name.name.name
          : null
        if (attrName !== 'className' && attrName !== 'class') {
          return
        }
        const valueNode = node.value
        if (!valueNode) {
          return
        }

        const strings =
          valueNode.type === 'Literal' ? collectStrings(valueNode)
          : valueNode.type === 'JSXExpressionContainer' ? collectStrings(valueNode.expression)
          : []

        for (const str of strings) {
          const match = RAW_COLOR_RE.exec(str)
          if (match !== null) {
            context.report({
              message:
                `Raw color utility '${match[0]}' bypasses the design-system theme. ` +
                `Use a semantic token instead: bg-background, bg-card, bg-destructive, bg-success, ` +
                `text-foreground, text-muted-foreground, text-destructive, text-success, border-border, etc. ` +
                `Define new status tokens in packages/frontend/src/index.css @theme. ` +
                `Rule rationale: .claude/rules/frontend.md.`,
              node,
            })
            return // one report per attribute is enough
          }
        }
      },
    }
  },
  meta: {
    docs: {
      description: 'Disallow raw Tailwind palette colors in className — use semantic design-system tokens',
    },
    type: 'problem',
  },
}

// ── Rule: no-inline-style ──────────────────────────────────────────────────────

/** @type {import('eslint').Rule.RuleModule} */
const noInlineStyle = {
  create(context) {
    return {
      JSXAttribute(node) {
        const attrName = node.name.type === 'JSXIdentifier' ? node.name.name : null
        if (attrName !== 'style') {
          return
        }
        context.report({
          message:
            'Inline style={{}} bypasses the design-system theme and blocks dark mode. ' +
            'Use Tailwind utilities (className) with semantic tokens from src/index.css @theme instead. ' +
            'Rule rationale: .claude/rules/frontend.md.',
          node,
        })
      },
    }
  },
  meta: {
    docs: { description: 'Disallow inline style={{}} — use className + semantic tokens' },
    type: 'problem',
  },
}

// ── Plugin export ──────────────────────────────────────────────────────────────

const plugin = {
  meta: { name: 'design-system' },
  rules: {
    'no-inline-style': noInlineStyle,
    'no-raw-color-utility': noRawColorUtility,
    'no-raw-interactive-element': noRawInteractiveElement,
  },
}

export default plugin
