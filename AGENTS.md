# AGENTS.md — Universal Engineering Rules for AI Agents & Developers

This file is the **single source of truth for operational compliance** in this repository.
Every AI agent and human developer must follow these rules without exception.

---

## 1. Non-Negotiable Hard Rules

### 1.1 Code Size, Modularity & Reusability
- **HARD LIMIT: Every source code file MUST be strictly under 200 lines of code (`< 200 LOC`).**
  - Blank lines and comments count toward total file lines.
  - Target **<= 175 lines** as a safe buffer (`warnLoc`). When a file approaches 175 lines, **split it proactively** rather than compressing code.
- **No Line-Stuffing:** Do not pack multiple statements onto a single line (`a(); b(); c();`) or exceed `140` characters per line just to stay under the `200 LOC` cap. Always refactor into focused modules instead.
- **Single Responsibility & Function Complexity:** One file = one clear purpose. Keep functions concise (`<= 50` lines) with shallow nesting (`<= 3` levels, preferring early returns over deep `if`/`else` chains).
- **Reuse-First & Zero Duplication (DRY):** Before writing any new helper, service, hook, or component, search the codebase and reuse existing abstractions. Never duplicate business logic, validation, or utilities across files; extract a shared, well-named module when logic repeats.

### 1.2 Code Cleanliness, Scope & Language
- **Zero-Emoji Policy:** Emojis are forbidden in source code, comments, commit messages, logs, and documentation.
- **English-Only Policy:** All source code, identifiers, comments, logs, documentation, and commit messages must be written strictly in English.
- **No Dead Code or Leftover Debug Artifacts:** Remove unused imports, variables, functions, `debugger` statements, focused tests (`.only`/`fit`), merge conflict markers, and obsolete files immediately.
- **Minimal Diff & Zero Unjustified Dependencies:** Keep changes strictly scoped to the task (avoid unrelated drive-by refactors). Prefer the language standard library or existing dependencies over adding new packages unless clearly justified.

### 1.3 Type Safety, Error Handling & Clean Boundaries
- **Strict Typing:** Avoid `any`, unsafe type assertions, `@ts-ignore`, and `@ts-nocheck` (or equivalent suppression directives in other languages).
- **No Silent Error Swallowing:** Never leave empty `catch` blocks or swallow exceptions silently. Either handle recovery explicitly, log structured context, or rethrow.
- **Clean Boundaries:** Isolate external APIs, databases, storage, and infrastructure behind explicit interfaces/adapters so business logic remains testable, decoupled, and easy to swap.

### 1.4 Mandatory Test Brainstorming, Honesty & Regression Testing
- **Pre-Implementation & In-Flight Test Brainstorming:** Before and during any feature or bug fix, cover:
  - Boundary conditions (empty/zero values, maximum lengths, pagination limits, null/optional fields).
  - Invalid and malformed inputs (schema violations, unexpected types, missing required parameters).
  - Error handling and failure modes (timeouts, upstream errors, duplicate keys, 4xx/5xx responses).
  - Edge cases and concurrency/state transitions (idempotency, race conditions, expired/revoked credentials).
  - Security boundaries (authentication, authorization/RBAC, path traversal, injection resistance, secret redaction).
- **Honest Verification (No Weakening Tests):** Never delete assertions, skip tests, or weaken expectations just to force a green build. Fix the root cause instead.
- **Full Regression Execution:** After every meaningful change, run automated tests covering both new and existing behavior plus `node ponytail/check.mjs` before reporting completion.

### 1.5 Production-Grade Scale, Resilience & Security
- **No Unbounded Lists:** Paginate, cursor, virtualize, or cap every query, API response, and UI list.
- **No N+1 Patterns:** Batch queries and state fetches; never fire per-row network or database calls in loops.
- **Explicit Timeouts & Idempotency:** Enforce explicit timeouts (and bounded retries/backoff where safe) on all external network, database, and subprocess I/O. Keep migrations, webhooks, and batch jobs idempotent and safe to retry.
- **Fail Fast & Zero Hardcoded Secrets:** Validate external input at system boundaries, never commit credentials/keys/tokens, and never leak secrets into logs or client storage.

### 1.6 File Management & Project Structure
- **Follow Existing Architecture First:** Before creating any new file or directory, inspect the current repository layout and match its established grouping (by domain/feature or layer), naming conventions, and test colocation pattern.
- **Pragmatic Splitting (No Over-Fragmentation):** Split files along cohesive domain or responsibility boundaries, not arbitrarily. Avoid creating trivial micro-files (e.g., 5-15 line pass-through wrappers) unless they define a clear reusable contract or entry point.
- **Descriptive Naming (No Catch-All Dumping Grounds):** Never create vague or leftover files such as `utils`, `helpers`, `misc`, `common`, `temp`, `*-old`, `*-copy`, or `*.bak`. Name every file after its concrete responsibility (e.g., `dateFormatter`, `authMiddleware`, `orderRepository`).
- **Clean Root & Sensible Hierarchy:** Keep the repository root minimal (configs, top-level docs, and primary source folders only). Avoid deep, unnecessary directory nesting unless required by the language or framework (e.g., Java packages or file-based routing).
- **Clean File Lifecycle:** When renaming, replacing, or refactoring a module, delete obsolete files and update all references immediately. Never leave orphaned, duplicate, or backup files in tracked directories.
- **Isolate Generated & Temporary Artifacts:** Keep build outputs, caches, and scratch files strictly in ignored directories; never commit generated artifacts into source folders.

---

## 2. Project-Specific Profile (Customize Per Repo)

> Fill in stack, architecture, or design guidelines specific to this repository below:
> - **Tech Stack:** *(e.g. TypeScript, Java, Go, Python, PostgreSQL, Redis)*
> - **Test Commands:** *(e.g. `npm test`, `mvn test`, `pytest`, `go test ./...`)*
> - **Design / Style Notes:** *(optional)*

---

## 3. Pre-Completion Checklist

Before marking any task complete, verify:
1. Every created or modified source file is **< 200 LOC**, modular, reusable, and free of duplicated logic.
2. New files fit the existing project architecture with descriptive names, sensible nesting, and zero orphaned/backup files.
3. Zero emojis, hardcoded secrets, conflict markers, `debugger`, `.only` tests, or empty `catch` blocks exist.
4. All code, comments, documentation, and commit messages are written strictly in **English**.
5. Strict typing rules pass with zero type suppressions or unused imports.
6. Automated tests cover boundary, error, edge, and security cases with zero weakened assertions and zero regressions.
7. `node ponytail/check.mjs` passes with zero errors.
