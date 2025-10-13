# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a GitHub Action that parses Kover (Kotlin code coverage tool) XML reports and provides coverage metrics. The action is built with TypeScript and compiles to a single bundled JavaScript file for distribution.

**Important**: This project uses **pnpm** as the package manager, not npm. All commands should use `pnpm` instead of `npm`.

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

### Entry Point
- `src/index.ts` - Main action entry point that:
  - Reads inputs from `action.yml` (coverage-file, min-coverage, title)
  - Accesses GitHub context via `@actions/github`
  - Should parse Kover XML coverage reports (currently placeholder logic)
  - Sets action outputs (coverage-percentage, lines-covered, lines-total)
  - Fails the action if coverage is below minimum threshold

### Configuration Files
- `action.yml` - GitHub Action metadata defining inputs, outputs, and runtime (node24)
- `tsconfig.json` - Strict TypeScript configuration targeting ES2021 with CommonJS modules
- `biome.json` - Biome configuration for linting and formatting

## Key Implementation Details

### Current State
The action currently has placeholder logic for coverage calculation (lines 27-29 in src/index.ts). The actual Kover XML parsing needs to be implemented.

### Kover XML Format
Kover generates XML reports in a specific format that needs to be parsed. The action should:
1. Read and parse the XML file from the `coverage-file` input path
2. Extract line coverage metrics
3. Calculate overall coverage percentage
4. Compare against `min-coverage` threshold

### Output Requirements
The action must set three outputs via `core.setOutput()`:
- `coverage-percentage` - Overall coverage as a number
- `lines-covered` - Integer count of covered lines
- `lines-total` - Integer count of total lines

## CI/CD

The `.github/workflows/ci.yml` workflow runs on push and PRs to main:
1. Runs `pnpm ci` (clean install)
2. Checks formatting with `pnpm run format:check`
3. Lints code with `pnpm run lint`
4. Builds with `pnpm run build`
5. Verifies no uncommitted changes exist after build (ensures `dist/` is up to date)

**Important**: Always run `pnpm run build` and commit the `dist/` directory when making changes to source files. The CI will fail if `dist/` is not up to date with source code.

## Testing the Action

To test locally, you can:
1. Create a sample Kover XML report in `build/reports/kover/report.xml`
2. Use `@actions/core` debug mode by setting environment variable `INPUT_COVERAGE-FILE`
3. Run the compiled action with Node: `node dist/index.js`

For integration testing, create a test repository and reference the action from a branch.
