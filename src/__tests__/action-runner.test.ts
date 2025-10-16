import { beforeEach, describe, expect, test, vi } from 'vitest';
import { runAction } from '../action-runner';
import { SpyLogger } from '../common/logger';
import type { ActionConfig } from '../config';
import type { DiscoveryConfig, ModuleReference } from '../discovery/index';
import type { HistoryManager } from '../history/manager';
import type { Reporter, ReportResult } from '../reporter';

/**
 * Create a fake discovery function for testing
 */
function createFakeDiscovery(
  modules: ModuleReference[]
): (config: DiscoveryConfig) => Promise<ModuleReference[]> {
  return async () => modules;
}

/**
 * Create a spy reporter for testing
 */
function createSpyReporter() {
  const emittedReports: Array<{ result: ReportResult; title: string }> = [];

  const reporter: Reporter = async (result, title) => {
    emittedReports.push({ result, title });
  };

  return { reporter, emittedReports };
}

/**
 * Create a fake HistoryManager for testing
 */
function createFakeHistoryManager(): {
  manager: HistoryManager;
  getLoadCalled: () => boolean;
  getPersistCalled: () => boolean;
} {
  let entryCount = 0;
  let loadCalled = false;
  let persistCalled = false;

  const manager: HistoryManager = {
    async load() {
      loadCalled = true;
    },
    compare() {
      return null;
    },
    append() {
      entryCount++;
    },
    async persist() {
      persistCalled = true;
    },
    getEntryCount() {
      return entryCount;
    },
  };

  return {
    manager,
    getLoadCalled: () => loadCalled,
    getPersistCalled: () => persistCalled,
  };
}

/**
 * Create minimal test ActionConfig
 */
function createTestConfig(overrides: Partial<ActionConfig> = {}): ActionConfig {
  return {
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
    debug: false,
    ...overrides,
  };
}

describe('runAction', () => {
  // Mock filesystem for path resolution
  beforeEach(() => {
    vi.stubEnv('GITHUB_WORKSPACE', '/workspace');
  });

  test('executes successful workflow with minimal setup', async () => {
    const logger = new SpyLogger();
    const discovery = createFakeDiscovery([
      { name: ':core', filePath: 'core/build/reports/kover/report.xml' },
    ]);
    const { reporter, emittedReports } = createSpyReporter();

    const config = createTestConfig();

    const result = await runAction(config, { discovery, reporter, logger });

    // Verify success
    expect(result.success).toBe(true);
    expect(result.coveragePercentage).toBeGreaterThanOrEqual(0);
    expect(result.error).toBeUndefined();

    // Verify logging
    expect(logger.hasMessage('info', '📊 Kover Coverage Report Action')).toBe(true);
    expect(logger.hasMessage('info', /Found \d+ modules/)).toBe(true);
    expect(logger.hasMessage('info', '✅ Coverage check passed!')).toBe(true);

    // Verify reporter was called
    expect(emittedReports).toHaveLength(1);
    expect(emittedReports[0].title).toBe('Test Report');
    expect(emittedReports[0].result.overall).toBeDefined();
  });

  test('fails when coverage below minimum threshold', async () => {
    const logger = new SpyLogger();
    const discovery = createFakeDiscovery([
      { name: ':core', filePath: 'core/build/reports/kover/report.xml' },
    ]);
    const { reporter } = createSpyReporter();

    const config = createTestConfig({ minCoverage: 100 }); // Impossible threshold

    const result = await runAction(config, { discovery, reporter, logger });

    // Verify failure
    expect(result.success).toBe(false);
    expect(result.error).toContain('below minimum required');

    // Verify error was logged
    expect(logger.hasMessage('error', 'Action failed')).toBe(true);
  });

  test('logs startup information correctly', async () => {
    const logger = new SpyLogger();
    const discovery = createFakeDiscovery([]);
    const { reporter } = createSpyReporter();

    const config = createTestConfig({
      minCoverage: 80,
      title: 'Custom Coverage Report',
    });

    await runAction(config, { discovery, reporter, logger });

    expect(logger.hasMessage('info', 'Minimum coverage requirement: 80%')).toBe(true);
    expect(logger.hasMessage('info', 'Report title: Custom Coverage Report')).toBe(true);
  });

  test('logs debug information when debug mode enabled', async () => {
    const logger = new SpyLogger();
    const discovery = createFakeDiscovery([{ name: ':core', filePath: 'core/report.xml' }]);
    const { reporter } = createSpyReporter();

    const config = createTestConfig({
      debug: true,
      discoveryMode: 'command',
      thresholds: { default: 60, ':core': 80 },
    });

    await runAction(config, { discovery, reporter, logger });

    expect(logger.hasMessage('info', '🐛 Debug mode enabled')).toBe(true);
    expect(logger.hasMessage('debug', 'Discovery mode: command')).toBe(true);
    expect(logger.hasMessage('debug', /Thresholds:/)).toBe(true);
    expect(logger.hasMessage('debug', /Modules:/)).toBe(true);
  });

  test('logs ignored modules when configured', async () => {
    const logger = new SpyLogger();
    const discovery = createFakeDiscovery([{ name: ':app', filePath: 'app/report.xml' }]);
    const { reporter } = createSpyReporter();

    const config = createTestConfig({
      ignoredModules: [':test', ':fixtures'],
    });

    await runAction(config, { discovery, reporter, logger });

    expect(logger.hasMessage('info', 'Ignoring 2 modules: :test, :fixtures')).toBe(true);
  });

  test('validates module paths for security', async () => {
    const logger = new SpyLogger();
    const discovery = createFakeDiscovery([
      { name: ':malicious', filePath: '../../../etc/passwd' },
    ]);
    const { reporter } = createSpyReporter();

    const config = createTestConfig();

    const result = await runAction(config, { discovery, reporter, logger });

    // Should fail due to path traversal
    expect(result.success).toBe(false);
    expect(result.error).toContain('Security');
    expect(result.error).toContain(':malicious');
  });

  test('handles discovery errors gracefully', async () => {
    const logger = new SpyLogger();
    const discovery = async () => {
      throw new Error('Discovery failed: command not found');
    };
    const { reporter } = createSpyReporter();

    const config = createTestConfig();

    const result = await runAction(config, { discovery, reporter, logger });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Discovery failed: command not found');
    expect(logger.hasMessage('error', 'Action failed: Discovery failed')).toBe(true);
  });

  test('integrates with history manager when enabled', async () => {
    const logger = new SpyLogger();
    const discovery = createFakeDiscovery([{ name: ':core', filePath: 'core/report.xml' }]);
    const { reporter } = createSpyReporter();
    const { manager, getLoadCalled, getPersistCalled } = createFakeHistoryManager();

    const config = createTestConfig({
      enableHistory: true,
      baselineBranch: 'develop',
      historyRetention: 100,
    });

    await runAction(config, {
      discovery,
      reporter,
      logger,
      history: manager,
    });

    // Verify history workflow
    expect(getLoadCalled()).toBe(true);
    expect(getPersistCalled()).toBe(true);

    // Verify logging
    expect(
      logger.hasMessage('info', 'History tracking enabled (baseline: develop, retention: 100)')
    ).toBe(true);
    expect(logger.hasMessage('info', 'Loading coverage history')).toBe(true);
    expect(logger.hasMessage('info', 'Saving coverage history')).toBe(true);
  });

  test('handles history errors without failing the action', async () => {
    const logger = new SpyLogger();
    const discovery = createFakeDiscovery([{ name: ':core', filePath: 'core/report.xml' }]);
    const { reporter } = createSpyReporter();

    const brokenHistory: HistoryManager = {
      async load() {
        throw new Error('Artifact not found');
      },
      compare: () => null,
      append: () => {},
      persist: async () => {},
      getEntryCount: () => 0,
    };

    const config = createTestConfig({ enableHistory: true });

    const result = await runAction(config, {
      discovery,
      reporter,
      logger,
      history: brokenHistory,
    });

    // Action should still succeed
    expect(result.success).toBe(true);

    // But history error should be logged as warning
    expect(logger.hasMessage('warn', 'Failed to process coverage history')).toBe(true);
    expect(logger.hasMessage('warn', 'Artifact not found')).toBe(true);
  });

  test('logs history comparison when baseline exists', async () => {
    const logger = new SpyLogger();
    const discovery = createFakeDiscovery([{ name: ':core', filePath: 'core/report.xml' }]);
    const { reporter, emittedReports } = createSpyReporter();

    const historyWithBaseline: HistoryManager = {
      async load() {},
      compare() {
        return {
          baseline: {
            timestamp: '2025-01-01T00:00:00Z',
            branch: 'main',
            commit: 'abc123',
            overall: {
              percentage: 75,
              covered: 750,
              total: 1000,
            },
            modules: {},
          },
          overallDelta: 5.2,
          moduleDelta: {},
        };
      },
      append: () => {},
      persist: async () => {},
      getEntryCount: () => 10,
    };

    const config = createTestConfig({ enableHistory: true });

    await runAction(config, {
      discovery,
      reporter,
      logger,
      history: historyWithBaseline,
    });

    // Verify comparison logging
    expect(logger.hasMessage('info', 'Comparing with baseline (2025-01-01T00:00:00Z)')).toBe(true);
    expect(logger.hasMessage('info', 'Overall change: +5.2%')).toBe(true);

    // Verify comparison passed to reporter
    expect(emittedReports[0].result.comparison).toBeDefined();
    expect(emittedReports[0].result.comparison?.overallDelta).toBe(5.2);
  });

  test('logs warning when no baseline found', async () => {
    const logger = new SpyLogger();
    const discovery = createFakeDiscovery([{ name: ':core', filePath: 'core/report.xml' }]);
    const { reporter } = createSpyReporter();

    const historyNoBaseline: HistoryManager = {
      async load() {},
      compare: () => null, // No baseline
      append: () => {},
      persist: async () => {},
      getEntryCount: () => 0,
    };

    const config = createTestConfig({
      enableHistory: true,
      baselineBranch: 'production',
    });

    await runAction(config, {
      discovery,
      reporter,
      logger,
      history: historyNoBaseline,
    });

    expect(logger.hasMessage('info', 'No baseline found for branch: production')).toBe(true);
  });

  test('logs history entry counts in debug mode', async () => {
    const logger = new SpyLogger();
    const discovery = createFakeDiscovery([{ name: ':core', filePath: 'core/report.xml' }]);
    const { reporter } = createSpyReporter();

    let entryCount = 25;
    const historyWithEntries: HistoryManager = {
      async load() {},
      compare: () => null,
      append: () => {
        entryCount++;
      },
      persist: async () => {},
      getEntryCount: () => entryCount,
    };

    const config = createTestConfig({ enableHistory: true, debug: true });

    await runAction(config, {
      discovery,
      reporter,
      logger,
      history: historyWithEntries,
    });

    expect(logger.hasMessage('debug', 'Loaded 25 history entries')).toBe(true);
    expect(logger.hasMessage('debug', 'Saved 26 history entries')).toBe(true); // +1 for current run
  });

  test('passes correct report result to reporter', async () => {
    const logger = new SpyLogger();
    const discovery = createFakeDiscovery([
      { name: ':core', filePath: 'core/report.xml' },
      { name: ':data', filePath: 'data/report.xml' },
    ]);
    const { reporter, emittedReports } = createSpyReporter();

    const config = createTestConfig({
      title: 'My Coverage Report',
      thresholds: { default: 60 },
    });

    await runAction(config, { discovery, reporter, logger });

    expect(emittedReports).toHaveLength(1);
    expect(emittedReports[0].title).toBe('My Coverage Report');
    expect(emittedReports[0].result.overall.modules.length).toBeGreaterThan(0);
  });

  test('returns coverage percentage in result', async () => {
    const logger = new SpyLogger();
    const discovery = createFakeDiscovery([{ name: ':core', filePath: 'core/report.xml' }]);
    const { reporter } = createSpyReporter();

    const config = createTestConfig();

    const result = await runAction(config, { discovery, reporter, logger });

    expect(result.coveragePercentage).toBeGreaterThanOrEqual(0);
    expect(result.coveragePercentage).toBeLessThanOrEqual(100);
  });

  test('handles reporter errors gracefully', async () => {
    const logger = new SpyLogger();
    const discovery = createFakeDiscovery([{ name: ':core', filePath: 'core/report.xml' }]);
    const brokenReporter: Reporter = async () => {
      throw new Error('GitHub API error');
    };

    const config = createTestConfig();

    const result = await runAction(config, {
      discovery,
      reporter: brokenReporter,
      logger,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('GitHub API error');
  });

  test('handles unknown error types', async () => {
    const logger = new SpyLogger();
    const discovery = async () => {
      throw 'string error'; // Non-Error object for testing
    };
    const { reporter } = createSpyReporter();

    const config = createTestConfig();

    const result = await runAction(config, { discovery, reporter, logger });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Unknown error');
  });

  test('discovery mode is logged correctly', async () => {
    const logger = new SpyLogger();
    const discovery = createFakeDiscovery([]);
    const { reporter } = createSpyReporter();

    const config = createTestConfig({ discoveryMode: 'command' });

    await runAction(config, { discovery, reporter, logger });

    expect(logger.hasMessage('info', 'Discovering modules (command mode)')).toBe(true);
  });

  test('works without history manager when history disabled', async () => {
    const logger = new SpyLogger();
    const discovery = createFakeDiscovery([{ name: ':core', filePath: 'core/report.xml' }]);
    const { reporter } = createSpyReporter();

    const config = createTestConfig({ enableHistory: false });

    const result = await runAction(config, {
      discovery,
      reporter,
      logger,
      // No history manager provided
    });

    expect(result.success).toBe(true);
    expect(logger.hasMessage('info', 'History tracking enabled')).toBe(false);
  });
});
