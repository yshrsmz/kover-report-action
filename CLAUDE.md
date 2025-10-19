# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a GitHub Action that parses Kover (Kotlin code coverage tool) XML reports and provides coverage metrics. The action is built with TypeScript and compiles to a single bundled JavaScript file for distribution.

**Important**: This project uses **pnpm** as the package manager, not npm. All commands should use `pnpm` instead of `npm`.

**Package Manager Commands:**
- Use `pnpm run <script>` for package.json scripts (e.g., `pnpm run lint`)
- Use `pnpm exec <binary>` to run binaries from node_modules (e.g., `pnpm exec biome check --write`)
- **Never use `npx`** - always use `pnpm exec` instead

## Coding Style

### Prefer Simple, Functional Patterns Over Heavy Classes

This codebase favors **lightweight, functional patterns** over heavy class-based implementations:

**✅ Preferred Patterns:**
- **Factory functions** returning plain objects: `createCoreFacade()` returns `{ getInput, setSecret }`
- **Type aliases** for structural types: `type CoreFacade = { ... }`
- **Plain functions** for pure logic: `loadConfig(facade)`, `parseThresholds(json)`
- **Simple interfaces** for true abstractions with multiple implementations: `interface Logger`

**❌ Avoid:**
- **Heavy classes** with constructors, private fields, and methods when a simple object/function would suffice
- **Class-based adapters** - use factory functions that return plain objects instead
- **Unnecessary OOP patterns** - prefer composition via functions over inheritance

**Examples:**

```typescript
// ✅ Good: Factory function returning plain object
export function createCoreFacade(core: typeof import('@actions/core')): CoreFacade {
  return {
    getInput: core.getInput.bind(core),
    setSecret: core.setSecret.bind(core),
  };
}

// ❌ Avoid: Class with boilerplate
export class ActionsCoreFacade {
  constructor(private readonly core: ...) {}
  getInput(name: string) { return this.core.getInput(name); }
  setSecret(secret: string) { this.core.setSecret(secret); }
}

// ✅ Good: Type alias derived from actual types
export type CoreFacade = {
  getInput: typeof core.getInput;
  setSecret: typeof core.setSecret;
};

// ✅ Good: Interface for true abstraction (multiple implementations)
export interface Logger {
  info(message: string): void;
  debug(message: string): void;
}
```

**When to use classes:**
- When you need actual stateful behavior (e.g., `SpyLogger` with internal state tracking)
- When building test doubles that implement interfaces (e.g., `FakeCoreFacade`)
- When inheritance genuinely simplifies the design (rare)

**Rationale:** Simple patterns are easier to understand, test, and maintain. Classes add complexity and boilerplate without benefit when plain objects and functions suffice.

## Build System

The build process has two stages:
1. TypeScript compilation: `src/*.ts` → `lib/*.js`
2. Bundling with ncc: `lib/index.js` → `dist/index.js` (single file with all dependencies)

The `dist/` directory must be committed to the repository since GitHub Actions runs the bundled code directly.

## Development Commands

```bash
# Install dependencies
pnpm install

# Format code
pnpm run format

# Check formatting without modifying files
pnpm run format:check

# Lint code
pnpm run lint

# Fix linting issues automatically
pnpm run lint:fix

# Build the action (compiles TypeScript + bundles with @vercel/ncc)
pnpm run build

# Run all checks (format + lint + build)
pnpm run all
```

## Action Architecture

The action follows a **layered, feature-based architecture** with clean separation of concerns:

### Entry Point
- `src/index.ts` - Slim wiring layer that:
  - Creates facades and dependencies (logger, config, discovery, history, reporter)
  - Delegates all business logic to `action-runner.ts`
  - Handles top-level error handling

- `src/action-runner.ts` - Main orchestration logic that:
  - Coordinates the workflow: discover → parse → aggregate → compare → report
  - Pure business logic with injected dependencies
  - No direct `@actions/core` usage (uses facades)

### Module Organization
- `src/config/` - Configuration management (loading, validation, threshold parsing)
- `src/discovery/` - Module discovery (command-based and glob-based strategies)
- `src/coverage/` - Coverage processing (XML parsing, aggregation, threshold enforcement)
- `src/history/` - Coverage history tracking (manager, artifacts, GitHub API integration)
- `src/reporter/` - Report generation (markdown, graphs, PR comments)
- `src/common/` - Shared utilities (logger, path handling)

### Key Features
- Multi-module support with flexible discovery (Gradle commands or glob patterns)
- Per-module threshold configuration (type-based and name-based)
- Coverage history tracking with trend indicators (↑↓→)
- PR comment integration with automatic updates
- Comprehensive test coverage (330+ tests with Vitest)

### Configuration Files
- `action.yml` - GitHub Action metadata defining inputs, outputs, and runtime (node24)
- `tsconfig.json` - Strict TypeScript configuration targeting ES2021 with CommonJS modules
- `biome.json` - Biome configuration for linting and formatting

## Key Implementation Details

### Coverage Parsing
The action parses Kover XML reports (JaCoCo-compatible format):
1. Reads XML files using `fast-xml-parser`
2. Extracts INSTRUCTION coverage (not LINE coverage) for accuracy
3. Aggregates across multiple modules with weighted averaging
4. Compares against configurable per-module thresholds

### Action Inputs & Outputs
**Inputs:** `coverage-files`, `discovery-command`, `module-path-template`, `thresholds`, `min-coverage`, `github-token`, `enable-history`, `baseline-branch`, etc.

**Outputs:**
- `coverage-percentage` - Overall coverage percentage
- `instructions-covered` - Total instructions covered
- `instructions-total` - Total instructions
- `modules-coverage-json` - Per-module coverage JSON
- `modules-below-threshold` - Modules failing thresholds

## CI/CD

The `.github/workflows/ci.yml` workflow runs on push and PRs to main:
1. Runs `pnpm ci` (clean install)
2. Checks formatting with `pnpm run format:check`
3. Lints code with `pnpm run lint`
4. Builds with `pnpm run build`
5. Verifies no uncommitted changes exist after build (ensures `dist/` is up to date)

**Important**: Always run `pnpm run build` and commit the `dist/` directory when making changes to source files. The CI will fail if `dist/` is not up to date with source code.

## Git Workflow

**Important Git Commit Rules:**
- **NEVER use `git commit --no-verify`** - Always let git hooks run to ensure code quality
- **NEVER use `LEFTHOOK=0`** when committing - This bypasses Lefthook git hooks
- Git hooks run formatting, linting, and other checks before commits
- If hooks fail, fix the issues rather than bypassing them with --no-verify or LEFTHOOK=0
- The only exception is in CI/CD environments where hooks may not be compatible
- If you encounter hook errors, investigate and fix the underlying issue first

**Commit Message Format:**
- Use clear, descriptive commit messages
- Follow the project's existing commit message style
- Include Claude Code attribution when applicable:
  ```
  🤖 Generated with [Claude Code](https://claude.com/claude-code)

  Co-Authored-By: Claude <noreply@anthropic.com>
  ```

## Testing the Action

To test locally, you can:
1. Create a sample Kover XML report in `build/reports/kover/report.xml`
2. Use `@actions/core` debug mode by setting environment variable `INPUT_COVERAGE-FILE`
3. Run the compiled action with Node: `node dist/index.js`

For integration testing, create a test repository and reference the action from a branch.
