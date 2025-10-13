# Kover Report Action - Implementation Plan

## Overview

This document outlines the phased implementation plan for the generalized Kover Report Action. The plan is designed to deliver a working MVP quickly while maintaining code quality and allowing for future enhancements.

## Timeline & Effort Estimates

**MVP (Phase 1-3): 10-13 hours** (includes TDD)
- Phase 0: Test Infrastructure Setup (1 hour)
- Phase 1: Core Multi-Module Support (5-6 hours with TDD)
- Phase 2: PR Integration (2-3 hours with TDD)
- Phase 3: Polish & Documentation (2-3 hours)

**Future Enhancements (Phase 4): 6-8 hours**
- Coverage history tracking
- Trend visualization
- ASCII graphs

## Development Methodology: TDD (Test-Driven Development)

Following **t-wada's TDD approach**, we write tests BEFORE implementation:

### TDD Cycle (Red-Green-Refactor)

1. **🔴 RED** - Write a failing test
   - Write test for desired behavior
   - Run test (should fail - no implementation yet)
   - Verify test fails for the right reason

2. **🟢 GREEN** - Make it pass
   - Write minimal code to make test pass
   - Don't worry about perfection
   - Just make it work

3. **🔵 REFACTOR** - Clean up
   - Improve code quality
   - Remove duplication
   - Ensure tests still pass

### Benefits for This Project

- **Confidence:** Tests prove each module works before integration
- **Design:** Writing tests first improves API design
- **Documentation:** Tests serve as executable examples
- **Regression prevention:** Catch breaking changes early
- **Refactoring safety:** Change code with confidence

### TDD Workflow Example

For each module (e.g., `parser.ts`):

```bash
# 1. 🔴 RED - Create test file first
touch src/__tests__/parser.test.ts
# Write failing tests
pnpm test  # Tests fail ❌

# 2. 🟢 GREEN - Implement minimal code
touch src/parser.ts
# Write just enough code to pass
pnpm test  # Tests pass ✅

# 3. 🔵 REFACTOR - Improve code quality
# Clean up, add error handling, improve naming
pnpm test  # Tests still pass ✅

# 4. Repeat for next module
```

### Testing Philosophy (t-wada style)

- **Tests are specifications:** Tests describe WHAT the code should do
- **Small steps:** Write one test at a time, make it pass, then refactor
- **No untested code:** Every line should be covered by a test written first
- **Readable tests:** Tests should read like documentation
- **Fast feedback:** Tests run in <1 second for instant feedback

---

## Phase 0: Test Infrastructure Setup (1 hour)

### Goal
Set up testing framework and test fixtures before writing any implementation code.

### Tasks

#### 0.1 Install Test Framework (15 min)

**File to modify:** `package.json`

**Actions:**
```bash
pnpm add -D vitest @vitest/ui
```

**Update package.json scripts:**
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage"
  }
}
```

**Why Vitest:**
- Fast (uses Vite)
- Compatible with Jest API (familiar syntax)
- Native TypeScript support
- Great for Node.js projects

**Acceptance Criteria:**
- ✅ Vitest installed successfully
- ✅ `pnpm test` runs (even with 0 tests)
- ✅ TypeScript types resolve correctly

#### 0.2 Create Test Fixtures (30 min)

**Create directory structure:**
```
__fixtures__/
├── kover-reports/
│   ├── valid-full-coverage.xml      # 100% coverage
│   ├── valid-partial-coverage.xml   # 85.5% coverage
│   ├── valid-zero-coverage.xml      # 0% coverage
│   ├── invalid-malformed.xml        # Invalid XML
│   ├── invalid-no-instruction.xml   # Missing INSTRUCTION counter
│   └── empty.xml                    # Empty file
├── gradle-output/
│   ├── multi-module.txt             # Gradle projects output
│   ├── single-module.txt
│   ├── empty.txt
│   └── malformed.txt
└── thresholds/
    ├── simple.json                  # {"default": 60}
    ├── complex.json                 # Type + name based
    └── invalid.json                 # Malformed JSON
```

**Sample Kover XML (valid-partial-coverage.xml):**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<report name="Kover report">
  <counter type="INSTRUCTION" missed="145" covered="855"/>
  <counter type="LINE" missed="50" covered="200"/>
  <counter type="BRANCH" missed="20" covered="80"/>
</report>
```

**Sample Gradle output (multi-module.txt):**
```
Root project 'myapp'
+--- Project ':app'
+--- Project ':core:common'
+--- Project ':core:testing'
+--- Project ':data:repository'
\--- Project ':feature:auth'
```

**Acceptance Criteria:**
- ✅ All fixture files created
- ✅ XML fixtures are valid/invalid as intended
- ✅ Gradle output fixtures cover edge cases
- ✅ Fixtures documented with comments

#### 0.3 Create Test Utilities (15 min)

**New file:** `__tests__/helpers.ts`

```typescript
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

// Load fixture file
export async function loadFixture(relativePath: string): Promise<string> {
  const fixturePath = join(__dirname, '../__fixtures__', relativePath);
  return readFile(fixturePath, 'utf-8');
}

// Create temporary test directory
export function createTempDir(): string {
  // Implementation for temp directories
}

// Assert error thrown with message
export function expectError(fn: () => any, message: string): void {
  // Helper for error assertions
}
```

**Acceptance Criteria:**
- ✅ Helper functions implemented
- ✅ Helpers work with Vitest
- ✅ Can load fixtures easily in tests

### Phase 0 Completion Criteria

- ✅ Vitest configured and running
- ✅ Test fixtures cover all edge cases
- ✅ Test utilities ready for use
- ✅ Can run `pnpm test` successfully (with 0 tests)
- ✅ Foundation ready for TDD

---

## Phase 1: Core Multi-Module Support (5-6 hours with TDD)

### Goal
Implement basic multi-module coverage parsing, aggregation, and threshold checking using TDD.

### Tasks

#### 1.1 Project Setup & Dependencies (30 min)

**Files to modify:**
- `package.json`

**Actions:**
- Add dependencies:
  - `fast-xml-parser` (XML parsing)
  - `@actions/exec` (command execution)
  - `glob` (file pattern matching)
- Add dev dependencies:
  - `@types/node` (already present)
- Update `package.json` scripts if needed

**Acceptance Criteria:**
- ✅ All dependencies install successfully
- ✅ TypeScript can resolve all imports
- ✅ Build completes without errors

#### 1.2 Module Discovery Implementation (1.5 hours with TDD)

**🔴 RED: Write Tests First (30 min)**

**New file:** `src/__tests__/discovery.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { parseGradleProjects, discoverModulesFromCommand, discoverModulesFromGlob } from '../discovery';
import { loadFixture } from '../../__tests__/helpers';

describe('parseGradleProjects', () => {
  it('should extract module names from Gradle output', async () => {
    const output = await loadFixture('gradle-output/multi-module.txt');
    const modules = parseGradleProjects(output);

    expect(modules).toEqual([
      ':app',
      ':core:common',
      ':core:testing',
      ':data:repository',
      ':feature:auth'
    ]);
  });

  it('should filter out Root project line', async () => {
    const output = await loadFixture('gradle-output/multi-module.txt');
    const modules = parseGradleProjects(output);

    expect(modules).not.toContain('myapp');
  });

  it('should handle single module', async () => {
    const output = await loadFixture('gradle-output/single-module.txt');
    const modules = parseGradleProjects(output);

    expect(modules).toEqual([':app']);
  });

  it('should return empty array for empty output', async () => {
    const modules = parseGradleProjects('');
    expect(modules).toEqual([]);
  });

  it('should handle modules with special characters', () => {
    const output = "Project ':module-name_123'";
    const modules = parseGradleProjects(output);
    expect(modules).toEqual([':module-name_123']);
  });
});

describe('discoverModulesFromCommand', () => {
  it('should execute command and return modules', async () => {
    // Mock @actions/exec - to be implemented
    // This test will guide implementation
  });

  it('should filter ignored modules', async () => {
    const output = await loadFixture('gradle-output/multi-module.txt');
    // Test that :core:testing is excluded when in ignoredModules
  });

  it('should normalize module names', async () => {
    // Test that 'core' gets normalized to ':core'
  });
});

describe('discoverModulesFromGlob', () => {
  it('should find files matching pattern', async () => {
    // Test glob pattern matching
  });

  it('should extract module names from file paths', async () => {
    const files = ['core/common/build/reports/kover/report.xml'];
    // Should extract ':core:common'
  });

  it('should filter ignored modules from glob results', async () => {
    // Test ignore-modules with glob discovery
  });
});
```

**Run tests:** `pnpm test` → All tests should FAIL (no implementation yet)

**🟢 GREEN: Implement (45 min)**

**New file:** `src/discovery.ts`

```typescript
import { exec } from '@actions/exec';
import { glob } from 'glob';

export async function discoverModulesFromCommand(
  command: string,
  ignoredModules: string[]
): Promise<string[]> {
  let output = '';
  await exec(command, [], {
    listeners: {
      stdout: (data: Buffer) => { output += data.toString(); }
    }
  });

  const modules = parseGradleProjects(output);
  return filterIgnoredModules(modules, ignoredModules);
}

export function parseGradleProjects(output: string): string[] {
  const regex = /Project '([^']+)'/g;
  const modules: string[] = [];
  let match;

  while ((match = regex.exec(output)) !== null) {
    const moduleName = match[1];
    if (!moduleName.startsWith('Root project')) {
      modules.push(moduleName);
    }
  }

  return modules;
}

function filterIgnoredModules(modules: string[], ignoredModules: string[]): string[] {
  const normalized = ignoredModules.map(m => m.startsWith(':') ? m : `:${m}`);
  return modules.filter(m => !normalized.includes(m));
}

export async function discoverModulesFromGlob(
  pattern: string,
  ignoredModules: string[]
): Promise<Array<{module: string, filePath: string}>> {
  const files = await glob(pattern);

  return files
    .map(filePath => ({
      module: extractModuleName(filePath),
      filePath
    }))
    .filter(({ module }) => !ignoredModules.includes(module));
}

function extractModuleName(filePath: string): string {
  // Remove common suffixes and convert to module format
  const withoutSuffix = filePath.replace('/build/reports/kover/report.xml', '');
  return ':' + withoutSuffix.replace(/\//g, ':');
}
```

**Run tests:** `pnpm test` → Tests should PASS

**🔵 REFACTOR: Clean up (15 min)**

- Extract regex pattern to constant
- Add JSDoc comments
- Improve error messages
- Add debug logging

**Run tests again:** `pnpm test` → Tests should still PASS

**Acceptance Criteria:**
- ✅ All tests pass
- ✅ Code coverage >80% for discovery.ts
- ✅ Edge cases handled (empty output, malformed, special chars)
- ✅ Ignore-modules filter works correctly

#### 1.3 Path Resolution (30 min)

**New file:** `src/paths.ts`

**Functions to implement:**
```typescript
// Resolve module path using template
export function resolveModulePath(
  moduleName: string,
  template: string
): string

// Transform module name for path
function normalizeModuleForPath(moduleName: string): string
```

**Implementation details:**
- Transform module name: `:core:common` → `core/common`
  - Remove leading `:`
  - Replace remaining `:` with `/`
- Replace `{module}` placeholder in template
- Return resolved path

**Test cases:**
- `:core:common` with `{module}/build/reports/kover/report.xml`
- `:app` with `{module}/kover.xml`
- Edge cases: empty template, missing placeholder

**Acceptance Criteria:**
- ✅ Module name transforms correctly to path format
- ✅ Template placeholder replacement works
- ✅ Returns correct absolute or relative paths

#### 1.3 Path Resolution (45 min with TDD)

**🔴 RED: Write Tests First (15 min)**

**New file:** `src/__tests__/paths.test.ts`

```typescript
describe('resolveModulePath', () => {
  it('should transform :core:common to core/common', () => {
    const result = resolveModulePath(':core:common', '{module}/build/reports/kover/report.xml');
    expect(result).toBe('core/common/build/reports/kover/report.xml');
  });

  it('should handle single-level module :app', () => {
    const result = resolveModulePath(':app', '{module}/kover.xml');
    expect(result).toBe('app/kover.xml');
  });

  it('should handle three-level module', () => {
    const result = resolveModulePath(':feature:auth:ui', '{module}/report.xml');
    expect(result).toBe('feature/auth/ui/report.xml');
  });
});
```

**🟢 GREEN: Implement (20 min)** → Write minimal code to pass tests

**🔵 REFACTOR: Clean up (10 min)** → Add error handling, improve naming

---

#### 1.4 XML Parsing Implementation (1.5 hours with TDD)

**🔴 RED: Write Tests First (30 min)**

**New file:** `src/__tests__/parser.test.ts`

```typescript
describe('parseCoverageFile', () => {
  it('should parse valid Kover XML', async () => {
    const result = await parseCoverageFile('__fixtures__/kover-reports/valid-partial-coverage.xml');

    expect(result).toEqual({
      covered: 855,
      missed: 145,
      total: 1000,
      percentage: 85.5
    });
  });

  it('should return null for missing file', async () => {
    const result = await parseCoverageFile('non-existent.xml');
    expect(result).toBeNull();
  });

  it('should return null for invalid XML', async () => {
    const result = await parseCoverageFile('__fixtures__/kover-reports/invalid-malformed.xml');
    expect(result).toBeNull();
  });

  it('should handle 100% coverage', async () => {
    const result = await parseCoverageFile('__fixtures__/kover-reports/valid-full-coverage.xml');
    expect(result?.percentage).toBe(100);
  });

  it('should handle 0% coverage', async () => {
    const result = await parseCoverageFile('__fixtures__/kover-reports/valid-zero-coverage.xml');
    expect(result?.percentage).toBe(0);
  });

  it('should extract INSTRUCTION counter not LINE', async () => {
    // Test that we specifically use INSTRUCTION type
  });
});
```

**🟢 GREEN: Implement (45 min)**

**New file:** `src/parser.ts`

**Functions to implement:**
```typescript
export interface CoverageResult {
  covered: number
  missed: number
  total: number
  percentage: number
}

// Parse Kover XML file
export async function parseCoverageFile(
  filePath: string
): Promise<CoverageResult | null>

// Extract INSTRUCTION counter from parsed XML
function extractInstructionCounter(xmlData: any): CoverageResult | null
```

**Implementation details:**
- Use `fast-xml-parser` with appropriate options
- Find counter with `type="INSTRUCTION"`
- Extract `missed` and `covered` attributes
- Calculate: `total = missed + covered`
- Calculate: `percentage = (covered / total) * 100`
- Handle division by zero (no instructions)
- Return null for missing files (expected for parent modules)

**Error handling:**
- File not found → return null, log debug message
- Invalid XML → return null, log warning
- Missing INSTRUCTION counter → return null, log warning

**Test cases:**
- Valid Kover XML with INSTRUCTION counter
- XML with multiple counter types
- Empty coverage (0/0)
- Malformed XML
- Missing file

**Acceptance Criteria:**
- ✅ Valid XML parsed correctly
- ✅ INSTRUCTION counter extracted (not LINE or BRANCH)
- ✅ Coverage percentage calculated correctly
- ✅ Null returned for missing/invalid files
- ✅ Warnings logged appropriately

**🔵 REFACTOR: Clean up (15 min)** → Improve error messages, add security checks

**Acceptance Criteria:**
- ✅ All tests pass
- ✅ Returns null for missing/invalid files (doesn't throw)
- ✅ INSTRUCTION counter extracted correctly
- ✅ Percentage calculation accurate to 1 decimal place

---

#### 1.5 Module Type Classification & Threshold Matching (1 hour with TDD)

**🔴 RED: Write Tests First (20 min)**

**New file:** `src/__tests__/threshold.test.ts`

```typescript
describe('getModuleType', () => {
  it('should extract type from :core:common', () => {
    expect(getModuleType(':core:common')).toBe('core');
  });

  it('should extract type from :app', () => {
    expect(getModuleType(':app')).toBe('app');
  });

  it('should return default for empty string', () => {
    expect(getModuleType('')).toBe('default');
  });
});

describe('getThresholdForModule', () => {
  const thresholds = {
    'core': 80,
    'data': 75,
    ':core:testing': 0,  // Exact match
    'default': 60
  };

  it('should use exact name match first', () => {
    expect(getThresholdForModule(':core:testing', thresholds, 50)).toBe(0);
  });

  it('should use type match if no exact match', () => {
    expect(getThresholdForModule(':core:common', thresholds, 50)).toBe(80);
  });

  it('should use default if no type match', () => {
    expect(getThresholdForModule(':feature:auth', thresholds, 50)).toBe(60);
  });

  it('should use minCoverage if no default', () => {
    expect(getThresholdForModule(':unknown', {}, 70)).toBe(70);
  });

  it('should use 0 as hard default', () => {
    expect(getThresholdForModule(':unknown', {}, 0)).toBe(0);
  });
});
```

**🟢 GREEN: Implement (30 min)** → Implement threshold matching logic

**🔵 REFACTOR: Clean up (10 min)** → Extract constants, improve readability

---

#### 1.6 Coverage Aggregation (1 hour with TDD)

**🔴 RED: Write Tests First (25 min)** → Test weighted aggregation, null handling

**🟢 GREEN: Implement (25 min)** → Implement Promise.all parallel parsing

**🔵 REFACTOR: Clean up (10 min)** → Improve performance, add logging

---

#### 1.7 Update Main Entry Point (1 hour)

**Note:** This integrates all modules, so most logic is already tested. Focus on:
- Input validation tests
- Error handling tests
- Output format tests

---

#### 1.8 Update action.yml (15 min)

**New file:** `src/threshold.ts`

**Functions to implement:**
```typescript
export interface ThresholdConfig {
  [key: string]: number
}

// Get module type from name
export function getModuleType(moduleName: string): string

// Get threshold for specific module
export function getThresholdForModule(
  moduleName: string,
  thresholds: ThresholdConfig,
  minCoverage: number
): number

// Check if coverage meets threshold
export function checkThreshold(
  coverage: number,
  threshold: number
): boolean
```

**Implementation details:**
- Module type extraction:
  - Split by `:`, filter empty strings
  - Return first part (e.g., `:core:testing` → `core`)
  - Return `'default'` if no parts
- Threshold matching order:
  1. Exact module name match (e.g., `:core:testing`)
  2. Module type match (e.g., `core`)
  3. `default` key in thresholds
  4. `minCoverage` parameter
  5. Hard default: `0`

**Test cases:**
- Exact name match overrides type match
- Type match when no exact match
- Default fallback
- Edge cases: `:app`, empty string

**Acceptance Criteria:**
- ✅ Module type extracted correctly
- ✅ Threshold matching follows priority order
- ✅ All fallback levels work correctly
- ✅ Threshold comparison works (>= logic)

#### 1.6 Coverage Aggregation (45 min)

**New file:** `src/aggregator.ts`

**Functions to implement:**
```typescript
export interface ModuleCoverage {
  module: string
  coverage: CoverageResult | null
  threshold: number
  passed: boolean
}

export interface OverallCoverage {
  percentage: number
  covered: number
  total: number
  modules: ModuleCoverage[]
}

// Aggregate coverage from multiple modules
export async function aggregateCoverage(
  modules: Array<{name: string, filePath: string}>,
  thresholds: ThresholdConfig,
  minCoverage: number
): Promise<OverallCoverage>
```

**Implementation details:**
- Parse each module's coverage file in parallel (`Promise.all`)
- Calculate per-module threshold and pass/fail status
- Sum up all `covered` and `total` values
- Calculate overall: `(sum covered) / (sum total) * 100`
- Important: NOT average of percentages (weighted by module size)
- Handle modules with null coverage (missing files)

**Test cases:**
- Multiple modules with different coverage
- Modules with missing coverage files
- Empty module list
- Single module

**Acceptance Criteria:**
- ✅ Overall coverage calculated correctly (weighted sum)
- ✅ Per-module status includes threshold and pass/fail
- ✅ Missing coverage handled gracefully
- ✅ Parallel parsing for performance

#### 1.7 Update Main Entry Point (45 min)

**File to modify:** `src/index.ts`

**Changes:**
- Add input reading for new parameters:
  - `discovery-command`, `coverage-files`, `module-path-template`
  - `thresholds`, `min-coverage`, `ignore-modules`
  - `github-token`, `title`, `enable-pr-comment`, `debug`
- Implement main workflow:
  1. Parse thresholds JSON (with error handling)
  2. Discover modules (command or glob)
  3. Resolve module paths (if using command discovery)
  4. Aggregate coverage
  5. Set outputs
  6. Check min-coverage and fail if needed
- Add debug logging (controlled by `debug` input)
- Error handling for each step

**Acceptance Criteria:**
- ✅ All inputs read correctly
- ✅ Workflow orchestrates all modules correctly
- ✅ Outputs set properly
- ✅ Action fails when coverage < min-coverage
- ✅ Debug logging works when enabled
- ✅ Error messages are clear and actionable

#### 1.8 Update action.yml (15 min)

**File to modify:** `action.yml`

**Changes:**
- Add all new inputs with descriptions and defaults
- Add new outputs (`modules-coverage-json`, `modules-below-threshold`)
- Update descriptions to reflect multi-module support

**Acceptance Criteria:**
- ✅ All inputs documented with clear descriptions
- ✅ Required vs optional inputs correctly marked
- ✅ Default values match spec
- ✅ Outputs documented

### Phase 1 Completion Criteria

- ✅ Can discover modules via command or glob
- ✅ Can parse Kover XML files
- ✅ Calculates per-module and overall coverage correctly
- ✅ Applies thresholds correctly (exact → type → default)
- ✅ Sets all required outputs
- ✅ Fails action when coverage below minimum
- ✅ Handles missing coverage files gracefully
- ✅ Build and package successfully
- ✅ No TypeScript errors

## Phase 2: PR Integration (2-3 hours with TDD)

### Goal
Generate Markdown reports and post/update PR comments using TDD.

### Tasks

#### 2.1 Report Generation (1.5 hours with TDD)

**🔴 RED: Write Tests First (30 min)**

**New file:** `src/__tests__/report.test.ts`

```typescript
describe('generateMarkdownReport', () => {
  it('should generate report with all passing modules', () => {
    const coverage: OverallCoverage = {
      percentage: 85.5,
      covered: 855,
      total: 1000,
      modules: [
        { module: ':core:common', coverage: { covered: 855, missed: 145, total: 1000, percentage: 85.5 }, threshold: 80, passed: true }
      ]
    };

    const report = generateMarkdownReport(coverage, 'Coverage Report');

    expect(report).toContain('## 📊 Coverage Report');
    expect(report).toContain('**Overall Coverage: 85.5%**');
    expect(report).toContain(':core:common');
    expect(report).toContain('✅');
    expect(report).toContain('<!-- kover-coverage-report -->');
  });

  it('should show ⚠️ for null coverage', () => {
    // Test N/A display for parent modules
  });

  it('should show ❌ for failing modules', () => {
    // Test failed module display
  });

  it('should sort modules alphabetically', () => {
    // Test sorting
  });
});
```

**🟢 GREEN: Implement (45 min)**

#### 2.1 Report Generation (1 hour)

**New file:** `src/report.ts`

**Functions to implement:**
```typescript
// Generate Markdown table report
export function generateMarkdownReport(
  overall: OverallCoverage,
  title: string
): string

// Generate console report (for logs)
export function generateConsoleReport(
  overall: OverallCoverage,
  title: string
): string

// Helper: Format percentage with color/emoji
function formatStatus(passed: boolean): string

// Helper: Format coverage percentage
function formatPercentage(coverage: CoverageResult | null): string
```

**Implementation details:**
- Markdown format with table:
  - Columns: Module | Coverage | Threshold | Status
  - Overall coverage at top
  - Legend at bottom
  - Footer with link to action
- Console format with box-drawing characters (optional, can be simple)
- Status indicators: ✅ (pass), ❌ (fail), ⚠️ (no coverage)
- Sort modules alphabetically for consistent output
- HTML comment identifier: `<!-- kover-coverage-report -->`

**Test cases:**
- All modules passing
- Some modules failing
- Modules with missing coverage
- Single module vs many modules

**Acceptance Criteria:**
- ✅ Markdown report renders correctly on GitHub
- ✅ Table formatting is clean and readable
- ✅ Status indicators display correctly
- ✅ Console report is human-readable
- ✅ HTML comment identifier present

#### 2.2 GitHub PR Comment Integration (1 hour)

**New file:** `src/github.ts`

**Functions to implement:**
```typescript
// Post or update PR comment
export async function postCoverageComment(
  token: string,
  report: string,
  identifier: string
): Promise<void>

// Find existing comment with identifier
async function findExistingComment(
  octokit: any,
  owner: string,
  repo: string,
  prNumber: number,
  identifier: string
): Promise<number | null>
```

**Implementation details:**
- Use `@actions/github` for Octokit client
- Check if running in PR context (`github.context.payload.pull_request`)
- Search for existing comment by HTML identifier
- If found → Update comment (`octokit.rest.issues.updateComment`)
- If not found → Create new comment (`octokit.rest.issues.createComment`)
- If not PR or token missing → Skip (don't fail action)

**Error handling:**
- Network errors → Log warning, don't fail action
- Permission errors → Log warning with helpful message
- Not in PR context → Log info message, skip

**Test cases:**
- First comment creation
- Updating existing comment
- Running outside PR context
- Missing token
- API errors

**Acceptance Criteria:**
- ✅ Creates new comment on first run
- ✅ Updates same comment on subsequent runs
- ✅ Handles non-PR contexts gracefully
- ✅ Errors don't fail the action
- ✅ Clear log messages for debugging

### Phase 2 Completion Criteria

- ✅ Generates well-formatted Markdown report
- ✅ Posts report as PR comment
- ✅ Updates existing comment instead of creating duplicates
- ✅ Works correctly in non-PR contexts
- ✅ Errors are non-fatal and well-logged

## Phase 3: Polish & Testing (2-3 hours)

### Goal
Add comprehensive error handling, validation, documentation, and testing.

### Tasks

#### 3.1 Input Validation & Error Handling (1 hour)

**Files to modify:** All source files

**Actions:**
- Validate all inputs at start of `index.ts`:
  - Check `thresholds` is valid JSON
  - Validate `min-coverage` is 0-100
  - Validate either `discovery-command` or `coverage-files` provided
  - Check file paths are safe (no path traversal)
- Add try-catch blocks around all I/O operations
- Improve error messages with actionable suggestions
- Add command injection prevention for `discovery-command`
- Add debug logging throughout

**Security checks:**
- Command validation (no shell expansion)
- Path validation (no `../` traversal)
- Token never logged

**Acceptance Criteria:**
- ✅ Invalid inputs fail with clear error messages
- ✅ All I/O errors caught and handled
- ✅ Security checks prevent common vulnerabilities
- ✅ Debug mode provides detailed execution logs
- ✅ Error messages suggest fixes

#### 3.2 Documentation (45 min)

**Files to create/update:**
- `README.md` - Complete user documentation
- `CONTRIBUTING.md` - Development guide
- `examples/` - Example workflows

**README.md sections:**
- Overview and features
- Quick start examples
- Complete input/output reference
- Usage examples (single module, multi-module, etc.)
- Threshold configuration guide
- Troubleshooting common issues
- Migration guide from reference action

**Example workflows:**
- Single module project
- Multi-module with Gradle discovery
- Multi-module with glob pattern
- Custom thresholds configuration
- Integration with existing CI

**Acceptance Criteria:**
- ✅ README is clear and comprehensive
- ✅ All inputs/outputs documented with examples
- ✅ At least 3 example workflows provided
- ✅ Migration guide for omnitweety-android users
- ✅ Troubleshooting section covers common issues

#### 3.3 Build & Package (15 min)

**Actions:**
- Run full build: `pnpm run build`
- Verify `dist/index.js` is generated correctly
- Test that bundled file includes all dependencies
- Verify no external dependencies required at runtime
- Check bundle size (should be reasonable, <5MB)

**Acceptance Criteria:**
- ✅ Build completes without errors
- ✅ `dist/` directory contains bundled action
- ✅ No missing dependencies in bundle
- ✅ Action runs from `dist/index.js`

#### 3.4 Manual Testing (45 min)

**Test scenarios:**

1. **Single module project:**
   - Create test Kover XML report
   - Run action with simple config
   - Verify outputs are correct

2. **Multi-module with command:**
   - Test with Gradle projects command
   - Verify module discovery works
   - Check threshold matching (type and name)

3. **Multi-module with glob:**
   - Test with glob pattern
   - Verify file discovery works
   - Check module name extraction

4. **Edge cases:**
   - No coverage files found
   - Coverage below minimum (should fail)
   - Missing coverage for some modules
   - Invalid threshold JSON
   - Running outside PR context

5. **PR integration:**
   - Test on actual PR
   - Verify comment creation
   - Verify comment update on re-run

**Acceptance Criteria:**
- ✅ All test scenarios pass
- ✅ Outputs match expected values
- ✅ Error cases handled gracefully
- ✅ PR comments work correctly
- ✅ No unexpected failures

#### 3.5 CI/CD Setup (30 min)

**File to create:** `.github/workflows/ci.yml` (if not exists)

**Actions:**
- Add workflow to test action on push/PR
- Test build process
- Test on sample coverage reports
- Add auto-build workflow (like reference action)
- Verify `dist/` stays in sync with source

**Workflow jobs:**
1. Build & Lint
2. Test action with sample data
3. Verify dist is up-to-date

**Acceptance Criteria:**
- ✅ CI runs on all PRs and pushes
- ✅ Build verification works
- ✅ Action tested with sample data
- ✅ Auto-build workflow commits dist changes

### Phase 3 Completion Criteria

- ✅ All inputs validated
- ✅ Comprehensive error handling
- ✅ Complete documentation (README, examples)
- ✅ Manual testing completed successfully
- ✅ CI/CD workflows in place
- ✅ Ready for v1.0.0 release

## Phase 4: Coverage History (Future Enhancement, 6-8 hours)

### Goal
Add coverage history tracking with artifact storage and trend visualization.

### Tasks

#### 4.1 History Storage (2 hours)

**New file:** `src/history.ts`

**Features:**
- Store coverage data in GitHub artifacts
- Compare against baseline (main branch)
- Maintain configurable history retention
- JSON format with version, branch, timestamp

**Inputs to add:**
- `enable-history: 'true'`
- `history-retention: '50'`
- `default-branch: 'main'`

#### 4.2 Trend Indicators (2 hours)

**Update:** `src/report.ts`

**Features:**
- Show trend indicators (↑↓→) in report
- Display delta from previous run
- Color-code improvements/regressions
- Add "Change" column to table

#### 4.3 Trend Visualization (2-3 hours)

**New file:** `src/graphs.ts`

**Features:**
- ASCII trend graphs for each module
- Overall coverage trend graph
- Configurable history window (last N runs)
- Collapsible details in PR comment

#### 4.4 Testing & Documentation (1 hour)

**Actions:**
- Test history storage/retrieval
- Test trend calculations
- Update documentation with history features
- Add example workflows with history

### Phase 4 Completion Criteria

- ✅ History stored reliably in artifacts
- ✅ Trend indicators display correctly
- ✅ ASCII graphs render properly
- ✅ History retention works
- ✅ Feature fully documented
- ✅ Ready for v1.1.0 release

## Testing Strategy

### TDD Approach (Core of MVP)

**Framework:** Vitest (fast, TypeScript-native)

**Test files (created BEFORE implementation):**
- `src/__tests__/discovery.test.ts` - Module discovery logic
- `src/__tests__/paths.test.ts` - Path resolution and normalization
- `src/__tests__/parser.test.ts` - XML parsing
- `src/__tests__/threshold.test.ts` - Threshold matching logic
- `src/__tests__/aggregator.test.ts` - Coverage aggregation
- `src/__tests__/report.test.ts` - Report generation
- `src/__tests__/github.test.ts` - PR comment posting (with mocks)

**Coverage targets:**
- **Minimum:** 80% code coverage
- **Goal:** 90%+ for core modules (parser, threshold, aggregator)
- **Why:** TDD naturally produces high coverage since tests drive implementation

### Test Execution Commands

```bash
# Run all tests once
pnpm test

# Watch mode (during development)
pnpm test:watch

# Coverage report
pnpm test:coverage

# UI mode (visual test runner)
pnpm test:ui
```

### Integration Testing

**Approach:** Use actual Kover XML files from test projects

**Test data:**
- Sample Kover XML reports (valid, invalid, edge cases)
- Mock Gradle project output
- Sample threshold configurations

**Test repository:** Create a separate test repo or use examples/

### Manual Testing Checklist

- [ ] Single module project works
- [ ] Multi-module with Gradle discovery works
- [ ] Multi-module with glob pattern works
- [ ] Thresholds applied correctly (exact, type, default)
- [ ] Ignore-modules filter works
- [ ] Missing coverage files handled gracefully
- [ ] Action fails when coverage below minimum
- [ ] PR comment created on first run
- [ ] PR comment updated on subsequent runs
- [ ] Works in non-PR contexts (pushes)
- [ ] Debug logging provides useful information
- [ ] Error messages are clear and actionable

## Deployment Checklist

### Pre-release

- [ ] All Phase 1-3 tasks completed
- [ ] Manual testing checklist completed
- [ ] Documentation reviewed and complete
- [ ] README has clear examples
- [ ] CHANGELOG.md created with release notes
- [ ] Build successful: `pnpm run build`
- [ ] Dist files committed to repository

### Release Process

1. **Version tagging:**
   - Create git tag: `v1.0.0`
   - Follow semantic versioning
   - Include release notes

2. **GitHub Release:**
   - Create release from tag
   - Attach CHANGELOG
   - Include migration guide link
   - Add usage examples

3. **Marketplace Publishing:**
   - Verify action.yml metadata (branding, description)
   - Publish to GitHub Actions Marketplace
   - Add relevant tags (coverage, kotlin, kover, testing)

4. **Documentation:**
   - Update README with marketplace badge
   - Add link in omnitweety-android for migration
   - Announce in relevant communities

### Post-release

- [ ] Monitor issue reports
- [ ] Respond to user feedback
- [ ] Plan Phase 4 based on user requests
- [ ] Update reference implementation to use new action

## Risk Mitigation

### Risk 1: Gradle Command Output Format Changes
**Mitigation:**
- Make parsing regex configurable
- Provide fallback to glob-based discovery
- Document expected output format clearly

### Risk 2: Large Projects Performance
**Mitigation:**
- Use parallel XML parsing (`Promise.all`)
- Consider streaming for very large XML files
- Add timeout configuration

### Risk 3: GitHub API Rate Limits
**Mitigation:**
- Only one PR comment per run (update existing)
- Implement retry logic with exponential backoff
- Cache artifact downloads

### Risk 4: Breaking Changes in Dependencies
**Mitigation:**
- Pin major versions in package.json
- Test with both old and new Kover XML formats
- Add version detection if formats differ

### Risk 5: Security Vulnerabilities
**Mitigation:**
- Validate all user inputs
- Never execute user input as shell commands directly
- Regular security audits (`npm audit`)
- Follow GitHub Actions security best practices

## Success Metrics

### MVP Success (Phase 1-3)

- ✅ Parses Kover XML correctly (100% accuracy)
- ✅ Multi-module support works (command + glob)
- ✅ Threshold matching works (all priority levels)
- ✅ PR comments post/update correctly
- ✅ No false positives/negatives in pass/fail
- ✅ Handles errors gracefully (no crashes)
- ✅ Migration path from reference action is smooth

### User Adoption Metrics (Post-release)

- GitHub stars: Target 50+ in first month
- Marketplace installations: Target 100+ in first month
- Issue reports: <10 bugs in first month
- Documentation quality: <5 documentation-related issues

### Performance Targets

- Action completion time: <30 seconds for 20 modules
- Bundle size: <3MB
- Memory usage: <512MB for typical projects

## Maintenance Plan

### Regular Tasks

- **Weekly:** Monitor issues and PRs
- **Monthly:** Dependency updates (security patches)
- **Quarterly:** Review and update documentation
- **Yearly:** Major version update with breaking changes (if needed)

### Support Channels

- GitHub Issues: Bug reports and feature requests
- GitHub Discussions: Q&A and community support
- README: Link to examples and troubleshooting

## Conclusion

This implementation plan provides a clear roadmap from MVP to full-featured coverage reporting action. The phased approach allows for early delivery of core functionality while maintaining flexibility for future enhancements.

**Next Steps:**
1. Review and approve this plan
2. Begin Phase 1 implementation
3. Iterate based on feedback
4. Ship MVP (Phase 1-3)
5. Plan Phase 4 based on user needs
