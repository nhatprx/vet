import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_CONFIG } from './rules.mjs';

export function loadConfig(rootDir) {
  const configPath = path.join(rootDir, 'ponytail.config.json');
  if (!fs.existsSync(configPath)) return { ...DEFAULT_CONFIG };
  const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  return { ...DEFAULT_CONFIG, ...parsed };
}

function buildFilters(rootDir, config) {
  const extSet = new Set([
    ...(config.extensions || []).map((e) => e.toLowerCase()),
    ...(config.docExtensions || []).map((e) => e.toLowerCase()),
  ]);
  const ignoreDirs = new Set(config.ignoreDirs || []);
  const ignoreFiles = new Set((config.ignoreFiles || []).map((f) => f.replaceAll('\\', '/')));
  const includeRoots = (config.include || ['.']).map((inc) => path.resolve(rootDir, inc));
  return { extSet, ignoreDirs, ignoreFiles, includeRoots };
}

function isWithinIncludes(fullPath, includeRoots) {
  return includeRoots.some((incRoot) => {
    const rel = path.relative(incRoot, fullPath);
    return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
  });
}

function getStagedRelPaths(rootDir) {
  const out = execFileSync(
    'git',
    ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'],
    { cwd: rootDir, encoding: 'utf8' },
  );
  return out.split('\0').filter(Boolean);
}

function readStagedContent(rootDir, relPath) {
  return execFileSync('git', ['show', `:${relPath}`], {
    cwd: rootDir,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
}

export function collectFiles(rootDir, config, { stagedOnly = false } = {}) {
  const { extSet, ignoreDirs, ignoreFiles, includeRoots } = buildFilters(rootDir, config);
  const entries = [];
  const seen = new Set();

  if (stagedOnly) {
    for (const rawRel of getStagedRelPaths(rootDir)) {
      const rel = rawRel.replaceAll('\\', '/');
      const fullPath = path.resolve(rootDir, rel);
      if (seen.has(fullPath) || ignoreFiles.has(rel)) continue;
      if (!isWithinIncludes(fullPath, includeRoots)) continue;
      if (rel.split('/').some((seg) => ignoreDirs.has(seg))) continue;
      if (!extSet.has(path.extname(rel).toLowerCase())) continue;
      seen.add(fullPath);
      entries.push({ relPath: rel, content: readStagedContent(rootDir, rel) });
    }
    return entries;
  }

  function addFile(fullPath) {
    const resolved = path.resolve(fullPath);
    if (seen.has(resolved)) return;
    const rel = path.relative(rootDir, resolved).replaceAll('\\', '/');
    if (ignoreFiles.has(rel)) return;
    if (!extSet.has(path.extname(resolved).toLowerCase())) return;
    seen.add(resolved);
    entries.push({ relPath: rel, content: fs.readFileSync(resolved, 'utf8') });
  }

  function walk(target) {
    let stat;
    try {
      stat = fs.lstatSync(target);
    } catch {
      return;
    }
    if (stat.isSymbolicLink()) return;
    if (stat.isFile()) {
      addFile(target);
      return;
    }
    if (!stat.isDirectory()) return;

    for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
      if (entry.isSymbolicLink() || ignoreDirs.has(entry.name)) continue;
      const fullPath = path.join(target, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        addFile(fullPath);
      }
    }
  }

  for (const incRoot of includeRoots) {
    walk(incRoot);
  }
  return entries;
}
