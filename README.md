# Ponytail

A lightweight, IDE-agnostic, zero-dependency engineering ruleset and compliance checker.
Clone this repository and drop its files into any project to enforce clean modularity, strict typing, and consistent standards for both human developers and AI coding agents.

## Included Files

- `AGENTS.md` — Universal engineering rules for AI agents and developers (stack-agnostic, no UI rules).
- `ponytail.config.json` — Configurable thresholds, file extensions, ignored paths, and custom regex rules.
- `ponytail/check.mjs`, `ponytail/files.mjs`, `ponytail/rules.mjs`, `ponytail/patterns.mjs` — Zero-dependency Node.js (`>= 20`) compliance checker.
- `ponytail/check.test.mjs`, `ponytail/guards.test.mjs`, `ponytail/files.test.mjs` — Built-in unit and integration tests (`node --test`).
- `.githooks/pre-commit` — Optional Git pre-commit hook (checks staged index contents via `--staged`).
- `.github/workflows/ponytail.yml` — Optional GitHub Actions workflow for pull requests and pushes.

## Quick Start (Drop-In)

1. Copy `AGENTS.md`, `ponytail.config.json`, and the `ponytail/` folder into the root of your project.
2. Run the compliance check:
   ```bash
   node ponytail/check.mjs
   ```
3. *(Optional)* Enable the Git pre-commit hook:
   ```bash
   cp -r .githooks /path/to/your-project/
   cd /path/to/your-project
   chmod +x .githooks/pre-commit
   git config core.hooksPath .githooks
   ```
4. *(Optional)* Copy `.github/workflows/ponytail.yml` to enforce checks automatically in CI.
5. *(Optional)* If your team uses tools that expect a different instruction filename (such as `CLAUDE.md` or `.github/copilot-instructions.md`), symlink or reference `AGENTS.md` from that file.

## CLI Options

- `node ponytail/check.mjs` — Scan all matching files in the repository.
- `node ponytail/check.mjs --staged` — Scan staged Git index contents (fast pre-commit mode).
- `node ponytail/check.mjs --strict` — Treat soft warnings (such as `warnLoc`) as errors.

## Configuration (`ponytail.config.json`)

| Key | Default | Description |
| --- | --- | --- |
| `maxLoc` | `200` | Hard line limit per source file (`lines < maxLoc`). |
| `warnLoc` | `175` | Soft warning threshold to encourage splitting files early. |
| `maxLineLength` | `140` | Maximum characters per line (prevents line-stuffing workarounds). |
| `maxStatementsPerLine` | `2` | Flags lines packing too many `;`-separated statements to bypass `maxLoc`. |
| `banEmoji` | `true` | Forbids emoji characters in source code and docs. |
| `banTsAny` | `true` | Forbids `: any`, `as any`, generic `any`, `any[]`, `@ts-ignore`, and `@ts-nocheck` in `.ts`/`.tsx`. |
| `banSecrets` | `true` | Flags hardcoded AWS/GitHub/Google/Slack/API secret keys and private key blocks in code and docs. |
| `banConflictMarkers` | `true` | Flags unresolved Git merge conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`). |
| `banTestOnly` | `true` | Forbids focused tests (`test.only`, `it.only`, `describe.only`, `fit`, `fdescribe`). |
| `banDebugger` | `true` | Forbids leftover `debugger` statements in JS/TS files. |
| `banEmptyCatch` | `true` | Flags empty `catch` blocks that silently swallow errors. |
| `banJunkFilenames` | `true` | Flags temporary, backup, copy, or vague filenames (`temp.ts`, `misc.ts`, `*-old.ts`, `*.bak.ts`). |
| `maxDirDepth` | `0` | Optional max folder nesting depth warning (`0` disables; set e.g. `5` to cap deep trees). |
| `extensions` | Multi-language | Source file extensions to scan (`.ts`, `.tsx`, `.js`, `.java`, `.py`, `.go`, `.rs`, etc.). |
| `docExtensions` | `[".md", ".mdx", ".txt"]` | Documentation extensions scanned for emoji and matching custom rules (exempt from LOC limits). |
| `include` | `["."]` | Directories or files to scan relative to project root. |
| `ignoreDirs` | Standard build/vendor dirs | Directories skipped during traversal. |
| `customRules` | `[]` | Project-specific regex rules (`{ id, pattern, flags, message, extensions }`). |

### Example: Adding a Project-Specific Custom Rule

```json
{
  "customRules": [
    {
      "id": "NO_CONSOLE_LOG",
      "pattern": "\\bconsole\\.log\\(",
      "message": "Avoid committing console.log statements",
      "extensions": [".ts", ".tsx", ".js"]
    }
  ]
}
```
