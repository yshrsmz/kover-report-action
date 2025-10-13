# Contributing to Kover Report Action

Thank you for your interest in contributing! This document provides guidelines for developing and contributing to this project.

## Development Setup

1. Fork and clone the repository
2. Install Node.js 20.x or higher
3. Install pnpm if you haven't already
4. Install dependencies:
   ```bash
   pnpm install
   ```

## Development Workflow

### Making Changes

1. Create a new branch for your feature/fix
2. Make your changes in the `src/` directory
3. Format your code:
   ```bash
   pnpm run format
   ```
4. Lint your code:
   ```bash
   pnpm run lint
   ```
5. Build the action:
   ```bash
   pnpm run build
   ```

### Building

The action uses [@vercel/ncc](https://github.com/vercel/ncc) to compile TypeScript and bundle dependencies:

```bash
pnpm run build
```

This compiles:
- TypeScript (`src/`) → JavaScript (`lib/`)
- Bundles everything → `dist/index.js`

**Important:** Always commit the `dist/` directory with your changes!

### Code Quality

We use:
- **TypeScript** for type safety
- **Biome** for linting and code formatting

Run all checks:
```bash
pnpm run all
```

### Testing

Before submitting a PR:
1. Ensure your code builds successfully
2. Run linting and formatting checks
3. Test the action locally if possible
4. Verify no uncommitted changes remain after building

## Project Structure

```
.
├── src/                  # TypeScript source files
│   └── index.ts         # Main entry point
├── lib/                 # Compiled TypeScript (gitignored)
├── dist/                # Bundled distribution (committed)
│   └── index.js        # Action entry point
├── action.yml          # Action metadata
├── tsconfig.json       # TypeScript config
├── biome.json          # Biome config
└── package.json        # Dependencies and scripts
```

## Pull Request Process

1. Update documentation if needed
2. Run `pnpm run all` to ensure everything passes
3. Commit your changes including the built `dist/` directory
4. Create a pull request with a clear description
5. Wait for review and address any feedback

## Commit Guidelines

- Use clear, descriptive commit messages
- Keep commits focused and atomic
- Include both source and built files in the same commit

## Questions?

Feel free to open an issue for any questions or concerns!
