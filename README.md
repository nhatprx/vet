# vet

A lightweight, IDE-agnostic, zero-dependency engineering ruleset and compliance checker (`Node.js >= 20`).
One command installs a self-contained, **local-only** ruleset and Git hooks into any project — never committed or pushed.

## Quick Start

Run a single command inside any Git project:

```bash
npx github:nhatprx/vet
```

Include AI tool pointer files (`CLAUDE.md`, `.github/copilot-instructions.md`, `.cursor/rules/vet.mdc`):

```bash
npx github:nhatprx/vet --adapters
```

What this does automatically:
- Installs a self-contained `.vet/` (checker + Git hooks), `AGENTS.md`, and `vet.config.json` without overwriting existing files.
- Adds `.vet/` and every generated local file to `.git/info/exclude` so `git status` stays clean and **nothing from vet is ever committed or pushed** (and `.gitignore` is untouched).
- Configures `git config core.hooksPath .vet/.githooks` to activate `pre-commit` and `commit-msg` hooks locally (independent of any ephemeral `npx` cache).

### Shared Team Setup (Optional, Committed to Repo)

```bash
npx github:nhatprx/vet --shared --adapters
```

## CLI Options

```bash
node .vet/vet/check.mjs [options] [paths...]
```

- `--staged` — Scan staged Git index contents only (skips symlinks/submodules; used by `pre-commit`).
- `--diff <ref>` — Scan only files changed since `<ref>` (e.g., `--diff origin/main`) for PRs or legacy repos.
- `--strict` — Promote warnings (`LOC_WARN`, `LINE_LENGTH`, `DIR_DEPTH`, `TEST_SKIP`, custom warnings) to errors.
- `--format <type>` — Output format: `text` (default), `github` (PR diff annotations), or `json`.
- `--config <path>` — Load a custom config file path.
- `[paths...]` — Limit scanning to specific files or directories.

### Inline Suppression (Escape Hatch)

Suppress a single line with a mandatory reason:

```ts
// vet-ignore-next-line TS_STRICT -- third-party untyped payload
const raw: any = externalLib.parse();
```

## Configuration (`vet.config.json`)

| Key | Default | Description |
| --- | --- | --- |
| `maxLoc` | `200` | Hard line limit per source file (`lines < maxLoc`). |
| `warnLoc` | `175` | Soft warning threshold to encourage splitting files early. |
| `maxLineLength` | `140` | Maximum characters per line (prevents line-stuffing workarounds). |
| `maxStatementsPerLine` | `2` | Flags lines packing too many `;`-separated statements. |
| `banEmoji` | `true` | Forbids emojis (including flag emojis) across source, docs, and config files. |
| `banTsAny` | `true` | Forbids `: any`, `as any`, generic `any`, `any[]`, `@ts-ignore`, `@ts-nocheck` in `.ts`/`.tsx`. |
| `banSecrets` | `true` | Flags hardcoded AWS/GitHub/Google/Slack/npm/SendGrid/Stripe/DB/JWT/Private Key secrets across source, docs, and config files. |
| `banEnvFiles` | `true` | Blocks committing `.env` / `.env.*` files (allows `.env.example`, `.env.template`, `.env.sample`). |
| `banConflictMarkers` | `true` | Flags unresolved Git merge conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`) across all scanned files. |
| `banTestOnly` | `true` | Forbids focused tests (`test.only`, `it.only`, `describe.only`, `fit`, `fdescribe`) in JS/TS. |
| `banTestSkip` | `"warn"` | Flags skipped tests (`.skip`, `xit`, `xdescribe`, `@pytest.mark.skip`, `@Disabled`) as `"warn"`, `"error"`, or `false`. |
| `banDebugger` | `true` | Forbids `debugger` (JS/TS) and `breakpoint()` / `pdb.set_trace()` (Python). |
| `banEmptyCatch` | `true` | Flags empty `catch {}` (JS/TS/Java/Kotlin) and `except: pass` (Python) blocks. |
| `banJunkFilenames` | `true` | Flags temporary, backup, or copy filenames (`temp.ts`, `misc.js`, `*-old.ts`, `*.bak.ts`, `* copy.ts`). |
| `maxDirDepth` | `0` | Optional max folder nesting depth warning (`0` disables; set e.g. `5` to cap deep trees). |
| `include` | `["."]` | Directories or files to scan relative to project root. |
| `extensions` | Multi-language | Source extensions subject to all rules (`.ts`, `.tsx`, `.js`, `.java`, `.kt`, `.py`, `.go`, `.rs`, `.css`, `.sql`, etc.). |
| `docExtensions` | `[".md", ".mdx", ".txt"]` | Docs scanned for universal guards (emoji, secrets, conflicts, junk names, depth) and custom rules; exempt from LOC limits. |
| `configExtensions` | `[".json", ".yml", ".yaml", ".toml", ".sh"]` | Config/infra files (plus `.env*` and `Dockerfile`) scanned for universal guards and custom rules; exempt from LOC limits. |
| `ignoreDirs` | Build/vendor dirs | Directory names skipped during traversal (includes `.vet`). |
| `ignoreFiles` | `[]` | Exact paths or glob patterns to skip (e.g., `**/*.generated.ts`, `migrations/**`). |
| `customRules` | `[]` | Project-specific regex rules (`{ id, pattern, flags, message, extensions, severity }`). |

## Running Built-In Tests

```bash
node --test vet/*.test.mjs
node vet/check.mjs --strict
```
