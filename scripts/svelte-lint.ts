import { parse } from 'svelte/compiler';

type Node = { type: string; start: number; end: number; [key: string]: unknown };
type Finding = { start: number; message: string };

const isNode = (value: unknown): value is Node =>
  typeof value === 'object' &&
  value !== null &&
  'type' in value &&
  typeof value.type === 'string' &&
  'start' in value &&
  typeof value.start === 'number' &&
  'end' in value &&
  typeof value.end === 'number';

const legacyNodes: Record<string, string | undefined> = {
  ConstTag: 'Use {const ... = $derived(...)} instead of legacy {@const ...}.',
  LetDirective: 'Use snippets and @render instead of legacy let: slot props.',
  OnDirective: 'Use event handler attributes such as onclick instead of on: directives.',
  SlotElement: 'Use snippets and @render instead of legacy slots.',
  SvelteComponent: 'Use a component variable directly instead of <svelte:component>.',
  SvelteFragment: 'Use snippets instead of <svelte:fragment>.',
  SvelteSelf: 'Import the component itself instead of using <svelte:self>.',
};

// The native plugin's off-by-default rules cannot currently be enabled through
// Oxlint. Use the installed Svelte parser for legacy syntax, including @const.
export const analyzeSvelteSyntax = (source: string) => {
  const root = parse(source, { modern: true });
  const findings: Finding[] = [];
  const inspect = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const child of value) {
        inspect(child);
      }
      return;
    }
    if (typeof value !== 'object' || value === null) {
      return;
    }
    if (isNode(value)) {
      let message = legacyNodes[value.type];
      if (value.type === 'LabeledStatement' && isNode(value.label) && value.label.name === '$') {
        message = 'Use $derived or $effect instead of legacy reactive statements.';
      }
      if (
        value.type === 'ExportNamedDeclaration' &&
        isNode(value.declaration) &&
        value.declaration.type === 'VariableDeclaration' &&
        value.declaration.kind === 'let'
      ) {
        message = 'Declare component props with $props instead of export let.';
      }
      if (
        value.type === 'Identifier' &&
        (value.name === '$$props' || value.name === '$$restProps' || value.name === '$$slots')
      ) {
        message = 'Use $props and snippets instead of legacy $$props, $$restProps or $$slots.';
      }
      if (message) {
        findings.push({ message, start: value.start });
      }
    }
    for (const child of Object.values(value)) {
      inspect(child);
    }
  };
  // Module exports are public module API, rather than legacy component props.
  inspect(root.instance?.content);
  inspect(root.fragment.nodes);
  const firstScript =
    root.instance && (!root.module || root.instance.start < root.module.start)
      ? root.instance
      : root.module;
  const content = firstScript?.content;
  return {
    findings,
    firstScript: isNode(content) ? source.slice(content.start, content.end) : undefined,
  };
};

export const findLegacySvelte = (source: string): Finding[] => analyzeSvelteSyntax(source).findings;
