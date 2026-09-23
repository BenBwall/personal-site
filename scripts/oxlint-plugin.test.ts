import { RuleTester } from 'oxlint/plugins-dev';

import { noFunctionKeyword } from '#scripts/oxlint-plugin.ts';

const tester = new RuleTester({
  languageOptions: { parserOptions: { lang: 'ts' }, sourceType: 'module' },
});

tester.run('no-function-keyword', noFunctionKeyword, {
  invalid: [
    ...[
      'function run() {}',
      'async function run() {}',
      'export function run() {}',
      'export default function () {}',
      'const run = function () {};',
      'const run = function named() { named(); };',
      'const run = async function () {};',
      'items.map(function (item) { return item; });',
      'const object = { run: function () { return this; } };',
      'const object = { run: async function () {} };',
      'class Example { run = function () {}; }',
      '(function () {})();',
      'declare function run(): void;',
      'function run(value: string): string { return value; }',
      'function run() { return arguments; }',
      'function run() { return new.target; }',
      'function* values() { return function () {}; }',
      'async function* values() { yield function () {}; }',
      'function run() { return function* () { yield this.value; }; }',
      'const object = { run() { return function () {}; } };',
    ].map((code) => ({ code, errors: [{ messageId: 'useArrowOrMethod' }], output: null })),
    ...[
      'function outer() { return function () {}; }',
      'function run(value: string): string; function run(value: string) { return value; }',
    ].map((code) => ({
      code,
      errors: [{ messageId: 'useArrowOrMethod' }, { messageId: 'useArrowOrMethod' }],
      output: null,
    })),
  ],
  valid: [
    'const run = () => {};',
    'const run = async () => {};',
    'export const run = () => {};',
    'export default () => {};',
    'items.map((item) => item);',
    'const object = { run() {}, async load() {}, *values() { yield 1; } };',
    'const object = { get value() { return 1; }, set value(value) {} };',
    'class Example { constructor() {} run() {} static run() {} async load() {} *values() {} }',
    'class Example { get value() { return 1; } set value(value) {} run = () => {}; }',
    'const object = { function() {}, function: "function" }; // function is allowed in text',
    'type Callback = (value: string) => string;',
    'declare const run: () => void;',
    'function* values() { yield 1; }',
    'async function* values() { yield 1; }',
    'export function* values() { yield 1; }',
    'export default async function* () { yield 1; }',
    'const values = function* () { yield 1; };',
    'const values = async function* () { yield 1; };',
    'const object = { values: function* () { yield 1; } };',
    'const object = { values: async function* () { yield 1; } };',
  ],
});
