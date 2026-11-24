import assert from 'node:assert/strict';
import test from 'node:test';
import { checkContent, DEFAULT_CONFIG } from './rules.mjs';

test('detects hardcoded secrets in source code and documentation', () => {
  const awsKey = `const key = "${'AKIA'}${'1234567890ABCDEF'}";`;
  const ghToken = `token=${'ghp_'}${'a'.repeat(36)}`;
  const pemBlock = `${'-----BEGIN RSA '}PRIVATE KEY-----\nabc`;

  assert.ok(checkContent('src/auth.ts', awsKey, DEFAULT_CONFIG).errors.some((e) => e.includes('[SECRET]')));
  assert.ok(checkContent('README.md', ghToken, DEFAULT_CONFIG).errors.some((e) => e.includes('[SECRET]')));
  assert.ok(checkContent('src/cert.ts', pemBlock, DEFAULT_CONFIG).errors.some((e) => e.includes('[SECRET]')));

  const safeDoc = 'Set AWS_ACCESS_KEY_ID in your environment variables.\n';
  assert.equal(checkContent('README.md', safeDoc, DEFAULT_CONFIG).errors.length, 0);
});

test('detects unresolved git merge conflict markers in code and docs', () => {
  const conflicted = [
    `${'<'.repeat(7)} HEAD`,
    'const a = 1;',
    '='.repeat(7),
    'const a = 2;',
    `${'>'.repeat(7)} feature`,
  ].join('\n');

  const res = checkContent('src/merge.ts', conflicted, DEFAULT_CONFIG);
  assert.equal(res.errors.filter((e) => e.includes('[CONFLICT]')).length, 3);

  const docRes = checkContent('README.md', `${'<'.repeat(7)} HEAD\n`, DEFAULT_CONFIG);
  assert.ok(docRes.errors.some((e) => e.includes('[CONFLICT]')));
});

test('detects focused tests (.only, fit, fdescribe) without false positives', () => {
  const bad = [
    'test.only("runs one", () => {});',
    'it.only("single", () => {});',
    'describe.only("group", () => {});',
    'fit("focused", () => {});',
    'fdescribe("focused suite", () => {});',
  ].join('\n');
  const res = checkContent('src/app.test.ts', bad, DEFAULT_CONFIG);
  assert.equal(res.errors.filter((e) => e.includes('[TEST_ONLY]')).length, 5);

  const safe = [
    'const msg = "never leave test.only in commits";',
    '// fit() is forbidden',
    'test("normal", () => {});',
  ].join('\n');
  assert.equal(checkContent('src/app.test.ts', safe, DEFAULT_CONFIG).errors.length, 0);
});

test('detects debugger statements without flagging property names or strings', () => {
  const bad = 'function run() {\n  debugger;\n}\n';
  const res = checkContent('src/run.js', bad, DEFAULT_CONFIG);
  assert.ok(res.errors.some((e) => e.includes('[DEBUGGER]')));

  const safe = [
    'const msg = "attach debugger";',
    'const cfg = { debugger: false };',
    'console.log(cfg.debugger);',
  ].join('\n');
  assert.equal(checkContent('src/run.js', safe, DEFAULT_CONFIG).errors.length, 0);
});

test('detects empty catch blocks while allowing handled or explicitly commented catches', () => {
  const badSingle = 'try { work(); } catch (err) {}';
  const badMulti = 'try {\n  work();\n} catch {\n  \n}\n';
  assert.ok(checkContent('src/a.ts', badSingle, DEFAULT_CONFIG).errors.some((e) => e.includes('[EMPTY_CATCH]')));
  assert.ok(checkContent('src/b.ts', badMulti, DEFAULT_CONFIG).errors.some((e) => e.includes('[EMPTY_CATCH]')));

  const safeComment = 'try { work(); } catch { /* intentional fallback */ }';
  const safeHandled = 'try { work(); } catch (err) { logError(err); }';
  const safeString = 'const sample = "try { x(); } catch (e) {}";';
  assert.equal(checkContent('src/c.ts', safeComment, DEFAULT_CONFIG).errors.length, 0);
  assert.equal(checkContent('src/d.ts', safeHandled, DEFAULT_CONFIG).errors.length, 0);
  assert.equal(checkContent('src/e.ts', safeString, DEFAULT_CONFIG).errors.length, 0);
});

test('flags junk, temporary, backup, and copy filenames without false positives', () => {
  const junkPaths = [
    'src/temp.ts',
    'src/misc.js',
    'src/auth-old.ts',
    'src/config.bak.ts',
    'src/userService copy.ts',
  ];
  for (const p of junkPaths) {
    const res = checkContent(p, 'export const ok = 1;\n', DEFAULT_CONFIG);
    assert.ok(res.errors.some((e) => e.includes('[JUNK_FILENAME]')), `expected junk error for ${p}`);
  }

  const validPaths = [
    'src/templateEngine.ts',
    'src/olderPosts.ts',
    'src/copyToClipboard.ts',
    'src/orderRepository.ts',
  ];
  for (const p of validPaths) {
    const res = checkContent(p, 'export const ok = 1;\n', DEFAULT_CONFIG);
    assert.equal(res.errors.length, 0, `unexpected error for ${p}`);
  }
});

test('warns when directory nesting exceeds configured maxDirDepth', () => {
  const cfg = { ...DEFAULT_CONFIG, maxDirDepth: 3 };
  const deepRes = checkContent('a/b/c/d/file.ts', 'export const x = 1;\n', cfg);
  assert.ok(deepRes.warnings.some((w) => w.includes('[DIR_DEPTH]')));

  const shallowRes = checkContent('a/b/c/file.ts', 'export const x = 1;\n', cfg);
  assert.equal(shallowRes.warnings.length, 0);
});
