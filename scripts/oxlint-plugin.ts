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

export default {
  meta: { name: 'personal-site' },
  rules: { 'no-function-keyword': noFunctionKeyword },
};
