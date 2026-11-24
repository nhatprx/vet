import assert from 'node:assert/strict';
import test from 'node:test';
import { checkContent, DEFAULT_CONFIG } from './rules.mjs';

test('passes clean modular TypeScript file and handles empty content', () => {
  const sample = [
    'export function add(a: number, b: number): number {',
    '  return a + b;',
    '}',
  ].join('\n');
  const res = checkContent('src/math.ts', sample, DEFAULT_CONFIG);
  assert.equal(res.errors.length, 0);
  assert.equal(res.warnings.length, 0);

  const emptyRes = checkContent('src/empty.ts', '', DEFAULT_CONFIG);
  assert.equal(emptyRes.errors.length, 0);
  assert.equal(emptyRes.warnings.length, 0);
});

test('counts lines accurately with trailing newlines at maxLoc boundary', () => {
  const lines199 = `${Array.from({ length: 199 }, (_, i) => `const a${i} = ${i};`).join('\n')}\n`;
  const res199 = checkContent('src/edge.ts', lines199, DEFAULT_CONFIG);
  assert.equal(res199.errors.length, 0);
  assert.ok(res199.warnings.some((w) => w.includes('[LOC_WARN]')));

  const lines200 = `${Array.from({ length: 200 }, (_, i) => `const b${i} = ${i};`).join('\n')}\n`;
  const res200 = checkContent('src/over.ts', lines200, DEFAULT_CONFIG);
  assert.ok(res200.errors.some((e) => e.includes('[LOC]')));
});

test('detects emojis, TypeScript any variants, and @ts-ignore/@ts-nocheck directives', () => {
  const bad = [
    'const rocket = "\u{1F680}";',
    'const value: any = 1;',
    'const castVal = value as any;',
    'const map: Record<string, any> = {};',
    'const list: any[] = [];',
    '// @ts-ignore',
    '/* @ts-nocheck */',
    'const x = 1; // @ts-ignore',
  ].join('\n');
  const res = checkContent('src/bad.ts', bad, DEFAULT_CONFIG);
  assert.ok(res.errors.some((e) => e.includes('[EMOJI]')));
  assert.equal(res.errors.filter((e) => e.includes('[TS_STRICT]')).length, 7);
});

test('avoids false positives for any or @ts-ignore inside string literals and comments', () => {
  const safe = [
    '// Accepts any valid input string',
    'const help = "select: any option or treat as any";',
    'const note = "do not use @ts-ignore in code";',
  ].join('\n');
  const res = checkContent('src/safe.ts', safe, DEFAULT_CONFIG);
  assert.equal(res.errors.length, 0);
});

test('flags line stuffing while allowing for-loops, TS inline types, and HTML entities', () => {
  const stuffed = [
    'a(); b(); c(); d();',
    'const a: number = 1; const b: number = 2; const c: number = 3;',
    'const x = a / b; const y = c / d; const z = e / f;',
  ].join('\n');
  const stuffedRes = checkContent('src/stuffed.ts', stuffed, DEFAULT_CONFIG);
  assert.equal(stuffedRes.errors.filter((e) => e.includes('[LINE_STUFFING]')).length, 3);

  const valid = [
    'for (let i = 0; i < 10; i++) { total += i; }',
    'type Point = { x: number; y: number; z: number; };',
    'const label = <span>&amp; &lt; &gt; &nbsp;</span>;',
    'const SEMI_RE = /[^;]+;[^;]+;/g;',
  ].join('\n');
  const validRes = checkContent('src/valid.tsx', valid, DEFAULT_CONFIG);
  assert.equal(validRes.errors.length, 0);
});

test('checks docs for emojis while exempting them from LOC limits', () => {
  const longDoc = Array.from({ length: 250 }, (_, i) => `Paragraph line ${i}`).join('\n');
  const cleanDocRes = checkContent('README.md', longDoc, DEFAULT_CONFIG);
  assert.equal(cleanDocRes.errors.length, 0);
  assert.equal(cleanDocRes.warnings.length, 0);

  const emojiDocRes = checkContent('README.md', 'Hello \u{1F680}\n', DEFAULT_CONFIG);
  assert.ok(emojiDocRes.errors.some((e) => e.includes('[EMOJI]')));
});

test('supports custom regex rules including warnings and invalid regex handling', () => {
  const cfg = {
    ...DEFAULT_CONFIG,
    customRules: [
      {
        id: 'NO_CONSOLE_LOG',
        pattern: '\\bconsole\\.log\\(',
        message: 'Do not commit console.log',
        extensions: ['.TS'],
      },
      {
        id: 'TODO_WARN',
        pattern: 'TODO:',
        severity: 'warn',
      },
      {
        id: 'BROKEN_REGEX',
        pattern: '[unclosed',
      },
    ],
  };
  const res = checkContent('src/debug.ts', '// TODO: clean up\nconsole.log("hi");', cfg);
  assert.ok(res.errors.some((e) => e.includes('[NO_CONSOLE_LOG]')));
  assert.ok(res.errors.some((e) => e.includes('[CUSTOM_RULE_CONFIG]')));
  assert.ok(res.warnings.some((w) => w.includes('[TODO_WARN]')));
});
