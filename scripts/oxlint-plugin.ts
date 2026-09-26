import type { RuleTester } from 'oxlint/plugins-dev';

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

export default {
  meta: { name: 'personal-site' },
  rules: { 'no-add-event-listener': noAddEventListener, 'no-function-keyword': noFunctionKeyword },
};
