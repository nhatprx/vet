import path from 'node:path';
import {
  COMMENT_LINE_RE,
  CONFLICT_MARKER_RE,
  DEBUGGER_RE,
  EMOJI_RE,
  EMPTY_CATCH_RE,
  FOR_LOOP_RE,
  HTML_ENTITY_RE,
  IMPORT_EXPORT_RE,
  JS_TS_EXTS,
  JUNK_FILENAME_RE,
  SECRET_PATTERNS,
  TEST_ONLY_RE,
  TS_ANY_RE,
  TS_DIRECTIVE_RE,
  TS_EXTS,
  TS_TYPE_MEMBER_RE,
  splitLines,
  stripStrings,
  stripStringsAndComments,
} from './patterns.mjs';

export const DEFAULT_CONFIG = {
  maxLoc: 200,
  warnLoc: 175,
  maxLineLength: 140,
  maxStatementsPerLine: 2,
  banEmoji: true,
  banTsAny: true,
  banSecrets: true,
  banConflictMarkers: true,
  banTestOnly: true,
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
  ignoreDirs: [
    '.git', 'node_modules', 'dist', 'build', 'target', 'out',
    '.next', '.turbo', 'coverage', '__pycache__', '.venv', 'venv',
  ],
  ignoreFiles: [],
  customRules: [],
};

function checkUniversalGuards(relPath, content, lines, config, errors, warnings) {
  if (config.banJunkFilenames && JUNK_FILENAME_RE.test(path.basename(relPath))) {
    errors.push(`[JUNK_FILENAME] ${relPath}: avoid temporary, backup, copy, or vague filenames`);
  }
  if (config.maxDirDepth > 0) {
    const depth = relPath.split('/').length - 1;
    if (depth > config.maxDirDepth) {
      warnings.push(`[DIR_DEPTH] ${relPath}: nesting depth ${depth} exceeds maxDirDepth (${config.maxDirDepth})`);
    }
  }
  if (config.banEmoji && EMOJI_RE.test(content)) {
    errors.push(`[EMOJI] ${relPath}: emoji character detected`);
  }
  if (config.banSecrets) {
    for (const { name, regex } of SECRET_PATTERNS) {
      if (regex.test(content)) {
        errors.push(`[SECRET] ${relPath}: potential hardcoded ${name} detected`);
      }
    }
  }
  if (config.banConflictMarkers) {
    lines.forEach((line, index) => {
      if (CONFLICT_MARKER_RE.test(line)) {
        errors.push(`[CONFLICT] ${relPath}:${index + 1}: unresolved merge conflict marker`);
      }
    });
  }
}

function runCustomRules(relPath, ext, content, customRules, errors, warnings) {
  for (const rule of customRules || []) {
    const exts = Array.isArray(rule.extensions) ? rule.extensions.map((e) => e.toLowerCase()) : [];
    if (exts.length > 0 && !exts.includes(ext)) continue;
    let regex;
    try {
      regex = new RegExp(rule.pattern, rule.flags || '');
    } catch (err) {
      errors.push(`[CUSTOM_RULE_CONFIG] ${rule.id || 'CUSTOM_RULE'}: invalid regex (${err.message})`);
      continue;
    }
    if (regex.test(content)) {
      const id = rule.id || 'CUSTOM_RULE';
      const msg = rule.message || `matched forbidden pattern /${rule.pattern}/`;
      const bucket = rule.severity === 'warn' ? warnings : errors;
      bucket.push(`[${id}] ${relPath}: ${msg}`);
    }
  }
}

function checkSourceLine(relPath, ext, line, lineNo, config, errors, warnings) {
  const isComment = COMMENT_LINE_RE.test(line);
  const codeOnly = isComment ? '' : stripStringsAndComments(line);

  if (config.banTsAny && TS_EXTS.has(ext)) {
    const hasDirective = TS_DIRECTIVE_RE.test(isComment ? line : stripStrings(line));
    if (hasDirective || (!isComment && TS_ANY_RE.test(codeOnly))) {
      errors.push(`[TS_STRICT] ${relPath}:${lineNo}: forbidden 'any' or '@ts-ignore/@ts-nocheck'`);
    }
  }
  if (config.banTestOnly && JS_TS_EXTS.has(ext) && !isComment && TEST_ONLY_RE.test(codeOnly)) {
    errors.push(`[TEST_ONLY] ${relPath}:${lineNo}: remove focused test (.only/fit/fdescribe)`);
  }
  if (config.banDebugger && JS_TS_EXTS.has(ext) && !isComment && DEBUGGER_RE.test(codeOnly)) {
    errors.push(`[DEBUGGER] ${relPath}:${lineNo}: forbidden debugger statement`);
  }
  if (config.maxLineLength > 0 && line.length > config.maxLineLength) {
    if (!line.includes('http://') && !line.includes('https://') && !IMPORT_EXPORT_RE.test(line)) {
      warnings.push(`[LINE_LENGTH] ${relPath}:${lineNo}: ${line.length} chars (limit <= ${config.maxLineLength})`);
    }
  }
  if (config.maxStatementsPerLine > 0 && !isComment && !FOR_LOOP_RE.test(line) && ext !== '.css' && ext !== '.scss') {
    let stripped = codeOnly.replace(HTML_ENTITY_RE, '');
    if (TS_EXTS.has(ext)) stripped = stripped.replace(TS_TYPE_MEMBER_RE, '');
    const semicolons = (stripped.match(/;/g) || []).length;
    if (semicolons > config.maxStatementsPerLine) {
      errors.push(`[LINE_STUFFING] ${relPath}:${lineNo}: ${semicolons} statements on one line (max ${config.maxStatementsPerLine})`);
    }
  }
}

export function checkContent(relPath, content, config) {
  const errors = [];
  const warnings = [];
  const ext = path.extname(relPath).toLowerCase();
  const sourceExts = new Set((config.extensions || []).map((e) => e.toLowerCase()));
  const docExts = new Set((config.docExtensions || []).map((e) => e.toLowerCase()));
  const isDocOnly = docExts.has(ext) && !sourceExts.has(ext);
  const lines = splitLines(content);

  checkUniversalGuards(relPath, content, lines, config, errors, warnings);
  if (isDocOnly) {
    runCustomRules(relPath, ext, content, config.customRules, errors, warnings);
    return { errors, warnings };
  }

  if (lines.length >= config.maxLoc) {
    errors.push(`[LOC] ${relPath}: ${lines.length} lines (limit < ${config.maxLoc})`);
  } else if (config.warnLoc && lines.length >= config.warnLoc) {
    warnings.push(`[LOC_WARN] ${relPath}: ${lines.length} lines (consider splitting before ${config.maxLoc})`);
  }
  if (config.banEmptyCatch && JS_TS_EXTS.has(ext) && EMPTY_CATCH_RE.test(stripStrings(content))) {
    errors.push(`[EMPTY_CATCH] ${relPath}: empty catch block swallows errors silently`);
  }

  lines.forEach((line, index) => checkSourceLine(relPath, ext, line, index + 1, config, errors, warnings));
  runCustomRules(relPath, ext, content, config.customRules, errors, warnings);
  return { errors, warnings };
}
