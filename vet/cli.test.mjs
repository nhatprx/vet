import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { checkCommitMessage } from './commit-msg.mjs';
import { collectFiles, loadConfig } from './files.mjs';
import { formatOutput } from './formatters.mjs';
import { initProject } from './init.mjs';
import { DEFAULT_CONFIG } from './rules.mjs';

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'vet-cli-'));
}

test('formatOutput avoids duplicate warnings in strict mode and supports github/json formats', () => {
  const strictRes = formatOutput({
    format: 'text',
    checkedCount: 1,
    modeLabel: '',
    errors: [],
    warnings: ['[LINE_LENGTH] src/a.ts:5: 150 chars (limit <= 140)'],
    strictMode: true,
  });
  assert.equal(strictRes.ok, false);
  assert.equal(strictRes.stderr.match(/\[LINE_LENGTH\]/g).length, 1);

  const ghRes = formatOutput({
    format: 'github',
    checkedCount: 1,
    modeLabel: '',
    errors: ['[TS_STRICT] src/a.ts:3: forbidden any'],
    warnings: [],
    strictMode: false,
  });
  assert.ok(ghRes.stdout.includes('::error file=src/a.ts,line=3::[TS_STRICT] forbidden any'));

  const jsonRes = formatOutput({
    format: 'json',
    checkedCount: 2,
    modeLabel: '',
    errors: [],
    warnings: [],
    strictMode: false,
  });
  assert.equal(JSON.parse(jsonRes.stdout).ok, true);
  assert.equal(JSON.parse(jsonRes.stdout).checkedFiles, 2);
});

test('loadConfig rejects unknown keys and malformed JSON', () => {
  const tmp = makeTempDir();
  try {
    fs.writeFileSync(path.join(tmp, 'vet.config.json'), '{"unknownKey": true}');
    assert.throws(() => loadConfig(tmp), /Unknown vet\.config\.json key/);

    fs.writeFileSync(path.join(tmp, 'vet.config.json'), '{bad json');
    assert.throws(() => loadConfig(tmp), /Invalid JSON/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('checkCommitMessage enforces non-empty, zero-emoji, conflict-free messages', () => {
  assert.equal(checkCommitMessage('feat: add strict lexer\n# comment\n').length, 0);
  assert.ok(checkCommitMessage('# only comments\n').length > 0);
  assert.ok(checkCommitMessage('feat: ship \u{1F680}\n').length > 0);
  assert.ok(checkCommitMessage('feat: flag \u{1F1FA}\u{1F1F8}\n').length > 0);
});

test('collectFiles supports glob ignoreFiles and skips staged symlinks', () => {
  const tmp = makeTempDir();
  try {
    execFileSync('git', ['init'], { cwd: tmp, stdio: 'ignore' });
    fs.mkdirSync(path.join(tmp, 'src', 'gen'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'src', 'app.ts'), 'export const a = 1;\n');
    fs.writeFileSync(path.join(tmp, 'src', 'gen', 'api.generated.ts'), 'export const g: any = 1;\n');
    fs.symlinkSync('app.ts', path.join(tmp, 'src', 'link.ts'));
    execFileSync('git', ['add', 'src/app.ts', 'src/gen/api.generated.ts', 'src/link.ts'], { cwd: tmp, stdio: 'ignore' });

    const cfg = { ...DEFAULT_CONFIG, ignoreFiles: ['**/*.generated.ts'] };
    const staged = collectFiles(tmp, cfg, { stagedOnly: true });
    assert.deepEqual(staged.map((e) => e.relPath), ['src/app.ts']);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('initProject local mode excludes all vet files via .git/info/exclude leaving git status clean', () => {
  const tmp = makeTempDir();
  const kitSrc = path.resolve(process.cwd());
  try {
    execFileSync('git', ['init'], { cwd: tmp, stdio: 'ignore' });
    const clonedKit = path.join(tmp, '.vet');
    fs.mkdirSync(clonedKit, { recursive: true });
    fs.copyFileSync(path.join(kitSrc, 'AGENTS.md'), path.join(clonedKit, 'AGENTS.md'));
    fs.copyFileSync(path.join(kitSrc, 'vet.config.json'), path.join(clonedKit, 'vet.config.json'));
    fs.cpSync(path.join(kitSrc, '.githooks'), path.join(clonedKit, '.githooks'), { recursive: true });

    const res = initProject({ targetDir: tmp, kitRoot: clonedKit, adapters: true });
    assert.equal(res.mode, 'local');
    assert.equal(res.hooksPath, '.vet/.githooks');
    assert.ok(fs.existsSync(path.join(tmp, 'AGENTS.md')));
    assert.ok(fs.existsSync(path.join(tmp, 'CLAUDE.md')));
    assert.ok(fs.existsSync(path.join(tmp, '.cursor', 'rules', 'vet.mdc')));

    const status = execFileSync('git', ['status', '--porcelain'], { cwd: tmp, encoding: 'utf8' }).trim();
    assert.equal(status, '');
    const hooksPath = execFileSync('git', ['config', '--get', 'core.hooksPath'], { cwd: tmp, encoding: 'utf8' }).trim();
    assert.equal(hooksPath, '.vet/.githooks');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('initProject from external kit (npx mode) copies self-contained .vet/ and stays git-excluded', () => {
  const tmp = makeTempDir();
  const kitSrc = path.resolve(process.cwd());
  try {
    execFileSync('git', ['init'], { cwd: tmp, stdio: 'ignore' });
    const res = initProject({ targetDir: tmp, kitRoot: kitSrc, adapters: false });
    assert.equal(res.mode, 'local');
    assert.equal(res.hooksPath, '.vet/.githooks');
    assert.ok(fs.existsSync(path.join(tmp, '.vet', 'vet', 'check.mjs')));
    assert.ok(fs.existsSync(path.join(tmp, '.vet', '.githooks', 'pre-commit')));

    const status = execFileSync('git', ['status', '--porcelain'], { cwd: tmp, encoding: 'utf8' }).trim();
    assert.equal(status, '');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
