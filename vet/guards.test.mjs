import assert from 'node:assert/strict';
import test from 'node:test';
import { checkContent, DEFAULT_CONFIG } from './rules.mjs';

test('detects hardcoded secrets in source, docs, and config files with line numbers', () => {
  const awsKey = `const key = "${'AKIA'}${'1234567890ABCDEF'}";`;
  const ghToken = `token=${'ghp_'}${'a'.repeat(36)}`;
  const dbUrl = `url: ${'postgres'}://${'admin'}:${'supersecret'}@db.internal:5432/app`;

  assert.ok(checkContent('src/auth.ts', awsKey, DEFAULT_CONFIG).errors.some((e) => e.includes('[SECRET] src/auth.ts:1:')));
  assert.ok(checkContent('README.md', ghToken, DEFAULT_CONFIG).errors.some((e) => e.includes('[SECRET] README.md:1:')));
  assert.ok(checkContent('config.yml', dbUrl, DEFAULT_CONFIG).errors.some((e) => e.includes('[SECRET] config.yml:1:')));
  assert.equal(checkContent('README.md', 'Set AWS_ACCESS_KEY_ID in env.\n', DEFAULT_CONFIG).errors.length, 0);
});

test('blocks .env files while allowing .env.example templates', () => {
  assert.ok(checkContent('.env', 'PORT=3000\n', DEFAULT_CONFIG).errors.some((e) => e.includes('[ENV_FILE]')));
  assert.ok(checkContent('.env.production', 'PORT=3000\n', DEFAULT_CONFIG).errors.some((e) => e.includes('[ENV_FILE]')));
  assert.equal(checkContent('.env.example', 'PORT=3000\n', DEFAULT_CONFIG).errors.length, 0);
});

test('detects conflict markers statefully without flagging Markdown Setext headings', () => {
  const conflicted = [`${'<'.repeat(7)} HEAD`, 'a', '='.repeat(7), 'b', `${'>'.repeat(7)} feat`].join('\n');
  assert.equal(checkContent('src/m.ts', conflicted, DEFAULT_CONFIG).errors.filter((e) => e.includes('[CONFLICT]')).length, 3);
  assert.equal(checkContent('README.md', 'Title\n=======\nBody\n', DEFAULT_CONFIG).errors.length, 0);
});

test('prevents comment-apostrophe bypass, multiline comment/template false positives, and JSX false positives', () => {
  const bypass = "/* don't */ const x: any = 1; // it's bad\n";
  assert.ok(checkContent('src/a.ts', bypass, DEFAULT_CONFIG).errors.some((e) => e.includes('[TS_STRICT] src/a.ts:1:')));

  const blockComment = '/*\ndebugger;\nconst y: any = 1;\ntry {} catch (e) {}\n*/\nexport const ok = 1;\n';
  assert.equal(checkContent('src/b.ts', blockComment, DEFAULT_CONFIG).errors.length, 0);

  const multilineTpl = 'export const s = `\ntry {} catch (e) {}\n`;\n';
  assert.equal(checkContent('src/c.ts', multilineTpl, DEFAULT_CONFIG).errors.length, 0);

  const jsx = 'export const C = () => <div data-any />;\n';
  assert.equal(checkContent('src/d.tsx', jsx, DEFAULT_CONFIG).errors.length, 0);
});

test('detects flag emojis, focused tests, skipped tests, and multi-language guards', () => {
  const flagRes = checkContent('README.md', 'Flag: \u{1F1FA}\u{1F1F8}\n', DEFAULT_CONFIG);
  assert.ok(flagRes.errors.some((e) => e.includes('[EMOJI] README.md:1:')));

  const pyBad = 'import pdb\nbreakpoint()\ntry:\n  work()\nexcept Exception:\n  pass\n@pytest.mark.skip\ndef test_x():\n  pass\n';
  const pyRes = checkContent('app/run.py', pyBad, DEFAULT_CONFIG);
  assert.ok(pyRes.errors.some((e) => e.includes('[DEBUGGER] app/run.py:2:')));
  assert.ok(pyRes.errors.some((e) => e.includes('[EMPTY_CATCH] app/run.py:5:')));
  assert.ok(pyRes.warnings.some((w) => w.includes('[TEST_SKIP] app/run.py:7:')));

  const jsBad = 'test.only("x", () => {});\ntest.skip("y", () => {});\n';
  const jsRes = checkContent('src/app.test.ts', jsBad, DEFAULT_CONFIG);
  assert.ok(jsRes.errors.some((e) => e.includes('[TEST_ONLY]')));
  assert.ok(jsRes.warnings.some((w) => w.includes('[TEST_SKIP]')));
});

test('flags empty catches and debugger without false positives on comments or properties', () => {
  const emptyCatch = checkContent('src/a.ts', 'try { x(); } catch (e) {}\n', DEFAULT_CONFIG);
  assert.ok(emptyCatch.errors.some((e) => e.includes('[EMPTY_CATCH] src/a.ts:1:')));
  assert.equal(checkContent('src/b.ts', 'try { x(); } catch { /* intentional */ }\n', DEFAULT_CONFIG).errors.length, 0);
  assert.equal(
    checkContent('src/c.js', 'const cfg = { debugger: false };\nconsole.log(cfg.debugger);\n', DEFAULT_CONFIG).errors.length,
    0,
  );
  const dbgRes = checkContent('src/d.js', 'function f() {\n  debugger;\n}\n', DEFAULT_CONFIG);
  assert.ok(dbgRes.errors.some((e) => e.includes('[DEBUGGER] src/d.js:2:')));
});

test('flags junk filenames without blocking legitimate domain names and respects maxDirDepth', () => {
  for (const p of ['src/temp.ts', 'src/misc.js', 'src/auth-old.ts', 'src/config.bak.ts', 'src/userService copy.ts']) {
    assert.ok(checkContent(p, 'export const ok = 1;\n', DEFAULT_CONFIG).errors.some((e) => e.includes('[JUNK_FILENAME]')));
  }
  for (const p of ['src/deep-copy.ts', 'src/db-backup.ts', 'src/temp-sensor.ts', 'src/orderRepository.ts']) {
    assert.equal(checkContent(p, 'export const ok = 1;\n', DEFAULT_CONFIG).errors.length, 0);
  }
  const deepRes = checkContent('a/b/c/d/file.ts', 'export const x = 1;\n', { ...DEFAULT_CONFIG, maxDirDepth: 3 });
  assert.ok(deepRes.warnings.some((w) => w.includes('[DIR_DEPTH]')));
});

test('supports inline suppression for single or multiple rules only when a reason is provided', () => {
  const validSuppress = '// vet-ignore-next-line TS_STRICT -- third-party untyped payload\nconst raw: any = {};\n';
  assert.equal(checkContent('src/ext.ts', validSuppress, DEFAULT_CONFIG).errors.length, 0);

  const multiSuppress = [
    '// vet-ignore-next-line SECRET, LINE_LENGTH -- long mock key fixture for unit test',
    `const mock = "${'AKIA'}${'1234567890ABCDEF'}_${'x'.repeat(130)}";`,
  ].join('\n');
  const multiRes = checkContent('src/auth.test.ts', multiSuppress, DEFAULT_CONFIG);
  assert.equal(multiRes.errors.length, 0);
  assert.equal(multiRes.warnings.length, 0);

  const missingReason = '// vet-ignore-next-line TS_STRICT\nconst raw: any = {};\n';
  assert.ok(checkContent('src/ext.ts', missingReason, DEFAULT_CONFIG).errors.some((e) => e.includes('[TS_STRICT]')));
});
