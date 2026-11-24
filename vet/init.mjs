#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const EXCLUDE_START = '# >>> vet-local (do not commit)';
const EXCLUDE_END = '# <<< vet-local';

const ADAPTER_POINTER = [
  '# Engineering Rules',
  '',
  'Follow all rules in [AGENTS.md](./AGENTS.md) as the single source of truth.',
  '',
].join('\n');

const CURSOR_MDC = [
  '---',
  'description: Vet universal engineering rules',
  'alwaysApply: true',
  '---',
  '',
  'Follow all rules in `AGENTS.md` at the repository root as the single source of truth.',
  '',
].join('\n');

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function copyIfMissing(src, dest) {
  if (fs.existsSync(dest)) return false;
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
  return true;
}

function writeIfMissing(dest, content) {
  if (fs.existsSync(dest)) return false;
  ensureDir(path.dirname(dest));
  fs.writeFileSync(dest, content, 'utf8');
  return true;
}

function copyLocalKit(resolvedKit, resolvedTarget) {
  const localKit = path.join(resolvedTarget, '.vet');
  fs.cpSync(path.join(resolvedKit, 'vet'), path.join(localKit, 'vet'), { recursive: true });
  fs.cpSync(path.join(resolvedKit, '.githooks'), path.join(localKit, '.githooks'), { recursive: true });
  for (const hook of ['pre-commit', 'commit-msg']) {
    const hookFile = path.join(localKit, '.githooks', hook);
    if (fs.existsSync(hookFile)) fs.chmodSync(hookFile, 0o755);
  }
}

function updateGitExclude(targetDir, entries) {
  const excludePath = path.join(targetDir, '.git', 'info', 'exclude');
  ensureDir(path.dirname(excludePath));
  const existing = fs.existsSync(excludePath) ? fs.readFileSync(excludePath, 'utf8') : '';
  const blockRegex = new RegExp(`${EXCLUDE_START}[\\s\\S]*?${EXCLUDE_END}\\r?\\n?`, 'g');
  const cleaned = existing.replace(blockRegex, '').trimEnd();
  const block = [EXCLUDE_START, ...entries, EXCLUDE_END].join('\n');
  const next = cleaned ? `${cleaned}\n\n${block}\n` : `${block}\n`;
  fs.writeFileSync(excludePath, next, 'utf8');
}

function resolveKitRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
}

function isMainModule() {
  if (!process.argv[1]) return false;
  try {
    return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(process.argv[1]);
  } catch {
    return false;
  }
}

export function initProject({
  targetDir = process.cwd(),
  kitRoot = resolveKitRoot(),
  shared = false,
  adapters = false,
} = {}) {
  const resolvedTarget = path.resolve(targetDir);
  const resolvedKit = path.resolve(kitRoot);
  const isGitRepo = fs.existsSync(path.join(resolvedTarget, '.git'));
  const relKit = path.relative(resolvedTarget, resolvedKit).replaceAll('\\', '/');
  const kitInsideTarget = relKit && !relKit.startsWith('..') && !path.isAbsolute(relKit);

  const created = [];
  const excluded = [];

  if (copyIfMissing(path.join(resolvedKit, 'AGENTS.md'), path.join(resolvedTarget, 'AGENTS.md'))) {
    created.push('AGENTS.md');
    excluded.push('AGENTS.md');
  }
  if (copyIfMissing(path.join(resolvedKit, 'vet.config.json'), path.join(resolvedTarget, 'vet.config.json'))) {
    created.push('vet.config.json');
    excluded.push('vet.config.json');
  }

  if (adapters) {
    if (writeIfMissing(path.join(resolvedTarget, 'CLAUDE.md'), ADAPTER_POINTER)) {
      created.push('CLAUDE.md');
      excluded.push('CLAUDE.md');
    }
    if (writeIfMissing(path.join(resolvedTarget, '.github', 'copilot-instructions.md'), ADAPTER_POINTER)) {
      created.push('.github/copilot-instructions.md');
      excluded.push('.github/copilot-instructions.md');
    }
    if (writeIfMissing(path.join(resolvedTarget, '.cursor', 'rules', 'vet.mdc'), CURSOR_MDC)) {
      created.push('.cursor/rules/vet.mdc');
      excluded.push('.cursor/rules/vet.mdc');
    }
  }

  if (shared) {
    if (!kitInsideTarget) {
      fs.cpSync(path.join(resolvedKit, 'vet'), path.join(resolvedTarget, 'vet'), { recursive: true });
      fs.cpSync(path.join(resolvedKit, '.githooks'), path.join(resolvedTarget, '.githooks'), { recursive: true });
      copyIfMissing(
        path.join(resolvedKit, '.github', 'workflows', 'vet.yml'),
        path.join(resolvedTarget, '.github', 'workflows', 'vet.yml'),
      );
      created.push('vet/', '.githooks/', '.github/workflows/vet.yml');
    }
    if (isGitRepo) execFileSync('git', ['config', 'core.hooksPath', '.githooks'], { cwd: resolvedTarget });
    return { mode: 'shared', created, excluded: [] };
  }

  if (!isGitRepo) {
    throw new Error(`Not a Git repository: ${resolvedTarget}. Run "git init" first or use --shared.`);
  }
  const localDir = kitInsideTarget ? relKit : '.vet';
  if (!kitInsideTarget) {
    copyLocalKit(resolvedKit, resolvedTarget);
    created.push('.vet/');
  }
  excluded.push(`${localDir}/`);
  const hooksRel = `${localDir}/.githooks`;
  updateGitExclude(resolvedTarget, [...new Set(excluded)]);
  execFileSync('git', ['config', 'core.hooksPath', hooksRel], { cwd: resolvedTarget });
  return { mode: 'local', created, excluded: [...new Set(excluded)], hooksPath: hooksRel };
}

if (isMainModule()) {
  const args = new Set(process.argv.slice(2));
  if (args.has('-h') || args.has('--help')) {
    console.log('Usage: npx @nhatprx/vet [--local | --shared] [--adapters]');
    process.exit(0);
  }
  try {
    const res = initProject({ shared: args.has('--shared'), adapters: args.has('--adapters') });
    console.log(`vet initialized (${res.mode} mode).`);
    if (res.created.length) console.log(`  created: ${res.created.join(', ')}`);
    if (res.excluded.length) console.log(`  git-excluded (local only): ${res.excluded.join(', ')}`);
    if (res.hooksPath) console.log(`  core.hooksPath: ${res.hooksPath}`);
  } catch (err) {
    console.error(`vet init error: ${err.message}`);
    process.exit(1);
  }
}
