# Vet (Universal Engineering Ruleset & Compliance Checker)
> A lightweight, zero-dependency CLI to enforce clean, modular, production-grade code for AI agents and developers.
> **One command. Local-only. Never committed or pushed.**

![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![npm](https://img.shields.io/badge/npm-CB3837?style=for-the-badge&logo=npm&logoColor=white)
![Git](https://img.shields.io/badge/git-%23F05033.svg?style=for-the-badge&logo=git&logoColor=white)
![GitHub](https://img.shields.io/badge/github-%23121011.svg?style=for-the-badge&logo=github&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)

## Features

- **Zero-Dependency & Multi-Language:** Runs natively on Node.js (`>= 20`) across TS, JS, Python, Java, Kotlin, Go, Rust, CSS, SQL, docs, and config files.
- **Local-Only by Default:** Installs `.vet/`, `AGENTS.md`, and `vet.config.json` into your project and excludes them via `.git/info/exclude` — keeping `git status` clean and `.gitignore` untouched.
- **Modularity & Clean Structure:** Enforces `< 200 LOC` per source file (`175` warning), prevents line-stuffing, and blocks temporary/backup/copy junk filenames.
- **Security & Commit Guards:** Detects hardcoded secrets (AWS, GitHub, Google, Slack, npm, Stripe, DB URLs, JWT, private keys), `.env` files, merge conflict markers, emojis, `debugger`, empty `catch`/`except: pass`, and `.only`/`.skip` tests.
- **Strict TypeScript:** Blocks `: any`, `as any`, generic `any`, `any[]`, `@ts-ignore`, and `@ts-nocheck` without false positives on comments, strings, or JSX.
- **Two-Layer Enforcement:** Activates local `pre-commit` (Git index `--staged`) and `commit-msg` hooks automatically, plus `--diff <ref>`, `--strict`, `--format github|json`, and inline `// vet-ignore-next-line RULE_ID -- reason`.
- **AI Agent Ready:** Ships `AGENTS.md` with optional `--adapters` pointers for `CLAUDE.md`, GitHub Copilot, and Cursor.

## Quick Start (Run without installing)

### Local-Only Setup (Recommended)
```bash
npx -y @nhatprx/vet
```
With AI tool adapters (`CLAUDE.md`, Copilot, Cursor):
```bash
npx -y @nhatprx/vet --adapters
```

### Shared Team Setup (Committed to Repo)
```bash
npx -y @nhatprx/vet --shared --adapters
```

### Manual Checks
```bash
node .vet/vet/check.mjs                  # Full repository scan
node .vet/vet/check.mjs --staged         # Staged Git index only
node .vet/vet/check.mjs --diff origin/main  # Changed files in PR
node .vet/vet/check.mjs --strict         # Treat warnings as errors
```
