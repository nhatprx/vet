export const EMOJI_RE = /\p{Extended_Pictographic}|\p{Regional_Indicator}{2}/u;
export const TS_EXTS = new Set(['.ts', '.tsx']);
export const JS_TS_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
export const PY_EXTS = new Set(['.py']);
export const JVM_EXTS = new Set(['.java', '.kt']);

export const TS_DIRECTIVE_RE = /@ts-(?:ignore|nocheck)\b/;
export const TS_ANY_RE = /(?::\s*any\b|\bas\s+any\b|\bany\s*\[\s*\]|<any>|\b[A-Za-z_$][\w$]*\s*<[^>\n=/]*\bany\b[^>\n=/]*>)/;
export const HTML_ENTITY_RE = /&(?:#\d+|#x[\da-fA-F]+|[a-zA-Z]+);/g;
export const TS_TYPE_MEMBER_RE = /\b\w+\??\s*:\s*[^;{}()=]+;/g;
export const FOR_LOOP_RE = /\bfor\s*\(/;
export const IMPORT_EXPORT_RE = /^\s*(?:import|export|package)\b/;

export const CONFLICT_START_RE = /^<{7}\s/;
export const CONFLICT_MID_RE = /^={7}$/;
export const CONFLICT_END_RE = /^>{7}\s/;

export const TEST_ONLY_RE = /\b(?:test|it|describe|suite)\.only\s*\(|\b(?:fit|fdescribe)\s*\(/;
export const TEST_SKIP_JS_RE = /\b(?:test|it|describe|suite)\.skip\s*\(|\b(?:xit|xdescribe)\s*\(/;
export const TEST_SKIP_PY_RE = /@pytest\.mark\.skip\b/;
export const TEST_SKIP_JVM_RE = /@(?:Disabled|Ignore)\b/;

export const DEBUGGER_JS_RE = /(?:^|[;{}])\s*debugger\s*(?:;|}|$)/;
export const DEBUGGER_PY_RE = /\b(?:breakpoint|pdb\.set_trace)\s*\(/;
export const EMPTY_CATCH_BRACE_RE = /\bcatch\s*(?:\([^)]*\))?\s*\{\s*\}/g;
export const EMPTY_EXCEPT_PY_RE = /^[ \t]*except(?:\s+[^:\n]+)?:\s*(?:pass\b|\r?\n[ \t]+pass\b)/gm;

export const JUNK_FILENAME_RE = /^(?:temp|tmp|misc|untitled|newfile)\d*(?:\.|$)|(?:[-_.](?:old|bak|orig|tmp)|\.backup|\scopy(?:\s*\d*)?)(?=\.|$)/i;
export const TEST_FILE_RE = /(?:^|\/)(?:test_[^/]+|[^/]+(?:[._-](?:test|spec))\.[^/.]+)$/i;
export const ENV_FILE_RE = /^\.env(?:\..+)?$/i;
export const ENV_SAFE_RE = /^\.env\.(?:example|template|sample|dist|schema)$/i;
export const IGNORE_NEXT_LINE_RE = /vet-ignore-next-line\s+([A-Z0-9_]+(?:\s*,\s*[A-Z0-9_]+)*)\s+--\s+\S/;

export const SECRET_PATTERNS = [
  { name: 'AWS access key', regex: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'GitHub token', regex: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b/ },
  { name: 'GitHub PAT', regex: /\bgithub_pat_[A-Za-z0-9_]{22,}\b/ },
  { name: 'API secret key', regex: /\b(?:sk-(?:live|proj|ant)|rk_live)_[A-Za-z0-9_-]{16,}\b|\bsk-(?:live|proj|ant)-[A-Za-z0-9_-]{20,}\b/ },
  { name: 'Google API key', regex: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { name: 'Slack token', regex: /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/ },
  { name: 'npm token', regex: /\bnpm_[A-Za-z0-9]{36}\b/ },
  { name: 'SendGrid key', regex: /\bSG\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/ },
  { name: 'Database credential URL', regex: /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^:\s/@]+:[^@\s/]+@/ },
  { name: 'JWT token', regex: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/ },
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

export function lineNumberAt(content, index) {
  let line = 1;
  for (let i = 0; i < index && i < content.length; i++) {
    if (content[i] === '\n') line++;
  }
  return line;
}
