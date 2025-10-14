# Kover Report Action

A GitHub Action for generating and reporting code coverage from Kover XML reports with multi-module support. This action is designed to work with any Kotlin/Android project using Kover for code coverage.

[![GitHub release](https://img.shields.io/github/v/release/yshrsmz/kover-report-action)](https://github.com/yshrsmz/kover-report-action/releases)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

## Features

- 📊 **Multi-Module Support** - Handle projects with multiple modules and aggregate coverage
- 🔍 **Flexible Discovery** - Command-based (Gradle) or glob pattern module discovery
- 🎯 **Configurable Thresholds** - Per-module type and per-module name threshold configuration
- 💬 **PR Integration** - Post coverage reports as PR comments with automatic updates
- 📈 **Coverage Outputs** - Export coverage data for use in other workflow steps
- ⚡ **Fast & Secure** - Parallel parsing with path traversal and command injection prevention

## Quick Start

### Single Module Project

```yaml
- name: Run tests with coverage
  run: ./gradlew koverXmlReport

- name: Check coverage
  uses: yshrsmz/kover-report-action@v1
  with:
    coverage-files: 'build/reports/kover/report.xml'
    min-coverage: '70'
```

### Multi-Module Project with Gradle Discovery

```yaml
- name: Run tests with coverage
  run: ./gradlew koverXmlReport

- name: Generate coverage report
  uses: yshrsmz/kover-report-action@v1
  with:
    discovery-command: './gradlew -q projects'
    module-path-template: '{module}/build/reports/kover/report.xml'
    thresholds: '{"core": 80, "feature": 70, "default": 60}'
    ignore-modules: ':app,:build-logic'
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

### Multi-Module Project with Glob Pattern

```yaml
- name: Run tests with coverage
  run: ./gradlew koverXmlReport

- name: Generate coverage report
  uses: yshrsmz/kover-report-action@v1
  with:
    coverage-files: '**/build/reports/kover/report.xml'
    thresholds: '{"default": 65}'
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

## Inputs

### Discovery & Paths

| Input | Description | Default | Required |
|-------|-------------|---------|----------|
| `discovery-command` | Command to discover modules (e.g., `./gradlew -q projects`) | - | No |
| `coverage-files` | Glob pattern for coverage files | `**/build/reports/kover/report.xml` | No |
| `module-path-template` | Path template with `{module}` placeholder | `{module}/build/reports/kover/report.xml` | No |
| `ignore-modules` | Comma-separated list of modules to ignore | `''` | No |

**Discovery Mode:**
- If `discovery-command` is provided → Use command-based discovery
- Otherwise → Use glob pattern from `coverage-files`

### Thresholds

| Input | Description | Default | Required |
|-------|-------------|---------|----------|
| `thresholds` | JSON object with module type/name thresholds | `{"default": 60}` | No |
| `min-coverage` | Global minimum coverage (0-100) | `0` | No |

**Threshold Format:**
```json
{
  "core": 80,              // Type-based: all :core:* modules
  "data": 75,              // Type-based: all :data:* modules
  "feature": 70,           // Type-based: all :feature:* modules
  ":core:testing": 0,      // Name-based: specific module override
  "default": 60            // Fallback for unmatched modules
}
```

**Threshold Matching Order:**
1. Exact module name match (e.g., `:core:testing`)
2. Module type match (first segment, e.g., `core` from `:core:common`)
3. `default` value
4. `min-coverage` input
5. Hard default: `0`

### Reporting

| Input | Description | Default | Required |
|-------|-------------|---------|----------|
| `github-token` | GitHub token for PR comments | - | No |
| `title` | Report title | `Code Coverage Report` | No |
| `enable-pr-comment` | Post report as PR comment | `true` | No |

### Advanced

| Input | Description | Default | Required |
|-------|-------------|---------|----------|
| `debug` | Enable debug logging | `false` | No |

## Outputs

| Output | Description | Example |
|--------|-------------|---------|
| `coverage-percentage` | Overall coverage percentage | `85.5` |
| `instructions-covered` | Total instructions covered | `1234` |
| `instructions-total` | Total instructions | `1500` |
| `modules-coverage-json` | Per-module coverage JSON | `{":core:common": 80.5}` |
| `modules-below-threshold` | Modules below threshold | `:feature:auth,:feature:share` |

**Note:** This action uses INSTRUCTION coverage (JaCoCo metric) which counts bytecode instructions rather than source lines for more accurate coverage measurement.

### Using Outputs

```yaml
- name: Generate coverage report
  id: coverage
  uses: yshrsmz/kover-report-action@v1
  with:
    coverage-files: '**/build/reports/kover/report.xml'

- name: Display coverage
  run: |
    echo "Overall: ${{ steps.coverage.outputs.coverage-percentage }}%"
    echo "Instructions: ${{ steps.coverage.outputs.instructions-covered }}/${{ steps.coverage.outputs.instructions-total }}"
```

## Module Name Format

All module names follow Gradle's colon-separated format:

- `:app` - Single-level module
- `:core:common` - Two-level module
- `:feature:auth:ui` - Three-level module

The action automatically normalizes module names to ensure they have a leading colon.

## Threshold Configuration

### Type-Based Thresholds

Apply thresholds to all modules of a specific type:

```json
{
  "core": 80,      // All :core:* modules require 80%
  "data": 75,      // All :data:* modules require 75%
  "feature": 70,   // All :feature:* modules require 70%
  "default": 60    // All other modules require 60%
}
```

### Module-Specific Overrides

Override threshold for specific modules:

```json
{
  "core": 80,              // :core:common requires 80%
  ":core:testing": 0,      // But :core:testing only requires 0%
  "feature": 70,           // :feature:auth requires 70%
  ":feature:auth:ui": 90,  // But :feature:auth:ui requires 90%
  "default": 60
}
```

### Parent Modules

Parent modules (container modules without source code) typically don't have coverage files:

```json
{
  ":core": 0,        // Parent module, no coverage expected
  "core": 80,        // But child modules like :core:common need 80%
  "default": 60
}
```

Alternatively, hide them using `ignore-modules`:

```yaml
ignore-modules: ':core,:data,:feature,:build-logic'
```

## PR Comment Integration

When `github-token` is provided and the action runs on a pull request, it will:

1. Generate a Markdown coverage report
2. Search for an existing coverage comment
3. Update the existing comment or create a new one

### Required Permissions

```yaml
permissions:
  contents: read
  pull-requests: write  # Required for PR comments
```

### Example PR Comment

```markdown
## 📊 Code Coverage Report

**Overall Coverage: 85.5%**

### Module Coverage

| Module | Coverage | Threshold | Status |
|--------|----------|-----------|--------|
| :core:common | 85.5% | 80% | ✅ |
| :core:testing | N/A | 0% | ⚠️ |
| :data:repository | 78.2% | 75% | ✅ |
| :feature:auth | 65.8% | 70% | ❌ |

### Legend
- ✅ Coverage meets threshold
- ❌ Coverage below threshold
- ⚠️ No coverage report found
```

## Troubleshooting

### No modules found by discovery command

**Symptoms:** Action fails with "No modules found by discovery command"

**Solutions:**
1. Verify command runs locally and outputs module names
2. Expected format: `Project ':module-name'`
3. Check `ignore-modules` doesn't exclude all modules
4. Enable `debug: 'true'` to see command output

Example debug command:
```bash
./gradlew -q projects
# Should output:
# Root project 'myapp'
# +--- Project ':app'
# +--- Project ':core:common'
```

### No coverage files found matching pattern

**Symptoms:** Action fails with "No coverage files found matching pattern"

**Solutions:**
1. Run tests with coverage first: `./gradlew koverXmlReport`
2. Verify files exist: `ls -la **/build/reports/kover/report.xml`
3. Check glob pattern matches your project structure
4. Ensure coverage files are not in `.gitignore`

### Module shows "N/A" coverage

**Expected for:**
- Parent modules (`:core`, `:feature`, `:data`)
- Build-logic modules
- Modules without tests

**Solutions:**
1. Add to `ignore-modules` to hide from report
2. Set threshold to `0` if expected: `{":core": 0}`
3. Verify coverage was generated: `./gradlew :module:koverXmlReport`

### PR comment not posted

**Symptoms:** No comment appears on PR

**Solutions:**
1. Check permissions:
   ```yaml
   permissions:
     pull-requests: write
   ```
2. Verify token provided: `github-token: ${{ secrets.GITHUB_TOKEN }}`
3. Only works on `pull_request` events (not `push`)
4. Check action logs for errors

### Invalid threshold JSON

**Symptoms:** Action fails with JSON parse error

**Solutions:**
1. Validate JSON syntax at [jsonlint.com](https://jsonlint.com)
2. Ensure proper YAML quoting:
   ```yaml
   # ✅ Correct:
   thresholds: '{"core": 80, "default": 60}'

   # ❌ Wrong (parsed as YAML object):
   thresholds: {"core": 80, "default": 60}
   ```
3. Check for trailing commas (invalid in JSON)
4. Ensure values are 0-100

## Debug Mode

Enable detailed logging:

```yaml
- uses: yshrsmz/kover-report-action@v1
  with:
    debug: 'true'
    # ... other inputs
```

Debug mode logs:
- Discovery command output
- Each module's coverage file path
- Threshold matching decisions
- Module type extraction
- Parsed XML structure

## Security

This action implements several security measures:

- **Token Masking:** GitHub token is automatically masked in logs
- **Path Validation:** Prevents path traversal attacks
- **Command Safety:** Discovery commands execute without shell expansion
- **Input Validation:** All inputs are validated before use

## Migration Guide

### From omnitweety-android/.github/actions/coverage-report

**Before:**
```yaml
- uses: ./.github/actions/coverage-report
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    gradle-command: './gradlew -q projects'
    thresholds: '{"core": 80, "data": 75, "feature": 70, "default": 60}'
    ignore-modules: ':core,:core:testing,:data,:feature,:build-logic'
```

**After:**
```yaml
- uses: yshrsmz/kover-report-action@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    discovery-command: './gradlew -q projects'
    module-path-template: '{module}/build/reports/kover/report.xml'
    thresholds: '{"core": 80, "data": 75, "feature": 70, "default": 60}'
    ignore-modules: ':core,:core:testing,:data,:feature,:build-logic'
```

**Changes:**
- `gradle-command` → `discovery-command`
- Added `module-path-template` (was hardcoded)

## Development

### Prerequisites

- Node.js 20.x or higher
- pnpm package manager

### Setup

```bash
# Install dependencies
pnpm install

# Format code
pnpm run format

# Lint code
pnpm run lint

# Build the action
pnpm run build

# Run all checks
pnpm run all
```

### Testing

```bash
# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Generate coverage report
pnpm test:coverage
```

### Project Structure

```
.
├── src/
│   ├── index.ts          # Main orchestration
│   ├── discovery.ts      # Module discovery
│   ├── parser.ts         # Kover XML parsing
│   ├── aggregator.ts     # Coverage aggregation
│   ├── threshold.ts      # Threshold matching
│   ├── report.ts         # Markdown generation
│   ├── github.ts         # PR comment posting
│   └── paths.ts          # Path resolution
├── __tests__/            # Test files
├── __fixtures__/         # Test fixtures
├── dist/                 # Compiled action (committed)
├── action.yml            # Action metadata
└── docs/                 # Specification & planning docs
```

## License

Apache License 2.0 - See [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## Support

- 🐛 [Report issues](https://github.com/yshrsmz/kover-report-action/issues)
- 💡 [Feature requests](https://github.com/yshrsmz/kover-report-action/issues)
- 📖 [Documentation](https://github.com/yshrsmz/kover-report-action)
