import path from 'node:path';
import { tokenizeSource } from './lexer.mjs';
import {
  DEBUGGER_JS_RE,
  DEBUGGER_PY_RE,
  EMPTY_CATCH_BRACE_RE,
  EMPTY_EXCEPT_PY_RE,
  FOR_LOOP_RE,
  HTML_ENTITY_RE,
  IMPORT_EXPORT_RE,
  JS_TS_EXTS,
  JVM_EXTS,
  PY_EXTS,
  TEST_FILE_RE,
  TEST_ONLY_RE,
  TEST_SKIP_JS_RE,
  TEST_SKIP_JVM_RE,
  TEST_SKIP_PY_RE,
  TS_ANY_RE,
  TS_DIRECTIVE_RE,
  TS_EXTS,
  TS_TYPE_MEMBER_RE,
  lineNumberAt,
  splitLines,
} from './patterns.mjs';
import {
  buildSuppressionMap,
  checkUniversalGuards,
  isSuppressed,
  runCustomRules,
} from './universalGuards.mjs';

export const DEFAULT_CONFIG = {
  maxLoc: 200,
  warnLoc: 175,
  testMaxLoc: 400,
  maxLineLength: 140,
  maxStatementsPerLine: 2,
  banEmoji: true,
  banTsAny: true,
  banSecrets: true,
  banEnvFiles: true,
  banConflictMarkers: true,
  banTestOnly: true,
  banTestSkip: 'warn',
  banDebugger: true,
  banEmptyCatch: true,
  banJunkFilenames: true,
  maxDirDepth: 0,
  include: ['.'],
  extensions: [
    '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
    '.java', '.kt', '.py', '.go', '.rs', '.css', '.scss', '.sql',
  ],
  docExtensions: ['.md', '.mdx', '.txt'],
  configExtensions: ['.json', '.yml', '.yaml', '.toml', '.sh'],
  ignoreDirs: [
    '.git', '.vet', 'node_modules', 'dist', 'build', 'target', 'out',
    '.next', '.turbo', 'coverage', '__pycache__', '.venv', 'venv',
  ],
  ignoreFiles: ['**/*.generated.*', '**/*.d.ts'],
  customRules: [],
};

const KNOWN_CONFIG_KEYS = new Set(Object.keys(DEFAULT_CONFIG));

export function validateConfig(parsed) {
  const unknown = Object.keys(parsed).filter((k) => !KNOWN_CONFIG_KEYS.has(k));
  if (unknown.length > 0) {
    throw new Error(`Unknown vet.config.json key(s): ${unknown.join(', ')}`);
  }
}

function checkEmptyCatches(relPath, ext, strippedContent, commentContent, suppressions, errors) {
  const regex = PY_EXTS.has(ext)
    ? new RegExp(EMPTY_EXCEPT_PY_RE.source, 'gm')
    : (JS_TS_EXTS.has(ext) || JVM_EXTS.has(ext))
      ? new RegExp(EMPTY_CATCH_BRACE_RE.source, 'g')
      : null;
  if (!regex) return;
  for (const match of strippedContent.matchAll(regex)) {
    const insideComment = commentContent.slice(match.index, match.index + match[0].length).trim();
    if (insideComment.length > 0) continue;
    const lineNo = lineNumberAt(strippedContent, match.index);
    if (!isSuppressed(suppressions, lineNo, 'EMPTY_CATCH')) {
      errors.push(`[EMPTY_CATCH] ${relPath}:${lineNo}: empty catch/except block swallows errors silently`);
    }
  }
}

function checkSourceLine(relPath, ext, rawLine, codeLine, commentLine, lineNo, config, suppressions, errors, warnings) {
  if (config.banTsAny && TS_EXTS.has(ext) && !isSuppressed(suppressions, lineNo, 'TS_STRICT')) {
    if (TS_DIRECTIVE_RE.test(commentLine) || TS_ANY_RE.test(codeLine)) {
      errors.push(`[TS_STRICT] ${relPath}:${lineNo}: forbidden 'any' or '@ts-ignore/@ts-nocheck'`);
    }
  }
  if (config.banTestOnly && JS_TS_EXTS.has(ext) && !isSuppressed(suppressions, lineNo, 'TEST_ONLY')) {
    if (TEST_ONLY_RE.test(codeLine)) {
      errors.push(`[TEST_ONLY] ${relPath}:${lineNo}: remove focused test (.only/fit/fdescribe)`);
    }
  }
  if (config.banTestSkip && !isSuppressed(suppressions, lineNo, 'TEST_SKIP')) {
    const matched = (JS_TS_EXTS.has(ext) && TEST_SKIP_JS_RE.test(codeLine))
      || (PY_EXTS.has(ext) && TEST_SKIP_PY_RE.test(codeLine))
      || (JVM_EXTS.has(ext) && TEST_SKIP_JVM_RE.test(codeLine));
    if (matched) {
      const bucket = config.banTestSkip === 'error' ? errors : warnings;
      bucket.push(`[TEST_SKIP] ${relPath}:${lineNo}: skipped test detected`);
    }
  }
  if (config.banDebugger && !isSuppressed(suppressions, lineNo, 'DEBUGGER')) {
    const hasDbg = (JS_TS_EXTS.has(ext) && DEBUGGER_JS_RE.test(codeLine))
      || (PY_EXTS.has(ext) && DEBUGGER_PY_RE.test(codeLine));
    if (hasDbg) errors.push(`[DEBUGGER] ${relPath}:${lineNo}: forbidden debugger statement`);
  }
  if (config.maxLineLength > 0 && rawLine.length > config.maxLineLength && !isSuppressed(suppressions, lineNo, 'LINE_LENGTH')) {
    if (!rawLine.includes('http://') && !rawLine.includes('https://') && !IMPORT_EXPORT_RE.test(rawLine)) {
      warnings.push(`[LINE_LENGTH] ${relPath}:${lineNo}: ${rawLine.length} chars (limit <= ${config.maxLineLength})`);
    }
  }
  if (config.maxStatementsPerLine > 0 && !FOR_LOOP_RE.test(codeLine) && ext !== '.css' && ext !== '.scss') {
    if (!isSuppressed(suppressions, lineNo, 'LINE_STUFFING')) {
      let stripped = codeLine.replace(HTML_ENTITY_RE, '');
      if (TS_EXTS.has(ext)) stripped = stripped.replace(TS_TYPE_MEMBER_RE, '');
      const semicolons = (stripped.match(/;/g) || []).length;
      if (semicolons > config.maxStatementsPerLine) {
        errors.push(`[LINE_STUFFING] ${relPath}:${lineNo}: ${semicolons} statements on one line (max ${config.maxStatementsPerLine})`);
      }
    }
  }
}

export function checkContent(relPath, content, config) {
  const errors = [];
  const warnings = [];
  const ext = path.extname(relPath).toLowerCase();
  const sourceExts = new Set((config.extensions || []).map((e) => e.toLowerCase()));
  const isSource = sourceExts.has(ext);
  const lines = splitLines(content);

  if (!isSource) {
    const suppressions = buildSuppressionMap(lines, null);
    checkUniversalGuards(relPath, content, lines, config, suppressions, errors, warnings);
    runCustomRules(relPath, ext, content, config.customRules, suppressions, errors, warnings);
    return { errors, warnings };
  }

  const { strippedContent, commentContent, codeLines, commentLines } = tokenizeSource(content, ext);
  const suppressions = buildSuppressionMap(lines, commentLines);
  checkUniversalGuards(relPath, content, lines, config, suppressions, errors, warnings);

  const isTestFile = TEST_FILE_RE.test(relPath);
  const maxLoc = isTestFile && config.testMaxLoc > 0 ? config.testMaxLoc : config.maxLoc;
  const warnLoc = isTestFile && config.testMaxLoc > 0 ? Math.floor(config.testMaxLoc * 0.875) : config.warnLoc;

  if (lines.length >= maxLoc) {
    errors.push(`[LOC] ${relPath}: ${lines.length} lines (limit < ${maxLoc})`);
  } else if (warnLoc && lines.length >= warnLoc) {
    warnings.push(`[LOC_WARN] ${relPath}: ${lines.length} lines (consider splitting before ${maxLoc})`);
  }
  if (config.banEmptyCatch) {
    checkEmptyCatches(relPath, ext, strippedContent, commentContent, suppressions, errors);
  }

  lines.forEach((rawLine, index) => {
    const codeLine = codeLines[index] || '';
    const commentLine = commentLines[index] || '';
    checkSourceLine(relPath, ext, rawLine, codeLine, commentLine, index + 1, config, suppressions, errors, warnings);
  });
  runCustomRules(relPath, ext, content, config.customRules, suppressions, errors, warnings);
  return { errors, warnings };
}
