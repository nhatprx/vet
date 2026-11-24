import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ENV_FILE_RE } from './patterns.mjs';
import { DEFAULT_CONFIG, validateConfig } from './rules.mjs';

const SPECIAL_BASENAMES = new Set(['dockerfile']);

export function loadConfig(rootDir, customConfigPath = null) {
  const configPath = customConfigPath
    ? path.resolve(rootDir, customConfigPath)
    : path.join(rootDir, 'vet.config.json');
  if (!fs.existsSync(configPath)) {
    if (customConfigPath) throw new Error(`Config file not found: ${configPath}`);
    return { ...DEFAULT_CONFIG };
  }
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (err) {
    throw new Error(`Invalid JSON in ${configPath}: ${err.message}`);
  }
  validateConfig(parsed);
  return { ...DEFAULT_CONFIG, ...parsed };
}

function globToRegex(pattern) {
  const norm = pattern.replaceAll('\\', '/');
  let re = '^';
  for (let i = 0; i < norm.length; i++) {
    if (norm[i] === '*' && norm[i + 1] === '*') {
      re += norm[i + 2] === '/' ? '(?:.*/)?' : '.*';
      i += norm[i + 2] === '/' ? 2 : 1;
    } else if (norm[i] === '*') {
      re += '[^/]*';
    } else if (norm[i] === '?') {
      re += '[^/]';
    } else {
      re += norm[i].replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`${re}$`);
}

function buildFilters(rootDir, config, targets) {
  const extSet = new Set([
    ...(config.extensions || []).map((e) => e.toLowerCase()),
    ...(config.docExtensions || []).map((e) => e.toLowerCase()),
    ...(config.configExtensions || []).map((e) => e.toLowerCase()),
  ]);
  const ignoreDirs = new Set(config.ignoreDirs || []);
  const ignoreMatchers = (config.ignoreFiles || []).map(globToRegex);
  const rawIncludes = targets && targets.length > 0 ? targets : (config.include || ['.']);
  const includeRoots = rawIncludes.map((inc) => path.resolve(rootDir, inc));
  return { extSet, ignoreDirs, ignoreMatchers, includeRoots };
}

function isSupportedFile(relPath, extSet) {
  const base = path.basename(relPath);
  if (ENV_FILE_RE.test(base) || SPECIAL_BASENAMES.has(base.toLowerCase())) return true;
  return extSet.has(path.extname(base).toLowerCase());
}

function isIgnoredFile(relPath, ignoreMatchers) {
  return ignoreMatchers.some((re) => re.test(relPath));
}

function isWithinIncludes(fullPath, includeRoots) {
  return includeRoots.some((incRoot) => {
    const rel = path.relative(incRoot, fullPath);
    return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
  });
}

function runGit(rootDir, args) {
  try {
    return execFileSync('git', args, { cwd: rootDir, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  } catch (err) {
    throw new Error(`Git command failed (git ${args.join(' ')}): ${err.stderr || err.message}`.trim());
  }
}

function getStagedRelPaths(rootDir) {
  const out = runGit(rootDir, ['diff', '--cached', '--raw', '--diff-filter=ACMR', '-z']);
  const tokens = out.split('\0').filter(Boolean);
  const paths = [];
  for (let i = 0; i < tokens.length; i += 2) {
    const meta = tokens[i];
    const rel = tokens[i + 1];
    if (!rel) break;
    const newMode = meta.split(' ')[1] || '';
    if (newMode === '120000' || newMode === '160000') continue;
    paths.push(rel);
  }
  return paths;
}

function getDiffRelPaths(rootDir, baseRef) {
  const out = runGit(rootDir, ['diff', '--name-only', '--diff-filter=ACMR', '-z', `${baseRef}...HEAD`]);
  return out.split('\0').filter(Boolean);
}

export function collectFiles(rootDir, config, { stagedOnly = false, diffRef = null, targets = [] } = {}) {
  const { extSet, ignoreDirs, ignoreMatchers, includeRoots } = buildFilters(rootDir, config, targets);
  const entries = [];
  const seen = new Set();

  if (stagedOnly || diffRef) {
    const relPaths = stagedOnly ? getStagedRelPaths(rootDir) : getDiffRelPaths(rootDir, diffRef);
    for (const rawRel of relPaths) {
      const rel = rawRel.replaceAll('\\', '/');
      const fullPath = path.resolve(rootDir, rel);
      if (seen.has(fullPath) || isIgnoredFile(rel, ignoreMatchers)) continue;
      if (!isWithinIncludes(fullPath, includeRoots)) continue;
      if (rel.split('/').some((seg) => ignoreDirs.has(seg))) continue;
      if (!isSupportedFile(rel, extSet)) continue;
      if (!stagedOnly) {
        let stat;
        try { stat = fs.lstatSync(fullPath); } catch { continue; }
        if (!stat.isFile() || stat.isSymbolicLink()) continue;
      }
      seen.add(fullPath);
      const content = stagedOnly ? runGit(rootDir, ['show', `:${rel}`]) : fs.readFileSync(fullPath, 'utf8');
      entries.push({ relPath: rel, content });
    }
    return entries;
  }

  function addFile(fullPath) {
    const resolved = path.resolve(fullPath);
    if (seen.has(resolved)) return;
    const rel = path.relative(rootDir, resolved).replaceAll('\\', '/');
    if (isIgnoredFile(rel, ignoreMatchers) || !isSupportedFile(rel, extSet)) return;
    seen.add(resolved);
    entries.push({ relPath: rel, content: fs.readFileSync(resolved, 'utf8') });
  }

  function walk(target) {
    let stat;
    try { stat = fs.lstatSync(target); } catch { return; }
    if (stat.isSymbolicLink()) return;
    if (stat.isFile()) { addFile(target); return; }
    if (!stat.isDirectory()) return;
    for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
      if (entry.isSymbolicLink() || ignoreDirs.has(entry.name)) continue;
      const fullPath = path.join(target, entry.name);
      if (entry.isDirectory()) walk(fullPath);
      else if (entry.isFile()) addFile(fullPath);
    }
  }

  for (const incRoot of includeRoots) walk(incRoot);
  return entries;
}
