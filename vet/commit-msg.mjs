import fs from 'node:fs';
import {
  CONFLICT_END_RE,
  CONFLICT_START_RE,
  EMOJI_RE,
  splitLines,
} from './patterns.mjs';

export function checkCommitMessage(rawMessage) {
  const errors = [];
  const lines = splitLines(rawMessage).filter((line) => !line.startsWith('#'));
  const body = lines.join('\n').trim();

  if (!body) {
    errors.push('[COMMIT_MSG] commit message must not be empty');
    return errors;
  }
  if (EMOJI_RE.test(body)) {
    errors.push('[COMMIT_MSG] emojis are forbidden in commit messages');
  }
  if (lines.some((line) => CONFLICT_START_RE.test(line) || CONFLICT_END_RE.test(line))) {
    errors.push('[COMMIT_MSG] unresolved merge conflict marker found in commit message');
  }
  return errors;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const msgPath = process.argv[2];
  if (!msgPath || !fs.existsSync(msgPath)) {
    console.error('vet commit-msg error: missing commit message file path.');
    process.exit(2);
  }
  const errors = checkCommitMessage(fs.readFileSync(msgPath, 'utf8'));
  if (errors.length > 0) {
    console.error(`vet commit-msg check failed:\n${errors.join('\n')}`);
    process.exit(1);
  }
}
