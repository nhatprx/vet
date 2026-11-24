import { collectFiles, loadConfig } from './files.mjs';
import { checkContent } from './rules.mjs';

const ROOT = process.cwd();
const ARGS = new Set(process.argv.slice(2));
const STAGED_ONLY = ARGS.has('--staged');
const STRICT_MODE = ARGS.has('--strict');

function main() {
  const config = loadConfig(ROOT);
  const files = collectFiles(ROOT, config, { stagedOnly: STAGED_ONLY });
  const allErrors = [];
  const allWarnings = [];

  for (const { relPath, content } of files) {
    const { errors, warnings } = checkContent(relPath, content, config);
    allErrors.push(...errors);
    allWarnings.push(...warnings);
  }

  if (allWarnings.length > 0) {
    console.warn(`ponytail warnings (${allWarnings.length}):\n` + allWarnings.join('\n'));
  }

  const failures = STRICT_MODE ? [...allErrors, ...allWarnings] : allErrors;
  if (failures.length > 0) {
    console.error(`ponytail compliance check failed (${failures.length}):\n` + failures.join('\n'));
    process.exit(1);
  }

  const mode = STAGED_ONLY ? 'staged ' : '';
  console.log(`ponytail compliance check passed (${files.length} ${mode}files checked).`);
}

main();
