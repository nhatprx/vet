import path from 'node:path';
import {
  CONFLICT_END_RE,
  CONFLICT_MID_RE,
  CONFLICT_START_RE,
  EMOJI_RE,
  ENV_FILE_RE,
  ENV_SAFE_RE,
  IGNORE_NEXT_LINE_RE,
  JUNK_FILENAME_RE,
  SECRET_PATTERNS,
  lineNumberAt,
} from './patterns.mjs';

export function buildSuppressionMap(lines, commentLines) {
  const map = new Map();
  const source = commentLines || lines;
  for (let i = 0; i < source.length; i++) {
    const match = IGNORE_NEXT_LINE_RE.exec(source[i]);
    if (match) {
      map.set(i + 2, match[1]);
    }
  }
  return map;
}

export function isSuppressed(suppressions, lineNo, ruleId) {
  return suppressions.get(lineNo) === ruleId;
}

export function checkUniversalGuards(relPath, content, lines, config, suppressions, errors, warnings) {
  const base = path.basename(relPath);

  if (config.banEnvFiles && ENV_FILE_RE.test(base) && !ENV_SAFE_RE.test(base)) {
    errors.push(`[ENV_FILE] ${relPath}: do not commit environment files containing secrets`);
  }

  if (config.banJunkFilenames && JUNK_FILENAME_RE.test(base)) {
    errors.push(`[JUNK_FILENAME] ${relPath}: avoid temporary, backup, copy, or vague filenames`);
  }

  if (config.maxDirDepth > 0) {
    const depth = relPath.split('/').length - 1;
    if (depth > config.maxDirDepth) {
      warnings.push(`[DIR_DEPTH] ${relPath}: nesting depth ${depth} exceeds maxDirDepth (${config.maxDirDepth})`);
    }
  }

  let inConflict = false;
  lines.forEach((line, index) => {
    const lineNo = index + 1;

    if (config.banEmoji && !isSuppressed(suppressions, lineNo, 'EMOJI') && EMOJI_RE.test(line)) {
      errors.push(`[EMOJI] ${relPath}:${lineNo}: emoji character detected`);
    }

    if (config.banSecrets && !isSuppressed(suppressions, lineNo, 'SECRET')) {
      for (const { name, regex } of SECRET_PATTERNS) {
        if (regex.test(line)) {
          errors.push(`[SECRET] ${relPath}:${lineNo}: potential hardcoded ${name} detected`);
        }
      }
    }

    if (config.banConflictMarkers) {
      if (CONFLICT_START_RE.test(line)) {
        inConflict = true;
        errors.push(`[CONFLICT] ${relPath}:${lineNo}: unresolved merge conflict marker`);
      } else if (inConflict && CONFLICT_MID_RE.test(line)) {
        errors.push(`[CONFLICT] ${relPath}:${lineNo}: unresolved merge conflict marker`);
      } else if (CONFLICT_END_RE.test(line)) {
        inConflict = false;
        errors.push(`[CONFLICT] ${relPath}:${lineNo}: unresolved merge conflict marker`);
      }
    }
  });
}

export function runCustomRules(relPath, ext, content, customRules, suppressions, errors, warnings) {
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
    const match = regex.exec(content);
    if (match) {
      const id = rule.id || 'CUSTOM_RULE';
      const lineNo = lineNumberAt(content, match.index);
      if (isSuppressed(suppressions, lineNo, id)) continue;
      const msg = rule.message || `matched forbidden pattern /${rule.pattern}/`;
      const bucket = rule.severity === 'warn' ? warnings : errors;
      bucket.push(`[${id}] ${relPath}:${lineNo}: ${msg}`);
    }
  }
}
