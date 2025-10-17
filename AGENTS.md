# Repository Guidelines

## Project Structure & Module Organization
- `src/` is organized into feature-based modules:
  - `index.ts` - Entry point that delegates to `action-runner.ts`
  - `action-runner.ts` - Main orchestrator
  - `config/` - Configuration management (validation, thresholds)
  - `discovery/` - Module discovery (command, glob, utilities)
  - `coverage/` - Coverage processing (parser, aggregator, threshold enforcement)
  - `history/` - History tracking (manager, artifacts, GitHub artifacts)
  - `reporter/` - Reporting (report generation, graphs, GitHub PR integration)
  - `common/` - Shared utilities (logger, paths)
- `dist/` stores the bundle from `pnpm run build`; keep it aligned with source changes because GitHub Actions consume this directory.
- `lib/` and `licenses.txt` are transient TypeScript and NCC outputs ignored by Git—do not commit them.
- Docs and config files sit at the root (`action.yml`, `biome.json`, `tsconfig.json`, `README.md`), while `docs/` hosts guides and `examples/` holds reference workflows.
- Use `__fixtures__/` for sample Kover XML or other assets that support verification.

## Build, Test, and Development Commands
```bash
pnpm install         # install dependencies (Node.js 20+)
pnpm run format      # format with Biome
pnpm run lint        # lint with Biome's rule set
pnpm run build       # tsc compile then bundle with @vercel/ncc into dist/
pnpm run build       # tsc compile then bundle with @vercel/ncc into dist/
pnpm run all         # run format + lint + build sequentially
pnpm run test        # run Vitest test suite
```
Rebuild `dist/index.js` after runtime changes and commit it with the PR.

## Coding Style & Naming Conventions
- TypeScript only; keep exports explicitly typed and asynchronous code `async/await`.
- Biome enforces 2-space indentation, LF endings, single quotes, semicolons, 100-character lines, and ES5 trailing commas. Run `pnpm run format` before committing.
- Use descriptive `camelCase` for variables and functions; reserve `PascalCase` for classes or types.
- When logging, use `@actions/core` helpers (`core.info`, `core.setFailed`) to keep output consistent with other GitHub Actions.

## Testing Guidelines
- The project uses Vitest for testing with comprehensive coverage (330+ tests across 18 test files).
- Add tests under `src/__tests__/` following the existing patterns (unit tests with test doubles).
- Store reusable XML samples or JSON expectations in `__fixtures__/` and keep them small for quick review.
- Run tests with `pnpm test` (single run), `pnpm test:watch` (watch mode), or `pnpm test:coverage` (with coverage).
- Validate manual runs with `act` or a scratch workflow whenever behaviour touches GitHub APIs.

## Commit & Pull Request Guidelines
- Follow the existing history: short, imperative commit subjects (`Add EditorConfig…`, `pin github action...`) with focused changesets that include both source and regenerated `dist/`.
- Squash fixes locally instead of pushing noisy follow-up commits.
- Every PR should explain the change, reference issues, list verification steps (`pnpm run all`), and note any coverage artefacts.
- Attach screenshots or sample comment output when UI-facing behaviour changes.
