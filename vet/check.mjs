#!/usr/bin/env node
import { collectFiles, loadConfig } from './files.mjs';
import { formatOutput } from './formatters.mjs';
import { checkContent } from './rules.mjs';

const VALID_FORMATS = new Set(['text', 'github', 'json']);

const HELP_TEXT = [
  'Usage: node vet/check.mjs [options] [paths...]',
  '',
  'Options:',
  '  --staged              Scan staged Git index contents only',
  '  --diff <ref>          Scan files changed since <ref> (e.g. origin/main)',
  '  --strict              Treat warnings as errors',
  '  --format <type>       Output format: text (default), github, json',
  '  --config <path>       Path to custom vet.config.json',
  '  -h, --help            Show this help message',
].join('\n');

export function parseArgs(argv) {
  const opts = { staged: false, strict: false, diffRef: null, format: 'text', configPath: null, help: false, targets: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--staged') opts.staged = true;
    else if (arg === '--strict') opts.strict = true;
    else if (arg === '-h' || arg === '--help') opts.help = true;
    else if (arg === '--diff') opts.diffRef = argv[++i] || '';
    else if (arg === '--format') opts.format = argv[++i] || '';
    else if (arg === '--config') opts.configPath = argv[++i] || '';
    else if (arg.startsWith('-')) throw new Error(`Unknown option: ${arg}`);
    else opts.targets.push(arg);
  }
  if (!VALID_FORMATS.has(opts.format)) throw new Error(`Invalid --format "${opts.format}". Expected: text, github, json.`);
  if (opts.diffRef === '') throw new Error('Missing value for --diff <ref>.');
  if (opts.configPath === '') throw new Error('Missing value for --config <path>.');
  return opts;
}

function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`vet error: ${err.message}`);
    process.exit(2);
  }

  if (opts.help) {
    console.log(HELP_TEXT);
    return;
  }

  const root = process.cwd();
  let config;
  let files;
  try {
    config = loadConfig(root, opts.configPath);
    files = collectFiles(root, config, {
      stagedOnly: opts.staged,
      diffRef: opts.diffRef,
      targets: opts.targets,
    });
  } catch (err) {
    console.error(`vet error: ${err.message}`);
    process.exit(1);
  }

  const allErrors = [];
  const allWarnings = [];
  for (const { relPath, content } of files) {
    const { errors, warnings } = checkContent(relPath, content, config);
    allErrors.push(...errors);
    allWarnings.push(...warnings);
  }

  const modeLabel = opts.staged ? 'staged ' : opts.diffRef ? 'changed ' : '';
  const result = formatOutput({
    format: opts.format,
    checkedCount: files.length,
    modeLabel,
    errors: allErrors,
    warnings: allWarnings,
    strictMode: opts.strict,
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (!result.ok) process.exit(1);
}

main();
