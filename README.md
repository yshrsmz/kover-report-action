# Kover Report Action

A GitHub Action for generating and reporting code coverage from Kover XML reports with multi-module support. This action is designed to work with any Kotlin/Android project using Kover for code coverage.

[![GitHub release](https://img.shields.io/github/v/release/yshrsmz/kover-report-action)](https://github.com/yshrsmz/kover-report-action/releases)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

## Features

- 📊 **Multi-Module Support** - Handle projects with multiple modules and aggregate coverage
- 🔍 **Flexible Discovery** - Command-based (Gradle) or glob pattern module discovery
- 🎯 **Configurable Thresholds** - Per-module type and per-module name threshold configuration
- 💬 **PR Integration** - Post coverage reports as PR comments with automatic updates
- 📈 **Coverage History & Trends** - Track coverage over time with trend indicators (↑↓→) and comparison against baseline
- 🔄 **Coverage Outputs** - Export coverage data for use in other workflow steps
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

### With Coverage History & Trends

```yaml
- name: Run tests with coverage
  run: ./gradlew koverXmlReport

- name: Generate coverage report
  uses: yshrsmz/kover-report-action@v1
  with:
    coverage-files: '**/build/reports/kover/report.xml'
    thresholds: '{"default": 65}'
    github-token: ${{ secrets.GITHUB_TOKEN }}
    enable-history: 'true'
    baseline-branch: 'main'
    history-retention: '50'
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

### History & Trends

| Input | Description | Default | Required |
|-------|-------------|---------|----------|
| `enable-history` | Enable coverage history tracking and trend indicators | `false` | No |
| `baseline-branch` | Branch to use as baseline for trend comparison | `main` | No |
| `history-retention` | Number of history entries to keep | `50` | No |

**How it works:**
- When enabled, coverage history is stored in GitHub Artifacts with 90-day retention
- Each workflow run adds a new history entry with timestamp, branch, commit, and coverage data
- Reports show trend indicators (↑↓→) comparing current coverage vs baseline branch
- History persists across workflow runs and is automatically managed

**Trend Indicators:**
- ↑ Green: Coverage improved by >0.1%
- ↓ Red: Coverage decreased by >0.1%
- → Gray: Coverage stable (within ±0.1%)

**Setup:**

To enable history tracking, you need to run the action with `enable-history: 'true'` on **both your baseline branch (e.g., main) AND feature branches**:

```yaml
name: Coverage

on:
  push:
    branches: [main]  # Run on baseline branch
  pull_request:       # Run on PRs

jobs:
  coverage:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
      actions: write        # Required for artifacts

    steps:
      - uses: actions/checkout@v4

      - name: Run tests
        run: ./gradlew koverXmlReport

      - name: Coverage report
        uses: yshrsmz/kover-report-action@v1
        with:
          coverage-files: '**/build/reports/kover/report.xml'
          github-token: ${{ secrets.GITHUB_TOKEN }}
          enable-history: 'true'      # Enable on ALL branches
          baseline-branch: 'main'     # Compare against main
          history-retention: '50'
```

**How baseline comparison works:**
1. **First run on main branch**: Creates initial history entry (no comparison yet)
2. **Subsequent runs on main**: Updates history, can show trends vs previous main commits
3. **PR branches**: Compare against most recent main branch history entry
4. **Result**: PR comments show how coverage changed compared to main (↑↓→ indicators)

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

Without history tracking:

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

With history tracking enabled:

```markdown
## 📊 Code Coverage Report

**Overall Coverage: 85.5%** ↑ +2.3%

### Module Coverage

| Module | Coverage | Threshold | Change | Status |
|--------|----------|-----------|--------|--------|
| :core:common | 85.5% | 80% | ↑ +1.5% | ✅ |
| :core:testing | N/A | 0% | → +0.0% | ⚠️ |
| :data:repository | 78.2% | 75% | → -0.1% | ✅ |
| :feature:auth | 65.8% | 70% | ↓ -3.2% | ❌ |

### Legend
- ✅ Coverage meets threshold
- ❌ Coverage below threshold
- ⚠️ No coverage report found
- ↑ Coverage improved
- ↓ Coverage decreased
- → Coverage stable
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

### History not showing trends

**Symptoms:** No trend indicators (↑↓→) in PR comments

**Solutions:**
1. Verify `enable-history: 'true'` is set
2. Check baseline branch has history data:
   - First run on baseline creates history
   - Second run can show trends
3. Verify artifact permissions:
   ```yaml
   permissions:
     contents: read
     actions: write  # Required for artifacts
   ```
4. Enable `debug: 'true'` to see history loading logs

### History artifact not found

**Symptoms:** Warning "Could not load history artifact"

**Expected on:**
- First run of the action (no history yet)
- After changing `baseline-branch` to a new branch
- After 90 days (artifact retention expires)

**Not an error:** This is expected behavior. History will be created automatically.

### Invalid history-retention value

**Symptoms:** Action fails with "Invalid history-retention value"

**Solutions:**
1. Must be a positive integer: `'50'` not `'50.5'`
2. Quote the value in YAML: `'50'` not `50`
3. Minimum value is 1

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
- History loading and comparison (when `enable-history: 'true'`)
- Artifact download/upload operations
- Baseline branch comparison results

## Security

This action implements several security measures:

- **Token Masking:** GitHub token is automatically masked in logs
- **Path Validation:** Prevents path traversal attacks
- **Command Safety:** Discovery commands execute without shell expansion
- **Input Validation:** All inputs are validated before use

## Development

Interested in contributing? See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, coding standards, and contribution guidelines.

## License

Apache License 2.0 - See [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## Support

- 🐛 [Report issues](https://github.com/yshrsmz/kover-report-action/issues)
- 💡 [Feature requests](https://github.com/yshrsmz/kover-report-action/issues)
- 📖 [Documentation](https://github.com/yshrsmz/kover-report-action)
