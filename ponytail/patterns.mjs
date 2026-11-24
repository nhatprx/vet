export const EMOJI_RE = /\p{Extended_Pictographic}/u;
export const TS_EXTS = new Set(['.ts', '.tsx']);
export const JS_TS_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

export const TS_DIRECTIVE_RE = /@ts-(?:ignore|nocheck)\b/;
export const TS_ANY_RE = /(?::\s*any\b|\bas\s+any\b|<[^>\n]*\bany\b[^>\n]*>|\bany\s*\[\s*\])/;
export const COMMENT_LINE_RE = /^\s*(?:\/\/|\/\*|\*|#|--)/;
export const STRING_LITERAL_RE = /(['"`])(?:\\.|(?!\1).)*\1/g;
export const REGEX_LITERAL_RE = /(?<=^|[=(,:![&|?]\s*)\/(?:\\.|\[(?:\\.|[^\]\n\\])*\]|[^/\n\\])+\/[dgimsuvy]*/g;
export const INLINE_COMMENT_RE = /\/\/.*$|\/\*.*?\*\//g;
export const HTML_ENTITY_RE = /&(?:#\d+|#x[\da-fA-F]+|[a-zA-Z]+);/g;
export const TS_TYPE_MEMBER_RE = /\b\w+\??\s*:\s*[^;{}()=]+;/g;
export const FOR_LOOP_RE = /\bfor\s*\(/;
export const IMPORT_EXPORT_RE = /^\s*(?:import|export|package)\b/;

export const CONFLICT_MARKER_RE = /^(?:<{7}\s|={7}$|>{7}\s)/;
export const TEST_ONLY_RE = /\b(?:test|it|describe|suite)\.only\s*\(|\b(?:fit|fdescribe)\s*\(/;
export const DEBUGGER_RE = /(?:^|[;{}])\s*debugger\s*(?:;|}|$)/;
export const EMPTY_CATCH_RE = /\bcatch\s*(?:\([^)]*\))?\s*\{\s*\}/;
export const JUNK_FILENAME_RE = /^(?:temp|tmp|misc|untitled|newfile)(?:[-_.]|$)|(?:[-_.](?:old|bak|backup|copy|orig|tmp))(?=\.|$)|\scopy(?=\.|$)/i;

export const SECRET_PATTERNS = [
  { name: 'AWS access key', regex: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'GitHub token', regex: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b/ },
  { name: 'GitHub PAT', regex: /\bgithub_pat_[A-Za-z0-9_]{22,}\b/ },
  { name: 'API secret key', regex: /\bsk-(?:live|proj|ant)-[A-Za-z0-9_-]{20,}\b/ },
  { name: 'Google API key', regex: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { name: 'Slack token', regex: /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/ },
  { name: 'Private key block', regex: /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----/ },
];

export function splitLines(content) {
  if (content.length === 0) return [];
  const trimmed = content.endsWith('\r\n')
    ? content.slice(0, -2)
    : content.endsWith('\n')
      ? content.slice(0, -1)
      : content;
  return trimmed.split(/\r?\n/);
}

export function stripStrings(text) {
  return text.replace(STRING_LITERAL_RE, '""');
}

export function stripStringsAndComments(line) {
  return stripStrings(line)
    .replace(REGEX_LITERAL_RE, '""')
    .replace(INLINE_COMMENT_RE, '');
}
