import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { createContext, runInContext } from 'node:vm';

import { parseColorScheme, parsePreferences, parseThemeChannels } from '$lib/theme/parsing';
import { themeChannelsSchema } from '$lib/theme/schemas';

import { generateThemeInit } from '#scripts/generate-theme-init.ts';

void test('shared theme parsers preserve preferences and match the regular channel validation', () => {
  assert.equal(parseColorScheme('light'), 'light');
  assert.equal(parseColorScheme('dark'), 'dark');
  assert.deepEqual(parsePreferences({ reducedMotion: false }), { reducedMotion: false });
  assert.deepEqual(parsePreferences({ reducedMotion: true }), { reducedMotion: true });
  for (const invalid of [null, [], {}, 'dark', { reducedMotion: 'false' }]) {
    assert.deepEqual(parsePreferences(invalid), {});
  }
  for (const invalid of [null, undefined, 'sepia', {}, 1]) {
    assert.equal(parseColorScheme(invalid), null);
  }

  for (const channels of [
    { chroma: 0, hue: 0, luminosity: 0 },
    { chroma: 0.5, hue: 360, luminosity: 1 },
    { chroma: 0.14, hue: 250, luminosity: 0.6 },
  ]) {
    assert.deepEqual(parseThemeChannels(channels), channels);
    assert.deepEqual(themeChannelsSchema.parse(channels), channels);
  }
  const base = { chroma: 0.14, hue: 250, luminosity: 0.6 };
  for (const [channel, values] of [
    ['chroma', [-1, 0.51, NaN, Infinity, '0.14', null]],
    ['hue', [-1, 361, 250.5, NaN, Infinity, '250', null]],
    ['luminosity', [-1, 1.01, NaN, Infinity, '0.6', null]],
  ] as const) {
    for (const value of values) {
      const saved = { ...base, [channel]: value };
      const { [channel]: _ignored, ...remaining } = base;
      assert.deepEqual(parseThemeChannels(saved), remaining);
      assert.equal(themeChannelsSchema.safeParse(saved).success, false);
      assert.equal(parseThemeChannels(saved)[channel], undefined);
    }
  }
  for (const invalid of [null, [], {}, 'theme']) {
    assert.deepEqual(parseThemeChannels(invalid), {});
  }
});

void test('the startup script applies preferences without Zod or dynamic code generation', async () => {
  await generateThemeInit();
  const source = await readFile('static/theme-init.js', 'utf8');
  for (const [stored, expected] of [
    [{}, { reducedMotion: 'true' }],
    [
      {
        'appearance-preferences': '{"reducedMotion":false}',
        'color-scheme': 'dark',
        theme: '{"chroma":0.2,"hue":360,"luminosity":0}',
      },
      { chroma: '0.2', hue: '360', luminosity: '0', reducedMotion: 'false', scheme: 'dark' },
    ],
    [
      {
        'appearance-preferences': '{"reducedMotion":"false"}',
        'color-scheme': 'sepia',
        theme: '{"chroma":0.1,"hue":12.5,"luminosity":2}',
      },
      { chroma: '0.1', reducedMotion: 'true' },
    ],
    [{ 'appearance-preferences': '{broken', theme: '{broken' }, { reducedMotion: 'true' }],
  ] as const) {
    const applied: Record<string, string> = {};
    const root = {
      dataset: {} as Record<string, string>,
      style: {
        colorScheme: undefined as string | undefined,
        setProperty: (name: string, value: string) => {
          applied[name.replace('--theme-', '')] = value;
        },
      },
    };
    const storage: Readonly<Record<string, string | undefined>> = stored;
    const context = createContext(
      {
        document: { documentElement: root },
        localStorage: { getItem: (key: string) => storage[key] ?? null },
        matchMedia: () => ({ matches: true }),
      },
      { codeGeneration: { strings: false, wasm: false } },
    );
    assert.throws(() => runInContext('new Function("return 1")()', context), { name: 'EvalError' });
    runInContext(source, context);
    assert.deepEqual(
      {
        ...applied,
        reducedMotion: root.dataset.reducedMotion,
        ...(root.style.colorScheme ? { scheme: root.style.colorScheme } : {}),
      },
      expected,
    );
  }
});
