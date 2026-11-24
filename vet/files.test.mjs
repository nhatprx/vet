import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { collectFiles } from './files.mjs';
import { DEFAULT_CONFIG } from './rules.mjs';

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'vet-test-'));
}

test('workspace walk skips symlinks, deduplicates includes, and respects ignores', () => {
  const tmp = makeTempDir();
  try {
    fs.mkdirSync(path.join(tmp, 'src'), { recursive: true });
    fs.mkdirSync(path.join(tmp, 'dist'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'src', 'app.ts'), 'export const ok = 1;\n');
    fs.writeFileSync(path.join(tmp, 'src', 'skip.ts'), 'export const skip = 1;\n');
    fs.writeFileSync(path.join(tmp, 'dist', 'bundle.js'), 'var x = 1;\n');
    fs.symlinkSync(path.join(tmp, 'src'), path.join(tmp, 'src-link'));
    fs.symlinkSync(path.join(tmp, 'missing.ts'), path.join(tmp, 'broken.ts'));

    const cfg = {
      ...DEFAULT_CONFIG,
      include: ['.', 'src'],
      ignoreFiles: ['src/skip.ts'],
    };
    const entries = collectFiles(tmp, cfg);
    const rels = entries.map((e) => e.relPath);
    assert.deepEqual(rels, ['src/app.ts']);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('staged mode reads git index content, handles spaces, and respects include', () => {
  const tmp = makeTempDir();
  try {
    execFileSync('git', ['init'], { cwd: tmp, stdio: 'ignore' });
    fs.mkdirSync(path.join(tmp, 'src'), { recursive: true });
    fs.mkdirSync(path.join(tmp, 'other'), { recursive: true });

    const spacedFile = path.join(tmp, 'src', 'my module.ts');
    const excludedFile = path.join(tmp, 'other', 'ignored.ts');
    fs.writeFileSync(spacedFile, 'export const v = 1;\n');
    fs.writeFileSync(excludedFile, 'export const x: any = 1;\n');

    execFileSync('git', ['add', 'src/my module.ts', 'other/ignored.ts'], {
      cwd: tmp,
      stdio: 'ignore',
    });

    // Modify working tree after staging to verify index content is read instead
    fs.writeFileSync(spacedFile, 'export const v: any = 2;\n');

    const cfg = { ...DEFAULT_CONFIG, include: ['src'] };
    const entries = collectFiles(tmp, cfg, { stagedOnly: true });
    assert.equal(entries.length, 1);
    assert.equal(entries[0].relPath, 'src/my module.ts');
    assert.equal(entries[0].content, 'export const v = 1;\n');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
