import { beforeEach, describe, expect, test, vi } from 'vitest';
import { SpyLogger } from '../logger';
import { createActionsReporter } from '../reporter/actions-reporter';
import type { ReportResult } from '../reporter/index';

// Mock the github and report modules
vi.mock('../github', () => ({
  postCoverageComment: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../report', () => ({
  generateMarkdownReport: vi.fn().mockReturnValue('# Mock Markdown Report\n\nCoverage: 80%'),
}));

import { postCoverageComment } from '../github';
import { generateMarkdownReport } from '../report';

// Clear mocks before each test to prevent test pollution
beforeEach(() => {
  vi.clearAllMocks();
});

/**
 * Create a mock core facade for testing
 */
function createMockCore() {
  return {
    setOutput: vi.fn(),
  };
}

/**
 * Create a basic report result for testing
 */
function createBasicReportResult(): ReportResult {
  return {
    overall: {
      percentage: 80,
      covered: 800,
      total: 1000,
      modules: [
        {
          module: ':core',
          threshold: 75,
          passed: true,
          coverage: { percentage: 85, covered: 425, missed: 75, total: 500 },
        },
        {
          module: ':data',
          threshold: 70,
          passed: true,
          coverage: { percentage: 75, covered: 375, missed: 125, total: 500 },
        },
      ],
    },
  };
}

describe('createActionsReporter', () => {
  test('creates a reporter function', () => {
    const logger = new SpyLogger();
    const core = createMockCore();

    const reporter = createActionsReporter({
      logger,
      core,
      enablePrComment: false,
    });

    expect(typeof reporter).toBe('function');
  });

  test('sets core outputs with coverage data', async () => {
    const logger = new SpyLogger();
    const core = createMockCore();

    const reporter = createActionsReporter({
      logger,
      core,
      enablePrComment: false,
    });

    const result = createBasicReportResult();
    await reporter(result, 'Test Report');

    expect(core.setOutput).toHaveBeenCalledWith('coverage-percentage', '80');
    expect(core.setOutput).toHaveBeenCalledWith('instructions-covered', '800');
    expect(core.setOutput).toHaveBeenCalledWith('instructions-total', '1000');
  });

  test('sets modules-coverage-json output', async () => {
    const logger = new SpyLogger();
    const core = createMockCore();

    const reporter = createActionsReporter({
      logger,
      core,
      enablePrComment: false,
    });

    const result = createBasicReportResult();
    await reporter(result, 'Test Report');

    const jsonOutput = core.setOutput.mock.calls.find(
      (call) => call[0] === 'modules-coverage-json'
    );
    expect(jsonOutput).toBeDefined();
    const parsed = JSON.parse(jsonOutput?.[1] as string);
    expect(parsed[':core']).toBe(85);
    expect(parsed[':data']).toBe(75);
  });

  test('handles modules with missing coverage', async () => {
    const logger = new SpyLogger();
    const core = createMockCore();

    const reporter = createActionsReporter({
      logger,
      core,
      enablePrComment: false,
    });

    const result: ReportResult = {
      overall: {
        percentage: 80,
        covered: 800,
        total: 1000,
        modules: [
          {
            module: ':core',
            threshold: 75,
            passed: true,
            coverage: { percentage: 85, covered: 425, missed: 75, total: 500 },
          },
          {
            module: ':missing',
            threshold: 70,
            passed: false,
            coverage: null,
          },
        ],
      },
    };

    await reporter(result, 'Test Report');

    const jsonOutput = core.setOutput.mock.calls.find(
      (call) => call[0] === 'modules-coverage-json'
    );
    const parsed = JSON.parse(jsonOutput?.[1] as string);
    expect(parsed[':core']).toBe(85);
    expect(parsed[':missing']).toBe('N/A');
  });

  test('sets modules-below-threshold output', async () => {
    const logger = new SpyLogger();
    const core = createMockCore();

    const reporter = createActionsReporter({
      logger,
      core,
      enablePrComment: false,
    });

    const result: ReportResult = {
      overall: {
        percentage: 70,
        covered: 700,
        total: 1000,
        modules: [
          {
            module: ':core',
            threshold: 80,
            passed: false,
            coverage: { percentage: 70, covered: 350, missed: 150, total: 500 },
          },
          {
            module: ':data',
            threshold: 80,
            passed: false,
            coverage: { percentage: 70, covered: 350, missed: 150, total: 500 },
          },
        ],
      },
    };

    await reporter(result, 'Test Report');

    expect(core.setOutput).toHaveBeenCalledWith('modules-below-threshold', ':core,:data');
  });

  test('logs console summary with overall coverage', async () => {
    const logger = new SpyLogger();
    const core = createMockCore();

    const reporter = createActionsReporter({
      logger,
      core,
      enablePrComment: false,
    });

    const result = createBasicReportResult();
    await reporter(result, 'Test Report');

    expect(logger.hasMessage('info', '📊 Overall Coverage: 80%')).toBe(true);
    expect(logger.hasMessage('info', '📏 Instructions: 800/1000')).toBe(true);
    expect(logger.hasMessage('info', '✅ Passing modules: 2')).toBe(true);
  });

  test('logs failing modules when threshold not met', async () => {
    const logger = new SpyLogger();
    const core = createMockCore();

    const reporter = createActionsReporter({
      logger,
      core,
      enablePrComment: false,
    });

    const result: ReportResult = {
      overall: {
        percentage: 70,
        covered: 700,
        total: 1000,
        modules: [
          {
            module: ':core',
            threshold: 80,
            passed: false,
            coverage: { percentage: 70, covered: 350, missed: 150, total: 500 },
          },
          {
            module: ':data',
            threshold: 70,
            passed: true,
            coverage: { percentage: 70, covered: 350, missed: 150, total: 500 },
          },
        ],
      },
    };

    await reporter(result, 'Test Report');

    expect(logger.hasMessage('info', '❌ Failing modules: 1')).toBe(true);
    expect(logger.hasMessage('warn', ':core: 70% < 80%')).toBe(true);
  });

  test('logs missing coverage modules', async () => {
    const logger = new SpyLogger();
    const core = createMockCore();

    const reporter = createActionsReporter({
      logger,
      core,
      enablePrComment: false,
    });

    const result: ReportResult = {
      overall: {
        percentage: 80,
        covered: 800,
        total: 1000,
        modules: [
          {
            module: ':core',
            threshold: 75,
            passed: true,
            coverage: { percentage: 80, covered: 400, missed: 100, total: 500 },
          },
          {
            module: ':missing',
            threshold: 70,
            passed: false,
            coverage: null,
          },
        ],
      },
    };

    await reporter(result, 'Test Report');

    expect(logger.hasMessage('info', '⚠️  Missing coverage: 1 modules')).toBe(true);
  });

  test('does not post PR comment when disabled', async () => {
    const logger = new SpyLogger();
    const core = createMockCore();

    const reporter = createActionsReporter({
      logger,
      core,
      githubToken: 'ghp_test123',
      enablePrComment: false,
    });

    const result = createBasicReportResult();
    await reporter(result, 'Test Report');

    expect(logger.hasMessage('info', '⏭️  PR comment posting disabled')).toBe(true);
    expect(postCoverageComment).not.toHaveBeenCalled();
  });

  test('generates markdown report when PR comments enabled', async () => {
    const logger = new SpyLogger();
    const core = createMockCore();

    const reporter = createActionsReporter({
      logger,
      core,
      githubToken: 'ghp_test123',
      enablePrComment: true,
    });

    const result = createBasicReportResult();
    await reporter(result, 'Test Report');

    expect(logger.hasMessage('info', '📝 Generating coverage report...')).toBe(true);
    expect(generateMarkdownReport).toHaveBeenCalledWith(result.overall, 'Test Report', undefined);
  });

  test('posts PR comment when token provided', async () => {
    const logger = new SpyLogger();
    const core = createMockCore();

    const reporter = createActionsReporter({
      logger,
      core,
      githubToken: 'ghp_test123',
      enablePrComment: true,
    });

    const result = createBasicReportResult();
    await reporter(result, 'Test Report');

    expect(logger.hasMessage('info', '💬 Posting coverage report to PR...')).toBe(true);
    expect(postCoverageComment).toHaveBeenCalledWith(
      'ghp_test123',
      '# Mock Markdown Report\n\nCoverage: 80%'
    );
  });

  test('warns when PR comment enabled but no token', async () => {
    const logger = new SpyLogger();
    const core = createMockCore();

    const reporter = createActionsReporter({
      logger,
      core,
      enablePrComment: true,
      // No githubToken provided
    });

    const result = createBasicReportResult();
    await reporter(result, 'Test Report');

    expect(logger.hasMessage('warn', 'Cannot post PR comment: github-token not provided')).toBe(
      true
    );
    expect(postCoverageComment).not.toHaveBeenCalled();
  });

  test('includes history comparison in markdown report when provided', async () => {
    const logger = new SpyLogger();
    const core = createMockCore();

    const reporter = createActionsReporter({
      logger,
      core,
      githubToken: 'ghp_test123',
      enablePrComment: true,
    });

    const result: ReportResult = {
      ...createBasicReportResult(),
      comparison: {
        baseline: {
          timestamp: '2025-01-01T00:00:00Z',
          branch: 'main',
          commit: 'abc123',
          overall: {
            percentage: 75,
            covered: 750,
            total: 1000,
          },
          modules: { ':core': 75, ':data': 75 },
        },
        overallDelta: 5,
        moduleDelta: {
          ':core': 10,
          ':data': 0,
        },
      },
    };

    await reporter(result, 'Test Report');

    expect(generateMarkdownReport).toHaveBeenCalledWith(
      result.overall,
      'Test Report',
      result.comparison
    );
  });

  test('functional pattern: creates new reporter instances independently', async () => {
    const logger1 = new SpyLogger();
    const logger2 = new SpyLogger();
    const core1 = createMockCore();
    const core2 = createMockCore();

    const reporter1 = createActionsReporter({
      logger: logger1,
      core: core1,
      enablePrComment: false,
    });

    const reporter2 = createActionsReporter({
      logger: logger2,
      core: core2,
      enablePrComment: false,
    });

    const result = createBasicReportResult();
    await reporter1(result, 'Report 1');
    await reporter2(result, 'Report 2');

    // Each reporter uses its own dependencies
    expect(logger1.getMessageCount('info')).toBeGreaterThan(0);
    expect(logger2.getMessageCount('info')).toBeGreaterThan(0);
    expect(core1.setOutput).toHaveBeenCalled();
    expect(core2.setOutput).toHaveBeenCalled();
  });
});
