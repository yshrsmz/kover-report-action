# Refactoring Plan: Architecture Improvements

**Status**: Proposed
**Date**: 2025-10-14
**Goal**: Transform monolithic entrypoint into maintainable, testable, composable architecture

---

## Executive Summary

The current codebase has grown to a point where `src/index.ts` (377 lines) mixes multiple concerns: input parsing, module discovery, coverage aggregation, history management, reporting, and error handling. This refactoring extracts these concerns into focused, testable components with clear dependencies, enabling:

- **Better testability** via dependency injection
- **Code reusability** beyond GitHub Actions context
- **Maintainability** through single-responsibility modules
- **Type safety** by eliminating string-based configuration handling in business logic

---

## Current Architecture Issues

### Problem 1: Monolithic Entrypoint (src/index.ts)
- **377 lines** mixing 6+ distinct responsibilities
- Direct coupling to `@actions/core` throughout business logic
- Inline input parsing with repeated validation and defaults
- Difficult to test without mocking global `@actions/core` module
- Cannot reuse workflow logic in CLI, tests, or other environments

### Problem 2: Scattered Configuration Logic
- 42 lines (28-70) parsing inputs with inline validation
- String defaults repeated at call sites
- Type conversions (parsing JSON, numbers) mixed with orchestration
- No single source of truth for configuration schema

### Problem 3: History Management Coupling
- History operations (load/compare/append/save) mixed with artifact I/O
- Orchestration code must understand artifact client details
- 100+ lines (226-329) of history logic embedded in main flow
- Hard to test history workflows independently

### Problem 4: Reporting Responsibilities Blur
- PR comment posting, output setting, console logging scattered
- Report generation decoupled, but emission is not
- No single point to customize output channels
- Cannot easily test reporting without GitHub API mocks

### Problem 5: Discovery Flow Repeats Validation
- Security checks (path traversal) repeated after discovery
- Module normalization happens at multiple points
- Discovery strategies selected via inline conditionals

---

## Refactoring Goals

1. **Separate configuration from execution** - Typed config object created before workflow starts
2. **Inject all dependencies** - Runner receives discovery, aggregator, history, reporter, logger
3. **Abstract GitHub Actions primitives** - Business logic depends on interfaces, not `@actions/core`
4. **Enable unit testing** - Each component testable in isolation with fakes/mocks
5. **Support future interfaces** - Same runner usable from CLI, scheduled jobs, web hooks
6. **Maintain backward compatibility** - No changes to `action.yml` inputs/outputs

---

## Target Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ src/index.ts (Entrypoint) ~40 lines                         │
│ • Load config via core facade                               │
│ • Create logger, discovery, history, reporter               │
│ • Instantiate ActionRunner with dependencies                │
│ • Call run(), handle errors, exit                           │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ src/config.ts (Configuration Layer)                         │
│ • ActionConfig interface (typed fields)                     │
│ • loadConfig(facade): ActionConfig                          │
│ • Validates, normalizes, applies defaults                   │
│ • Throws ConfigError with actionable messages               │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ src/action-runner.ts (Orchestration)                        │
│ • ActionRunner class with injected dependencies             │
│ • run(): Promise<RunResult>                                 │
│ • Pure workflow logic (discover → aggregate → compare       │
│   → report)                                                  │
│ • No direct @actions/core usage                             │
└─────────────────────────────────────────────────────────────┘
           │              │              │              │
           ▼              ▼              ▼              ▼
    ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐
    │ Discovery │  │ History   │  │ Reporter  │  │ Logger    │
    │ Interface │  │ Manager   │  │ Interface │  │ Interface │
    └───────────┘  └───────────┘  └───────────┘  └───────────┘
         │              │              │              │
         ▼              ▼              ▼              ▼
    Strategies    Artifact I/O    Outputs/PR    ActionsLogger
    (Command,     + Comparison    Comments      Adapter
     Glob)        + Persistence   + Console
```

---

## Implementation Plan

### Phase 1: Logger Abstraction (Foundation)

**Objective**: Decouple logging from `@actions/core` to enable testability

**Files to Create**:
- `src/logger.ts`

**Design Philosophy**:
The Logger interface is intentionally **pure** (side-effect free). Workflow control (like marking an action as failed) is separated from logging. Components throw typed errors that the entrypoint catches and handles via `core.setFailed()`. This keeps logging focused and testable.

```typescript
// src/logger.ts

/**
 * Logger interface for action output
 *
 * Note: This interface is intentionally pure (side-effect free).
 * Workflow control (like marking an action as failed) should be
 * handled by throwing typed errors that the entrypoint catches,
 * not by mixing logging with control flow.
 */
export interface Logger {
  info(message: string): void;
  debug(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

/** Logger implementation using @actions/core */
export class ActionsLogger implements Logger {
  constructor(private readonly core: typeof import('@actions/core')) {}

  info(message: string): void {
    this.core.info(message);
  }

  debug(message: string): void {
    this.core.debug(message);
  }

  warn(message: string): void {
    this.core.warning(message);
  }

  error(message: string): void {
    this.core.error(message);
  }
}

/** Factory function for logger */
export function createLogger(core: typeof import('@actions/core')): Logger {
  return new ActionsLogger(core);
}

/** Spy logger for testing */
export class SpyLogger implements Logger {
  readonly calls = {
    info: [] as string[],
    debug: [] as string[],
    warn: [] as string[],
    error: [] as string[]
  };

  info(message: string): void { this.calls.info.push(message); }
  debug(message: string): void { this.calls.debug.push(message); }
  warn(message: string): void { this.calls.warn.push(message); }
  error(message: string): void { this.calls.error.push(message); }

  // Helper methods for testing
  hasMessage(level: keyof SpyLogger['calls'], pattern: string | RegExp): boolean {
    const messages = this.calls[level];
    if (typeof pattern === 'string') {
      return messages.some((msg) => msg.includes(pattern));
    }
    // Clone regex to avoid mutation with global/sticky flags
    const regex = new RegExp(pattern.source, pattern.flags);
    return messages.some((msg) => regex.test(msg));
  }

  getMessageCount(level: keyof SpyLogger['calls']): number {
    return this.calls[level].length;
  }

  clear(): void {
    this.calls.info = [];
    this.calls.debug = [];
    this.calls.warn = [];
    this.calls.error = [];
  }
}
```

**Testing**:
```typescript
// src/__tests__/logger.test.ts
import { describe, expect, test, vi } from 'vitest';
import { ActionsLogger, SpyLogger } from '../logger';

describe('ActionsLogger', () => {
  test('forwards info calls to core', () => {
    const mockCore = { info: vi.fn(), debug: vi.fn(), warning: vi.fn(), error: vi.fn(), setFailed: vi.fn() };
    const logger = new ActionsLogger(mockCore as any);

    logger.info('test message');

    expect(mockCore.info).toHaveBeenCalledWith('test message');
  });

  // Similar tests for other methods...
});

describe('SpyLogger', () => {
  test('records all calls', () => {
    const logger = new SpyLogger();

    logger.info('info1');
    logger.debug('debug1');
    logger.warn('warn1');

    expect(logger.calls.info).toEqual(['info1']);
    expect(logger.calls.debug).toEqual(['debug1']);
    expect(logger.calls.warn).toEqual(['warn1']);
  });
});
```

**Migration Path**:
1. Create `src/logger.ts` with interfaces and implementations
2. Add tests for logger implementations
3. **Do NOT modify existing code yet** - this is foundation only
4. Verify tests pass before Phase 2

---

### Phase 2: Configuration Layer (Input Handling)

**Objective**: Extract all input parsing, validation, and defaults into typed configuration

**Files to Create**:
- `src/config.ts`
- `src/__tests__/config.test.ts`

**Design**:
```typescript
// src/config.ts

/** Facade for @actions/core input methods */
export interface CoreFacade {
  getInput(name: string): string;
  setSecret(secret: string): void;
}

/** Typed action configuration */
export interface ActionConfig {
  // Discovery
  discoveryMode: 'command' | 'glob';
  discoveryCommand?: string;
  coverageFilesPattern: string;
  modulePathTemplate: string;
  ignoredModules: string[];

  // Thresholds
  thresholds: Record<string, number>;
  minCoverage: number;

  // Reporting
  title: string;
  enablePrComment: boolean;
  githubToken?: string;

  // History
  enableHistory: boolean;
  historyRetention: number;
  baselineBranch: string;

  // Advanced
  debug: boolean;
}

/** Configuration validation error */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

/** Load and validate configuration from GitHub Actions inputs */
export function loadConfig(facade: CoreFacade): ActionConfig {
  // Read all inputs
  const discoveryCommand = facade.getInput('discovery-command');
  const coverageFiles = facade.getInput('coverage-files') || '**/build/reports/kover/report.xml';
  const modulePathTemplate = facade.getInput('module-path-template') || '{module}/build/reports/kover/report.xml';
  const ignoreModulesInput = facade.getInput('ignore-modules') || '';
  const thresholdsInput = facade.getInput('thresholds') || '{"default": 60}';
  const minCoverageInput = facade.getInput('min-coverage') || '0';
  const title = facade.getInput('title') || 'Code Coverage Report';
  const githubToken = facade.getInput('github-token');
  const enablePrComment = facade.getInput('enable-pr-comment') !== 'false';
  const enableHistory = facade.getInput('enable-history') === 'true';
  const historyRetentionInput = facade.getInput('history-retention') || '50';
  const baselineBranch = facade.getInput('baseline-branch') || 'main';
  const debug = facade.getInput('debug') === 'true';

  // Mask token
  if (githubToken) {
    facade.setSecret(githubToken);
  }

  // Validate and parse min-coverage
  const minCoverage = validateMinCoverage(minCoverageInput);

  // Validate and parse history retention
  const historyRetention = Number.parseInt(historyRetentionInput, 10);
  if (Number.isNaN(historyRetention) || historyRetention < 1) {
    throw new ConfigError(
      `Invalid history-retention value: "${historyRetentionInput}". Must be a positive integer.`
    );
  }

  // Parse and normalize ignored modules
  const ignoredModules = ignoreModulesInput
    .split(',')
    .map((m) => m.trim())
    .filter((m) => m.length > 0)
    .map((m) => normalizeModuleName(m));

  // Validate module-path-template when using command-based discovery
  const discoveryMode: 'command' | 'glob' = discoveryCommand && discoveryCommand.trim().length > 0 ? 'command' : 'glob';
  if (discoveryMode === 'command') {
    validateModulePathTemplate(modulePathTemplate);
  }

  // Parse thresholds
  let thresholds: Record<string, number>;
  try {
    thresholds = parseThresholdsFromJSON(thresholdsInput);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ConfigError(
      `Failed to parse thresholds JSON: ${message}\n` +
      'Expected format: {"core": 80, "data": 75, ":specific:module": 90, "default": 60}\n' +
      'See https://github.com/yshrsmz/kover-report-action#threshold-configuration for examples.'
    );
  }

  return {
    discoveryMode,
    discoveryCommand: discoveryMode === 'command' ? discoveryCommand : undefined,
    coverageFilesPattern: coverageFiles,
    modulePathTemplate,
    ignoredModules,
    thresholds,
    minCoverage,
    title,
    enablePrComment,
    githubToken: githubToken || undefined,
    enableHistory,
    historyRetention,
    baselineBranch,
    debug
  };
}

/** Adapter for @actions/core */
export class ActionsCoreFacade implements CoreFacade {
  constructor(private readonly core: typeof import('@actions/core')) {}

  getInput(name: string): string {
    return this.core.getInput(name);
  }

  setSecret(secret: string): void {
    this.core.setSecret(secret);
  }
}
```

**Testing**:
```typescript
// src/__tests__/config.test.ts
import { describe, expect, test } from 'vitest';
import { ConfigError, loadConfig, type CoreFacade } from '../config';

class FakeCoreFacade implements CoreFacade {
  constructor(private inputs: Record<string, string> = {}) {}

  getInput(name: string): string {
    return this.inputs[name] || '';
  }

  setSecret(_secret: string): void {
    // No-op for testing
  }
}

describe('loadConfig', () => {
  test('loads default configuration', () => {
    const facade = new FakeCoreFacade();
    const config = loadConfig(facade);

    expect(config.discoveryMode).toBe('glob');
    expect(config.coverageFilesPattern).toBe('**/build/reports/kover/report.xml');
    expect(config.minCoverage).toBe(0);
    expect(config.title).toBe('Code Coverage Report');
    expect(config.enableHistory).toBe(false);
  });

  test('parses command discovery mode', () => {
    const facade = new FakeCoreFacade({
      'discovery-command': './gradlew -q projects'
    });
    const config = loadConfig(facade);

    expect(config.discoveryMode).toBe('command');
    expect(config.discoveryCommand).toBe('./gradlew -q projects');
  });

  test('throws ConfigError for invalid min-coverage', () => {
    const facade = new FakeCoreFacade({
      'min-coverage': 'invalid'
    });

    expect(() => loadConfig(facade)).toThrow(ConfigError);
  });

  test('parses ignored modules', () => {
    const facade = new FakeCoreFacade({
      'ignore-modules': ':core, :test, build-logic'
    });
    const config = loadConfig(facade);

    expect(config.ignoredModules).toEqual([':core', ':test', 'build-logic']);
  });

  // Add more tests for each validation case...
});
```

**Migration Path**:
1. Create `src/config.ts` with all configuration logic
2. Write comprehensive tests covering all validation cases
3. Verify tests pass
4. **Do NOT modify index.ts yet** - config layer is standalone

---

### Phase 3: Manager Interfaces (Business Logic)

**Objective**: Formalize discovery, history, and reporting as injectable services

#### 3A. Discovery Interface

**Files to Modify/Create**:
- `src/discovery/index.ts` (new)
- `src/discovery/command.ts` (extract from `src/discovery.ts`)
- `src/discovery/glob.ts` (extract from `src/discovery.ts`)

**Design**:
```typescript
// src/discovery/index.ts

export interface DiscoveryConfig {
  ignoredModules: string[];
}

export interface ModuleReference {
  name: string;
  filePath: string;
}

export interface ModuleDiscovery {
  discover(config: DiscoveryConfig): Promise<ModuleReference[]>;
}

export { CommandDiscovery } from './command';
export { GlobDiscovery } from './glob';
```

```typescript
// src/discovery/command.ts

import { discoverModulesFromCommand } from '../discovery';
import { resolveModulePath } from '../paths';
import type { DiscoveryConfig, ModuleDiscovery, ModuleReference } from './index';

export class CommandDiscovery implements ModuleDiscovery {
  constructor(
    private readonly command: string,
    private readonly pathTemplate: string
  ) {}

  async discover(config: DiscoveryConfig): Promise<ModuleReference[]> {
    const moduleNames = await discoverModulesFromCommand(
      this.command,
      config.ignoredModules
    );

    if (moduleNames.length === 0) {
      throw new Error(
        `No modules found by discovery command.\n` +
        `Command: ${this.command}\n` +
        'Possible causes:\n' +
        '- Command output does not contain "Project \'...\'" patterns\n' +
        '- All modules are in the ignore-modules list\n' +
        '- Command failed or returned no output\n' +
        'Tip: Run the command locally to verify its output format.'
      );
    }

    return moduleNames.map((name) => ({
      name,
      filePath: resolveModulePath(name, this.pathTemplate)
    }));
  }
}
```

```typescript
// src/discovery/glob.ts

import { discoverModulesFromGlob } from '../discovery';
import type { DiscoveryConfig, ModuleDiscovery, ModuleReference } from './index';

export class GlobDiscovery implements ModuleDiscovery {
  constructor(private readonly pattern: string) {}

  async discover(config: DiscoveryConfig): Promise<ModuleReference[]> {
    const results = await discoverModulesFromGlob(
      this.pattern,
      config.ignoredModules
    );

    if (results.length === 0) {
      throw new Error(
        `No coverage files found matching pattern.\n` +
        `Pattern: ${this.pattern}\n` +
        'Possible causes:\n' +
        '- Coverage reports not generated (run tests with coverage first)\n' +
        '- Pattern does not match actual file locations\n' +
        '- All matching modules are in the ignore-modules list\n' +
        'Tip: Verify files exist by running: ls -la **/build/reports/kover/report.xml'
      );
    }

    return results.map(({ module, filePath }) => ({
      name: module,
      filePath
    }));
  }
}
```

**Testing**: Adapt existing `discovery.test.ts` to test through interfaces

#### 3B. History Manager

**Files to Create**:
- `src/history/manager.ts`
- `src/__tests__/history-manager.test.ts`

**Design**:
```typescript
// src/history/manager.ts

import {
  addHistoryEntry,
  compareWithBaseline,
  createHistoryEntry,
  loadHistory,
  saveHistory,
  trimHistory,
  type HistoryComparison,
  type HistoryEntry
} from '../history';

export interface HistoryStore {
  load(): Promise<string | null>;
  save(data: string): Promise<void>;
}

export interface HistoryContext {
  branch: string;
  commit: string;
  timestamp: string;
}

export interface CoverageSnapshot {
  overall: number;
  covered: number;
  total: number;
  modules: Record<string, number>;
}

export class HistoryManager {
  private history: HistoryEntry[] = [];

  constructor(
    private readonly store: HistoryStore,
    private readonly retention: number,
    private readonly baselineBranch: string
  ) {}

  async load(): Promise<void> {
    const json = await this.store.load();
    if (json) {
      this.history = loadHistory(json);
    }
  }

  compare(snapshot: CoverageSnapshot): HistoryComparison | null {
    if (this.history.length === 0) {
      return null;
    }

    return compareWithBaseline(
      this.history,
      snapshot.modules,
      snapshot.overall,
      this.baselineBranch
    );
  }

  append(context: HistoryContext, snapshot: CoverageSnapshot): void {
    const entry = createHistoryEntry(
      context.timestamp,
      context.branch,
      context.commit,
      snapshot.overall,
      snapshot.covered,
      snapshot.total,
      snapshot.modules
    );

    this.history = trimHistory(
      addHistoryEntry(this.history, entry),
      this.retention
    );
  }

  async persist(): Promise<void> {
    const json = saveHistory(this.history);
    await this.store.save(json);
  }

  getEntryCount(): number {
    return this.history.length;
  }
}
```

**Testing**:
```typescript
// src/__tests__/history-manager.test.ts
import { describe, expect, test } from 'vitest';
import { HistoryManager, type HistoryStore } from '../history/manager';

class InMemoryHistoryStore implements HistoryStore {
  private data: string | null = null;

  async load(): Promise<string | null> {
    return this.data;
  }

  async save(data: string): Promise<void> {
    this.data = data;
  }
}

describe('HistoryManager', () => {
  test('starts with empty history', async () => {
    const store = new InMemoryHistoryStore();
    const manager = new HistoryManager(store, 50, 'main');

    await manager.load();

    expect(manager.getEntryCount()).toBe(0);
  });

  test('appends and persists entries', async () => {
    const store = new InMemoryHistoryStore();
    const manager = new HistoryManager(store, 50, 'main');

    manager.append(
      { branch: 'main', commit: 'abc123', timestamp: '2025-01-01T00:00:00Z' },
      { overall: 80, covered: 800, total: 1000, modules: { ':core': 80 } }
    );

    await manager.persist();

    expect(manager.getEntryCount()).toBe(1);

    // Verify persistence
    const manager2 = new HistoryManager(store, 50, 'main');
    await manager2.load();
    expect(manager2.getEntryCount()).toBe(1);
  });

  test('compares with baseline', async () => {
    const store = new InMemoryHistoryStore();
    const manager = new HistoryManager(store, 50, 'main');

    manager.append(
      { branch: 'main', commit: 'abc123', timestamp: '2025-01-01T00:00:00Z' },
      { overall: 75, covered: 750, total: 1000, modules: { ':core': 75 } }
    );

    const comparison = manager.compare({
      overall: 80,
      covered: 800,
      total: 1000,
      modules: { ':core': 80 }
    });

    expect(comparison).not.toBeNull();
    expect(comparison?.overallDelta).toBe(5);
  });

  // More tests for retention, trimming, etc...
});
```

#### 3C. Reporter Interface

**Files to Create**:
- `src/reporter/index.ts`
- `src/reporter/actions-reporter.ts`
- `src/__tests__/reporter.test.ts`

**Design**:
```typescript
// src/reporter/index.ts

import type { OverallCoverage } from '../aggregator';
import type { HistoryComparison } from '../history';

export interface ReportResult {
  overall: OverallCoverage;
  comparison?: HistoryComparison;
}

export interface Reporter {
  emit(result: ReportResult, title: string): Promise<void>;
}

export { ActionsReporter } from './actions-reporter';
```

```typescript
// src/reporter/actions-reporter.ts

import { postCoverageComment } from '../github';
import { generateMarkdownReport } from '../report';
import type { Logger } from '../logger';
import type { ReportResult, Reporter } from './index';
import { getFailedModules, getMissingCoverageModules } from '../aggregator';

export interface ActionsReporterOptions {
  logger: Logger;
  core: {
    setOutput(name: string, value: string): void;
  };
  githubToken?: string;
  enablePrComment: boolean;
}

export class ActionsReporter implements Reporter {
  constructor(private readonly options: ActionsReporterOptions) {}

  async emit(result: ReportResult, title: string): Promise<void> {
    const { overall, comparison } = result;
    const { logger, core, githubToken, enablePrComment } = this.options;

    // Set GitHub Actions outputs
    core.setOutput('coverage-percentage', overall.percentage.toString());
    core.setOutput('instructions-covered', overall.covered.toString());
    core.setOutput('instructions-total', overall.total.toString());

    const moduleCoverageJson: Record<string, number | string> = {};
    for (const { module, coverage } of overall.modules) {
      moduleCoverageJson[module] = coverage?.percentage ?? 'N/A';
    }
    core.setOutput('modules-coverage-json', JSON.stringify(moduleCoverageJson));

    const failedModules = getFailedModules(overall);
    const missingModules = getMissingCoverageModules(overall);
    core.setOutput('modules-below-threshold', failedModules.join(','));

    // Console summary
    logger.info('');
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logger.info(`📊 Overall Coverage: ${overall.percentage}%`);
    logger.info(`📏 Instructions: ${overall.covered}/${overall.total}`);
    logger.info(`✅ Passing modules: ${overall.modules.filter((m) => m.passed).length}`);

    if (failedModules.length > 0) {
      logger.info(`❌ Failing modules: ${failedModules.length}`);
      for (const module of failedModules) {
        const moduleCov = overall.modules.find((m) => m.module === module);
        if (moduleCov?.coverage) {
          logger.warn(`  ${module}: ${moduleCov.coverage.percentage}% < ${moduleCov.threshold}%`);
        }
      }
    }

    if (missingModules.length > 0) {
      logger.info(`⚠️  Missing coverage: ${missingModules.length} modules`);
    }

    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // PR comment
    if (enablePrComment) {
      logger.info('📝 Generating coverage report...');
      const report = generateMarkdownReport(overall, title, comparison);

      if (githubToken) {
        logger.info('💬 Posting coverage report to PR...');
        await postCoverageComment(githubToken, report);
      } else {
        logger.warn(
          '⚠️  Cannot post PR comment: github-token not provided. ' +
          'To enable PR comments, add: github-token: ${{ secrets.GITHUB_TOKEN }}'
        );
      }
    } else {
      logger.info('⏭️  PR comment posting disabled');
    }
  }
}
```

**Testing**: Create spy/mock reporter for testing action runner

---

### Phase 4: Action Runner (Orchestration)

**Objective**: Create orchestrator that wires dependencies and executes workflow

**Files to Create**:
- `src/action-runner.ts`
- `src/__tests__/action-runner.test.ts`

**Design**:
```typescript
// src/action-runner.ts

import { aggregateCoverage } from './aggregator';
import type { ActionConfig } from './config';
import type { ModuleDiscovery } from './discovery';
import { HistoryManager, type CoverageSnapshot, type HistoryContext } from './history/manager';
import type { Logger } from './logger';
import { resolveSecurePath } from './paths';
import type { Reporter, ReportResult } from './reporter';

export interface RunResult {
  success: boolean;
  coveragePercentage: number;
  error?: string;
}

export interface ActionRunnerDependencies {
  discovery: ModuleDiscovery;
  history?: HistoryManager;
  reporter: Reporter;
  logger: Logger;
}

export class ActionRunner {
  constructor(
    private readonly config: ActionConfig,
    private readonly deps: ActionRunnerDependencies
  ) {}

  async run(): Promise<RunResult> {
    const { config, deps } = this;
    const { discovery, history, reporter, logger } = deps;

    try {
      // Log startup
      logger.info('📊 Kover Coverage Report Action');
      logger.info(`🎯 Minimum coverage requirement: ${config.minCoverage}%`);
      logger.info(`📝 Report title: ${config.title}`);

      if (config.enableHistory && history) {
        logger.info(
          `📈 History tracking enabled (baseline: ${config.baselineBranch}, retention: ${config.historyRetention})`
        );
      }

      if (config.debug) {
        logger.info('🐛 Debug mode enabled');
        logger.debug(`Discovery mode: ${config.discoveryMode}`);
        logger.debug(`Thresholds: ${JSON.stringify(config.thresholds, null, 2)}`);
      }

      // Discover modules
      logger.info(`🔍 Discovering modules (${config.discoveryMode} mode)...`);
      const modules = await discovery.discover({
        ignoredModules: config.ignoredModules
      });

      logger.info(`Found ${modules.length} modules`);
      if (config.debug) {
        logger.debug(`Modules: ${modules.map((m) => m.name).join(', ')}`);
      }

      if (config.ignoredModules.length > 0) {
        logger.info(`Ignoring ${config.ignoredModules.length} modules: ${config.ignoredModules.join(', ')}`);
      }

      // Validate paths for security
      const workspace = process.env.GITHUB_WORKSPACE || process.cwd();
      for (const { name, filePath } of modules) {
        try {
          resolveSecurePath(workspace, filePath);
        } catch (error) {
          throw new Error(
            `Security: Module ${name} has invalid path "${filePath}": ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }

      // Aggregate coverage
      logger.info('📈 Aggregating coverage...');
      const overall = await aggregateCoverage(
        modules,
        config.thresholds,
        config.minCoverage
      );

      // Handle history
      let comparison: import('./history').HistoryComparison | undefined;
      if (config.enableHistory && history) {
        try {
          logger.info('📊 Loading coverage history...');
          await history.load();

          if (config.debug) {
            logger.debug(`Loaded ${history.getEntryCount()} history entries`);
          }

          // Build snapshot for comparison
          const snapshot: CoverageSnapshot = {
            overall: overall.percentage,
            covered: overall.covered,
            total: overall.total,
            modules: Object.fromEntries(
              overall.modules
                .filter((m) => m.coverage !== null)
                .map((m) => [m.module, m.coverage!.percentage])
            )
          };

          // Compare with baseline
          const baselineComparison = history.compare(snapshot);
          if (baselineComparison) {
            comparison = baselineComparison;
            logger.info(`📈 Comparing with baseline (${comparison.baseline.timestamp})`);
            logger.info(
              `   Overall change: ${comparison.overallDelta > 0 ? '+' : ''}${comparison.overallDelta.toFixed(1)}%`
            );
          } else {
            logger.info(`⚠️  No baseline found for branch: ${config.baselineBranch}`);
          }

          // Append current run
          const context: HistoryContext = {
            branch: process.env.GITHUB_REF?.replace('refs/heads/', '') || 'unknown',
            commit: process.env.GITHUB_SHA || 'unknown',
            timestamp: new Date().toISOString()
          };
          history.append(context, snapshot);

          // Persist
          logger.info('💾 Saving coverage history...');
          await history.persist();

          if (config.debug) {
            logger.debug(`Saved ${history.getEntryCount()} history entries`);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          logger.warn(`Failed to process coverage history: ${message}`);
        }
      }

      // Report results
      const reportResult: ReportResult = { overall, comparison };
      await reporter.emit(reportResult, config.title);

      // Check threshold
      if (overall.percentage < config.minCoverage) {
        throw new Error(
          `Overall coverage ${overall.percentage}% is below minimum required ${config.minCoverage}%`
        );
      }

      logger.info('✅ Coverage check passed!');
      return {
        success: true,
        coveragePercentage: overall.percentage
      };

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Action failed: ${message}`);

      return {
        success: false,
        coveragePercentage: 0,
        error: message
      };
    }
  }
}
```

**Testing**:
```typescript
// src/__tests__/action-runner.test.ts
import { describe, expect, test } from 'vitest';
import { ActionRunner } from '../action-runner';
import { SpyLogger } from '../logger';
import type { ActionConfig } from '../config';
import type { ModuleDiscovery, ModuleReference } from '../discovery';
import type { Reporter, ReportResult } from '../reporter';

class FakeDiscovery implements ModuleDiscovery {
  constructor(private modules: ModuleReference[]) {}

  async discover(): Promise<ModuleReference[]> {
    return this.modules;
  }
}

class SpyReporter implements Reporter {
  emittedReports: Array<{ result: ReportResult; title: string }> = [];

  async emit(result: ReportResult, title: string): Promise<void> {
    this.emittedReports.push({ result, title });
  }
}

describe('ActionRunner', () => {
  test('executes workflow successfully', async () => {
    const logger = new SpyLogger();
    const discovery = new FakeDiscovery([
      { name: ':core', filePath: './core/report.xml' }
    ]);
    const reporter = new SpyReporter();

    const config: ActionConfig = {
      discoveryMode: 'glob',
      coverageFilesPattern: '**/*.xml',
      modulePathTemplate: '{module}/report.xml',
      ignoredModules: [],
      thresholds: { default: 60 },
      minCoverage: 0,
      title: 'Test Report',
      enablePrComment: false,
      enableHistory: false,
      historyRetention: 50,
      baselineBranch: 'main',
      debug: false
    };

    const runner = new ActionRunner(config, { discovery, reporter, logger });
    const result = await runner.run();

    // Verify workflow executed
    expect(result.success).toBe(true);
    expect(logger.calls.info.some(m => m.includes('📊 Kover Coverage Report Action'))).toBe(true);
    expect(reporter.emittedReports).toHaveLength(1);
  });

  test('fails when coverage below minimum', async () => {
    // Similar setup with high minCoverage threshold
    // Verify result.success === false
  });

  // More tests for error handling, history integration, etc...
});
```

---

### Phase 5: Slim Entrypoint (Integration)

**Objective**: Reduce `src/index.ts` to ~40 lines of wiring

**Files to Modify**:
- `src/index.ts` (major refactor)

**Design**:
```typescript
// src/index.ts (new version)

import * as core from '@actions/core';
import * as github from '@actions/github';
import { ActionRunner } from './action-runner';
import { loadHistoryFromArtifacts, saveHistoryToArtifacts } from './artifacts';
import { ActionsCoreFacade, loadConfig } from './config';
import { CommandDiscovery, GlobDiscovery } from './discovery';
import { HistoryManager } from './history/manager';
import { ActionsLogger, createLogger } from './logger';
import { ActionsReporter } from './reporter/actions-reporter';

async function run(): Promise<void> {
  // Create logger
  const logger = createLogger(core);

  try {
    // Load configuration
    const facade = new ActionsCoreFacade(core);
    const config = loadConfig(facade);

    // Create discovery strategy
    const discovery =
      config.discoveryMode === 'command'
        ? new CommandDiscovery(config.discoveryCommand!, config.modulePathTemplate)
        : new GlobDiscovery(config.coverageFilesPattern);

    // Create history manager (if enabled)
    const history = config.enableHistory
      ? new HistoryManager(
          {
            load: () => loadHistoryFromArtifacts(),
            save: (data) => saveHistoryToArtifacts(data)
          },
          config.historyRetention,
          config.baselineBranch
        )
      : undefined;

    // Create reporter
    const reporter = new ActionsReporter({
      logger,
      core,
      githubToken: config.githubToken,
      enablePrComment: config.enablePrComment
    });

    // Run action
    const runner = new ActionRunner(config, {
      discovery,
      history,
      reporter,
      logger
    });

    const result = await runner.run();

    // Handle workflow control (setFailed) at the entrypoint
    if (!result.success) {
      core.setFailed(`❌ ${result.error || 'Action failed'}`);
    }

  } catch (error) {
    // Catch any unhandled errors and mark action as failed
    if (error instanceof Error) {
      core.setFailed(`❌ Action failed: ${error.message}`);
      if (error.stack && config?.debug) {
        logger.debug(error.stack);
      }
    } else {
      core.setFailed('❌ Action failed with unknown error');
    }
  }
}

run();
```

**Before/After Comparison**:
- **Before**: 377 lines, 6+ responsibilities mixed
- **After**: ~60 lines, pure wiring/integration

---

## Testing Strategy

### Unit Tests (Isolated Components)
- **Config Layer**: Test input parsing, validation, defaults with `FakeCoreFacade`
- **Logger**: Test ActionsLogger forwards to core, SpyLogger records calls
- **Discovery**: Test command/glob strategies with mocked filesystem/subprocess
- **History Manager**: Test load/compare/append/persist with `InMemoryStore`
- **Reporter**: Test output generation with spy reporter

### Integration Tests (Component Interaction)
- **ActionRunner**: Use fake dependencies (FakeDiscovery, SpyReporter, SpyLogger)
- Verify workflow orchestration without hitting real I/O
- Test error propagation and threshold checks

### End-to-End Tests (Full System)
- Keep existing integration tests that use real filesystem
- Update to instantiate via ActionRunner instead of calling run() directly
- Verify backward compatibility with current behavior

### Test Coverage Goals
- Config layer: 100% (critical for correctness)
- ActionRunner: 90%+ (core orchestration logic)
- Managers/interfaces: 85%+ (business logic)
- Adapters (ActionsLogger, etc.): 80%+ (mostly delegation)

---

## Migration Risks & Mitigation

### Risk 1: Breaking Existing Behavior
**Mitigation**:
- No changes to `action.yml` inputs/outputs
- Comprehensive test coverage before migration
- Gradual rollout via feature branches
- Test against real repositories before merge

### Risk 2: Increased Complexity
**Mitigation**:
- Clear documentation for each component
- Consistent naming conventions
- Type safety prevents misuse
- Complexity is localized (each component is simpler)

### Risk 3: Performance Overhead
**Mitigation**:
- Abstraction layers are thin (no significant overhead)
- Lazy initialization where possible
- Profile before/after to verify no regression

### Risk 4: Test Maintenance Burden
**Mitigation**:
- Fakes/spies are reusable across tests
- Tests are more focused (unit vs integration)
- Less mocking required overall (real objects in isolation)

---

## Success Metrics

### Quantitative
- `src/index.ts` reduced from 377 → <60 lines (85% reduction)
- Test coverage increase from ~70% → 90%+
- Number of unit-testable components: 3 → 8+
- Average function length reduced by 40%

### Qualitative
- New features (e.g., CLI mode) can be added without touching existing code
- Tests run faster (less I/O, more mocking)
- New contributors can understand architecture in <30 minutes
- Bug surface area reduced via type safety

---

## Timeline Estimate

- **Phase 1** (Logger): 2-4 hours
- **Phase 2** (Config): 4-6 hours
- **Phase 3** (Managers): 6-8 hours
- **Phase 4** (Runner): 4-6 hours
- **Phase 5** (Entrypoint): 2-3 hours
- **Testing/Documentation**: 4-6 hours

**Total**: 22-33 hours (3-5 working days)

---

## Future Enhancements Enabled

With this architecture, the following become trivial to implement:

1. **CLI Mode**: Create `src/cli.ts` that uses ActionRunner with different logger/reporter
2. **Webhook Integration**: POST results to external service via custom reporter
3. **Scheduled Jobs**: Run coverage checks on cron without GitHub Actions context
4. **Custom Output Formats**: Implement JSON/CSV reporters alongside markdown
5. **Plugin System**: Allow third-party discovery/reporter implementations
6. **Multiple Coverage Tools**: Support JaCoCo, Cobertura via strategy pattern

---

## Rollback Plan

If issues arise after merge:

1. **Immediate**: Revert main to previous commit (all changes in single PR)
2. **Short-term**: Feature flag controlled rollout (`use-legacy-runner: true` input)
3. **Long-term**: Maintain legacy code path for 2-3 releases before removal

---

## Conclusion

This refactoring transforms a monolithic 377-line entrypoint into a composable, testable architecture with clear separation of concerns. Each component has a single responsibility and can be tested in isolation. The migration is low-risk due to comprehensive testing and no changes to the public interface (`action.yml`).

**Recommendation**: Proceed with Phase 1 (Logger) immediately to establish foundation and validate approach before committing to full migration.
