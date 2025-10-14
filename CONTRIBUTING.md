# Contributing to Kover Report Action

Thank you for your interest in contributing to Kover Report Action! This document provides guidelines and information for contributors.

## Code of Conduct

This project adheres to a code of conduct. By participating, you are expected to uphold this code. Please be respectful and constructive in all interactions.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues to avoid duplicates. When creating a bug report, include:

- **Clear title** - Descriptive summary of the issue
- **Steps to reproduce** - Detailed steps to reproduce the behavior
- **Expected behavior** - What you expected to happen
- **Actual behavior** - What actually happened
- **Environment** - OS, Node.js version, action version
- **Logs** - Relevant action logs (enable `debug: 'true'`)
- **Configuration** - Your action configuration (sanitize tokens!)

**Example:**
```markdown
### Bug: Coverage report not posted to PR

**Steps to reproduce:**
1. Configure action with `github-token: ${{ secrets.GITHUB_TOKEN }}`
2. Run on pull request
3. No comment appears

**Expected:** Coverage report posted as PR comment

**Actual:** No comment, no error in logs

**Environment:**
- Action version: v1.0.0
- Runner: ubuntu-latest
- Event: pull_request

**Logs:**
```
📊 Kover Coverage Report Action
...
💬 Posting coverage report to PR...
✅ Coverage check passed!
```

**Configuration:**
```yaml
- uses: yshrsmz/kover-report-action@v1
  with:
    coverage-files: '**/kover/report.xml'
    github-token: ${{ secrets.GITHUB_TOKEN }}
```
```

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, include:

- **Clear title** - Descriptive summary of the enhancement
- **Use case** - Why this enhancement would be useful
- **Proposed solution** - How you envision it working
- **Alternatives** - Any alternative solutions you've considered
- **Examples** - Examples of similar features in other projects

### Pull Requests

1. **Fork the repository** and create your branch from `main`
2. **Follow the development setup** instructions below
3. **Make your changes** following our coding standards
4. **Add tests** for any new functionality
5. **Update documentation** if needed
6. **Run all checks** (`pnpm run all`) before submitting
7. **Write clear commit messages** following Conventional Commits
8. **Submit your pull request** with a clear description

## Development Setup

### Prerequisites

- **Node.js** - Version 20.x or higher
- **pnpm** - Latest version recommended
- **Git** - For version control

### Initial Setup

```bash
# Clone your fork
git clone https://github.com/YOUR-USERNAME/kover-report-action.git
cd kover-report-action

# Add upstream remote
git remote add upstream https://github.com/yshrsmz/kover-report-action.git

# Install dependencies
pnpm install
```

### Development Workflow

```bash
# Create a feature branch
git checkout -b feature/my-new-feature

# Make your changes...

# Format code
pnpm run format

# Lint code
pnpm run lint

# Run tests
pnpm test

# Build the action
pnpm run build

# Run all checks (format + lint + build)
pnpm run all
```

### Running Tests

```bash
# Run all tests once
pnpm test

# Run tests in watch mode (during development)
pnpm test:watch

# Generate coverage report
pnpm test:coverage

# Run tests with UI
pnpm test:ui
```

### Building

The action uses a two-stage build process:

1. **TypeScript compilation:** `src/*.ts` → `lib/*.js`
2. **Bundling:** `lib/index.js` → `dist/index.js` (single file with dependencies)

```bash
# Full build
pnpm run build

# The dist/ directory must be committed!
git add dist/
git commit -m "build: update dist files"
```

**Important:** Always commit the `dist/` directory. GitHub Actions runs the bundled code directly, not the source files.

## Coding Standards

### TypeScript Style

- **Use strict TypeScript** - All code must pass strict type checking
- **Prefer types over interfaces** - For consistency
- **Use async/await** - Not promises with `.then()`
- **Add JSDoc comments** - For public functions
- **Handle errors explicitly** - Use try-catch blocks

**Example:**
```typescript
/**
 * Parse a Kover XML coverage report file
 * @param filePath - Path to the XML file
 * @returns Coverage result or null if file not found
 */
export async function parseCoverageFile(
  filePath: string
): Promise<CoverageResult | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return parseXmlContent(content);
  } catch (error) {
    if (error instanceof Error && error.message.includes('ENOENT')) {
      core.debug(`Coverage file not found: ${filePath}`);
      return null;
    }
    throw error;
  }
}
```

### Code Formatting

- **Use Biome** - Configured in `biome.json`
- **Run formatter** - `pnpm run format` before committing
- **Auto-fix lints** - `pnpm run lint:fix` when possible

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks
- `ci:` - CI/CD changes

**Examples:**
```
feat(parser): add support for branch coverage
fix(github): handle rate limiting when posting comments
docs: update threshold configuration examples
test(aggregator): add tests for weighted coverage calculation
```

### Testing Guidelines

- **Write tests first** - Follow TDD approach when possible
- **Test edge cases** - Empty inputs, null values, errors
- **Use descriptive names** - Test names should explain what they test
- **Arrange-Act-Assert** - Structure tests clearly
- **Mock external dependencies** - Don't make real API calls

**Example:**
```typescript
import { describe, it, expect } from 'vitest';

describe('parseGradleProjects', () => {
  it('should extract module names from Gradle output', () => {
    const output = `
Root project 'myapp'
+--- Project ':app'
+--- Project ':core:common'
\\--- Project ':feature:auth'
    `;

    const modules = parseGradleProjects(output);

    expect(modules).toEqual([':app', ':core:common', ':feature:auth']);
  });

  it('should filter out Root project line', () => {
    const output = "Root project 'myapp'\\nProject ':app'";
    const modules = parseGradleProjects(output);

    expect(modules).not.toContain('myapp');
  });

  it('should return empty array for empty output', () => {
    const modules = parseGradleProjects('');
    expect(modules).toEqual([]);
  });
});
```

## Project Structure

```
.
├── src/
│   ├── index.ts          # Main entry point
│   ├── discovery.ts      # Module discovery logic
│   ├── parser.ts         # Kover XML parsing
│   ├── aggregator.ts     # Coverage aggregation
│   ├── threshold.ts      # Threshold matching
│   ├── report.ts         # Markdown report generation
│   ├── github.ts         # PR comment posting
│   └── paths.ts          # Path resolution & normalization
├── __tests__/
│   ├── discovery.test.ts # Tests for discovery.ts
│   ├── parser.test.ts    # Tests for parser.ts
│   └── ...               # Other test files
├── __fixtures__/
│   ├── kover-reports/    # Sample Kover XML files
│   ├── gradle-output/    # Sample Gradle command outputs
│   └── thresholds/       # Sample threshold configurations
├── dist/
│   └── index.js          # Compiled action (MUST be committed)
├── lib/                  # TypeScript compilation output (not committed)
├── docs/
│   ├── spec.md           # Specification document
│   └── plan.md           # Implementation plan
├── action.yml            # GitHub Action metadata
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
└── biome.json            # Biome linter/formatter config
```

## Testing Locally

### Test with Sample Data

Create test files in your workspace:

```bash
# Create sample coverage report
mkdir -p build/reports/kover
cat > build/reports/kover/report.xml << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<report name="Kover report">
  <counter type="INSTRUCTION" missed="145" covered="855"/>
  <counter type="LINE" missed="50" covered="200"/>
</report>
EOF

# Test the action locally
node dist/index.js
```

### Test with Environment Variables

```bash
# Set inputs via environment variables
export INPUT_COVERAGE-FILES="build/reports/kover/report.xml"
export INPUT_MIN-COVERAGE="70"
export INPUT_DEBUG="true"

# Run the action
node dist/index.js
```

### Test in a Real Repository

1. Push your branch to your fork
2. Create a test repository
3. Reference your action from your branch:

```yaml
- uses: YOUR-USERNAME/kover-report-action@your-branch-name
  with:
    coverage-files: '**/kover/report.xml'
```

## Pull Request Process

1. **Update documentation** - Ensure README.md reflects your changes
2. **Add tests** - All new functionality must have tests
3. **Run all checks** - `pnpm run all` must pass
4. **Update dist/** - Commit the bundled action
5. **Update CHANGELOG** - Add entry for your changes
6. **Request review** - Submit PR and request review

### PR Checklist

- [ ] Code follows project style guidelines
- [ ] Tests added for new functionality
- [ ] All tests passing (`pnpm test`)
- [ ] Code formatted (`pnpm run format`)
- [ ] No linting errors (`pnpm run lint`)
- [ ] Build successful (`pnpm run build`)
- [ ] `dist/` directory updated and committed
- [ ] Documentation updated
- [ ] Commit messages follow Conventional Commits
- [ ] PR description explains changes clearly

## Release Process

**For maintainers only**

1. Update version in `package.json`
2. Update CHANGELOG.md
3. Run `pnpm run all` to ensure everything builds
4. Commit changes: `chore: release v1.x.x`
5. Create git tag: `git tag -a v1.x.x -m "Release v1.x.x"`
6. Push tag: `git push origin v1.x.x`
7. Create GitHub release with notes

## Questions?

- 📖 Check the [README](README.md)
- 🔍 Search [existing issues](https://github.com/yshrsmz/kover-report-action/issues)
- 💬 Ask in a [new issue](https://github.com/yshrsmz/kover-report-action/issues/new)

## License

By contributing, you agree that your contributions will be licensed under the Apache License 2.0.
