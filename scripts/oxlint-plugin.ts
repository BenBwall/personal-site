import { readFileSync } from 'node:fs';

import type { RuleTester } from 'oxlint/plugins-dev';

import { analyzeSvelteSyntax } from '#scripts/svelte-lint.ts';

export const noFunctionKeyword = {
  createOnce(context) {
    return {
      FunctionDeclaration(node) {
        if (!node.generator) {
          context.report({ messageId: 'useArrowOrMethod', node });
        }
      },
      FunctionExpression(node) {
        const parent = node.parent;
        // ESTree represents method bodies as function expressions too.
        if (
          node.generator ||
          (parent.type === 'MethodDefinition' && parent.value === node) ||
          (parent.type === 'Property' &&
            parent.value === node &&
            (parent.method || parent.kind === 'get' || parent.kind === 'set'))
        ) {
          return;
        }
        context.report({ messageId: 'useArrowOrMethod', node });
      },
      TSDeclareFunction(node) {
        context.report({ messageId: 'useArrowOrMethod', node });
      },
      before() {
        return context.sourceCode.text.includes('function');
      },
    };
  },
  meta: {
    messages: {
      useArrowOrMethod:
        'Use an arrow function or method shorthand instead of the function keyword.',
    },
    schema: [],
    type: 'suggestion',
  },
} satisfies Parameters<RuleTester['run']>[1];

export const noAddEventListener = {
  createOnce(context) {
    return {
      CallExpression(node) {
        if (node.callee.type === 'Identifier' && node.callee.name === 'addEventListener') {
          context.report({ messageId: 'useSvelteOn', node: node.callee });
        }
      },
      MemberExpression(node) {
        const property = node.property;
        if (
          (!node.computed &&
            property.type === 'Identifier' &&
            property.name === 'addEventListener') ||
          (node.computed && property.type === 'Literal' && property.value === 'addEventListener') ||
          (node.computed &&
            property.type === 'TemplateLiteral' &&
            property.expressions.length === 0 &&
            property.quasis[0]?.value.cooked === 'addEventListener')
        ) {
          context.report({ messageId: 'useSvelteOn', node: property });
        }
      },
      before() {
        return context.sourceCode.text.includes('addEventListener');
      },
    };
  },
  meta: {
    messages: {
      useSvelteOn: "Use on from 'svelte/events' instead of addEventListener.",
    },
    schema: [],
    type: 'suggestion',
  },
} satisfies Parameters<RuleTester['run']>[1];

export const noLegacySvelte = {
  createOnce(context) {
    return {
      Program() {
        const filename = context.physicalFilename;
        if (!filename.endsWith('.svelte')) {
          return;
        }
        const source = readFileSync(filename, 'utf8');
        // Oxlint visits each script separately. Inspect the whole component
        // only on the first script visit, avoiding duplicate template reports.
        const { findings, firstScript } = analyzeSvelteSyntax(source);
        if (firstScript?.trim() !== context.sourceCode.text.trim()) {
          return;
        }
        for (const finding of findings) {
          const prefix = source.slice(0, finding.start);
          const line = prefix.split('\n').length;
          const column = finding.start - prefix.lastIndexOf('\n');
          // Oxlint only exposes script locations, so include the true template
          // position in the message, matching the native Svelte plugin.
          context.report({
            loc: { start: { column: 0, line: 1 } },
            message: `[${line}:${column}] ${finding.message}`,
          });
        }
      },
      before() {
        return context.physicalFilename.endsWith('.svelte');
      },
    };
  },
  meta: {
    schema: [],
    type: 'suggestion',
  },
} satisfies Parameters<RuleTester['run']>[1];

export default {
  meta: { name: 'personal-site' },
  rules: {
    'no-add-event-listener': noAddEventListener,
    'no-function-keyword': noFunctionKeyword,
    'no-legacy-svelte': noLegacySvelte,
  },
};
