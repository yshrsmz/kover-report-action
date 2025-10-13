# Repository Guidelines

## Project Structure & Module Organization
- `src/` holds the TypeScript action entry point (`index.ts`); add new runtime logic here.
- `dist/` stores the bundle from `pnpm run build`; keep it aligned with source changes because GitHub Actions consume this directory.
- `lib/` and `licenses.txt` are transient TypeScript and NCC outputs ignored by Git—do not commit them.
- Docs and config files sit at the root (`action.yml`, `biome.json`, `tsconfig.json`, `README.md`), while `docs/` hosts guides and `examples/` holds reference workflows.
- Use `test/fixtures/` for sample Kover XML or other assets that support verification.

## Build, Test, and Development Commands
```bash
pnpm install         # install dependencies (Node.js 20+)
pnpm run format      # format with Biome
pnpm run lint        # lint with Biome's rule set
pnpm run build       # tsc compile then bundle with @vercel/ncc into dist/
pnpm run build       # tsc compile then bundle with @vercel/ncc into dist/
pnpm run all         # run format + lint + build sequentially
pnpm run test        # placeholder; update when adding automated tests
```
Rebuild `dist/index.js` after runtime changes and commit it with the PR.

## Coding Style & Naming Conventions
- TypeScript only; keep exports explicitly typed and asynchronous code `async/await`.
- Biome enforces 2-space indentation, LF endings, single quotes, semicolons, 100-character lines, and ES5 trailing commas. Run `pnpm run format` before committing.
- Use descriptive `camelCase` for variables and functions; reserve `PascalCase` for classes or types.
- When logging, use `@actions/core` helpers (`core.info`, `core.setFailed`) to keep output consistent with other GitHub Actions.

## Testing Guidelines
- There is no automated suite yet; new coverage features should add tests under `test/` and hook them into `pnpm run test` (e.g., via `node:test` or a lightweight runner).
- Store reusable XML samples or JSON expectations in `test/fixtures/` and keep them small for quick review.
- Validate manual runs with `act` or a scratch workflow whenever behaviour touches GitHub APIs.

## Commit & Pull Request Guidelines
- Follow the existing history: short, imperative commit subjects (`Add EditorConfig…`, `pin github action...`) with focused changesets that include both source and regenerated `dist/`.
- Squash fixes locally instead of pushing noisy follow-up commits.
- Every PR should explain the change, reference issues, list verification steps (`pnpm run all`), and note any coverage artefacts.
- Attach screenshots or sample comment output when UI-facing behaviour changes.
