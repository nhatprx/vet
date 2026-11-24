import { JS_TS_EXTS, PY_EXTS } from './patterns.mjs';

const REGEX_PREV_CHAR_RE = /[=(,:![&|?{};\n]/;

function canStartRegex(codeBuf) {
  for (let i = codeBuf.length - 1; i >= 0; i--) {
    const ch = codeBuf[i];
    if (ch === ' ' || ch === '\t') continue;
    return REGEX_PREV_CHAR_RE.test(ch);
  }
  return true;
}

export function tokenizeSource(content, ext) {
  const isPy = PY_EXTS.has(ext);
  const isJs = JS_TS_EXTS.has(ext);
  const code = [];
  const comments = [];
  let mode = 'code';
  let quote = '';
  let inCharClass = false;

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    const next = content[i + 1] || '';

    if (ch === '\r') continue;
    if (ch === '\n') {
      code.push('\n');
      comments.push('\n');
      if (mode === 'line_comment' || mode === 'regex' || (mode === 'string' && quote !== '`')) {
        mode = 'code';
        inCharClass = false;
      }
      continue;
    }

    if (mode === 'line_comment') {
      code.push(' ');
      comments.push(ch);
      continue;
    }
    if (mode === 'block_comment') {
      code.push(' ');
      comments.push(ch);
      if (ch === '*' && next === '/') {
        code.push(' ');
        comments.push('/');
        i++;
        mode = 'code';
      }
      continue;
    }
    if (mode === 'string') {
      code.push(' ');
      comments.push(' ');
      if (ch === '\\' && next && next !== '\n') {
        code.push(' ');
        comments.push(' ');
        i++;
      } else if (ch === quote) {
        mode = 'code';
      }
      continue;
    }
    if (mode === 'regex') {
      code.push(' ');
      comments.push(' ');
      if (ch === '\\' && next && next !== '\n') {
        code.push(' ');
        comments.push(' ');
        i++;
      } else if (ch === '[') {
        inCharClass = true;
      } else if (ch === ']') {
        inCharClass = false;
      } else if (ch === '/' && !inCharClass) {
        mode = 'code';
      }
      continue;
    }

    if (!isPy && ch === '/' && next === '/') {
      mode = 'line_comment';
      code.push(' ', ' ');
      comments.push('/', '/');
      i++;
      continue;
    }
    if (!isPy && ch === '/' && next === '*') {
      mode = 'block_comment';
      code.push(' ', ' ');
      comments.push('/', '*');
      i++;
      continue;
    }
    if (isPy && ch === '#') {
      mode = 'line_comment';
      code.push(' ');
      comments.push('#');
      continue;
    }
    if (ch === '\'' || ch === '"' || (isJs && ch === '`')) {
      mode = 'string';
      quote = ch;
      code.push(' ');
      comments.push(' ');
      continue;
    }
    if (isJs && ch === '/' && next !== '/' && next !== '*' && canStartRegex(code)) {
      mode = 'regex';
      inCharClass = false;
      code.push(' ');
      comments.push(' ');
      continue;
    }

    code.push(ch);
    comments.push(' ');
  }

  const strippedContent = code.join('');
  const commentContent = comments.join('');
  return {
    strippedContent,
    commentContent,
    codeLines: strippedContent.split('\n'),
    commentLines: commentContent.split('\n'),
  };
}
