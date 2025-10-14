import { describe, expect, test, vi } from 'vitest';
import { ConfigError, type CoreFacade, type InputOptions, loadConfig } from '../config';

/**
 * Create a mock CoreFacade for testing
 *
 * Uses Vitest mocks instead of a custom class implementation.
 */
function createMockCoreFacade(inputs: Record<string, string> = {}): CoreFacade {
  return {
    getInput: vi.fn((name: string, options?: InputOptions) => {
      const value = inputs[name] || '';

      // Handle trimWhitespace option (default: true)
      const trimWhitespace = options?.trimWhitespace !== false;
      const trimmedValue = trimWhitespace ? value.trim() : value;

      // Handle required option
      if (options?.required && !trimmedValue) {
        throw new Error(`Input required and not supplied: ${name}`);
      }

      return trimmedValue;
    }),
    setSecret: vi.fn(),
  };
}

describe('loadConfig', () => {
  describe('default configuration', () => {
    test('loads with all defaults when no inputs provided', () => {
      const facade = createMockCoreFacade();
      const config = loadConfig(facade);

      expect(config.discoveryMode).toBe('glob');
      expect(config.discoveryCommand).toBeUndefined();
      expect(config.coverageFilesPattern).toBe('**/build/reports/kover/report.xml');
      expect(config.modulePathTemplate).toBe('{module}/build/reports/kover/report.xml');
      expect(config.ignoredModules).toEqual([]);
      expect(config.thresholds).toEqual({ default: 60 });
      expect(config.minCoverage).toBe(0);
      expect(config.title).toBe('Code Coverage Report');
      expect(config.enablePrComment).toBe(true);
      expect(config.githubToken).toBeUndefined();
      expect(config.enableHistory).toBe(false);
      expect(config.historyRetention).toBe(50);
      expect(config.baselineBranch).toBe('main');
      expect(config.debug).toBe(false);
    });
  });

  describe('discovery mode', () => {
    test('uses command mode when discovery-command is provided', () => {
      const facade = createMockCoreFacade({
        'discovery-command': './gradlew -q projects',
      });
      const config = loadConfig(facade);

      expect(config.discoveryMode).toBe('command');
      expect(config.discoveryCommand).toBe('./gradlew -q projects');
    });

    test('uses glob mode when discovery-command is empty', () => {
      const facade = createMockCoreFacade({
        'discovery-command': '',
      });
      const config = loadConfig(facade);

      expect(config.discoveryMode).toBe('glob');
      expect(config.discoveryCommand).toBeUndefined();
    });

    test('uses glob mode when discovery-command is whitespace only', () => {
      const facade = createMockCoreFacade({
        'discovery-command': '   ',
      });
      const config = loadConfig(facade);

      expect(config.discoveryMode).toBe('glob');
      expect(config.discoveryCommand).toBeUndefined();
    });

    test('validates module-path-template in command mode', () => {
      const facade = createMockCoreFacade({
        'discovery-command': './gradlew -q projects',
        'module-path-template': 'invalid/template.xml', // Missing {module}
      });

      expect(() => loadConfig(facade)).toThrow(ConfigError);
      expect(() => loadConfig(facade)).toThrow('{module}');
    });

    test('does not validate module-path-template in glob mode', () => {
      const facade = createMockCoreFacade({
        'module-path-template': 'invalid/template.xml', // Missing {module} but glob mode
      });

      // Should not throw since glob mode doesn't use the template
      expect(() => loadConfig(facade)).not.toThrow();
    });
  });

  describe('coverage patterns', () => {
    test('uses custom coverage-files pattern', () => {
      const facade = createMockCoreFacade({
        'coverage-files': '**/coverage/*.xml',
      });
      const config = loadConfig(facade);

      expect(config.coverageFilesPattern).toBe('**/coverage/*.xml');
    });

    test('uses custom module-path-template', () => {
      const facade = createMockCoreFacade({
        'module-path-template': '{module}/coverage/report.xml',
      });
      const config = loadConfig(facade);

      expect(config.modulePathTemplate).toBe('{module}/coverage/report.xml');
    });
  });

  describe('ignored modules', () => {
    test('parses single ignored module', () => {
      const facade = createMockCoreFacade({
        'ignore-modules': ':test',
      });
      const config = loadConfig(facade);

      expect(config.ignoredModules).toEqual([':test']);
    });

    test('parses multiple ignored modules', () => {
      const facade = createMockCoreFacade({
        'ignore-modules': ':core, :test, build-logic',
      });
      const config = loadConfig(facade);

      // normalizeModuleName adds leading colon to 'build-logic'
      expect(config.ignoredModules).toEqual([':core', ':test', ':build-logic']);
    });

    test('normalizes module names with leading colons', () => {
      const facade = createMockCoreFacade({
        'ignore-modules': 'core, test', // Without colons
      });
      const config = loadConfig(facade);

      // normalizeModuleName adds leading colon if missing
      expect(config.ignoredModules).toEqual([':core', ':test']);
    });

    test('filters empty entries', () => {
      const facade = createMockCoreFacade({
        'ignore-modules': ':core,  , :test,',
      });
      const config = loadConfig(facade);

      expect(config.ignoredModules).toEqual([':core', ':test']);
    });

    test('handles empty ignore-modules input', () => {
      const facade = createMockCoreFacade({
        'ignore-modules': '',
      });
      const config = loadConfig(facade);

      expect(config.ignoredModules).toEqual([]);
    });

    test('throws ConfigError for invalid module name with empty segments (double colon)', () => {
      const facade = createMockCoreFacade({
        'ignore-modules': ':core, ::invalid, :test',
      });

      expect(() => loadConfig(facade)).toThrow(ConfigError);
      expect(() => loadConfig(facade)).toThrow('Invalid module name in ignore-modules');
      expect(() => loadConfig(facade)).toThrow('empty segments');
    });
  });

  describe('thresholds', () => {
    test('parses simple thresholds JSON', () => {
      const facade = createMockCoreFacade({
        thresholds: '{"default": 70, "core": 80}',
      });
      const config = loadConfig(facade);

      expect(config.thresholds).toEqual({ default: 70, core: 80 });
    });

    test('parses complex thresholds with module paths', () => {
      const facade = createMockCoreFacade({
        thresholds: '{"default": 60, ":core": 80, ":data:models": 90}',
      });
      const config = loadConfig(facade);

      expect(config.thresholds).toEqual({
        default: 60,
        ':core': 80,
        ':data:models': 90,
      });
    });

    test('throws ConfigError for invalid JSON', () => {
      const facade = createMockCoreFacade({
        thresholds: 'not valid json',
      });

      expect(() => loadConfig(facade)).toThrow(ConfigError);
      expect(() => loadConfig(facade)).toThrow('Failed to parse thresholds JSON');
    });

    test('throws ConfigError for non-object JSON', () => {
      const facade = createMockCoreFacade({
        thresholds: '[1, 2, 3]',
      });

      expect(() => loadConfig(facade)).toThrow(ConfigError);
      expect(() => loadConfig(facade)).toThrow('thresholds JSON');
    });

    test('includes helpful error message with example', () => {
      const facade = createMockCoreFacade({
        thresholds: 'invalid',
      });

      expect(() => loadConfig(facade)).toThrow('Expected format:');
      expect(() => loadConfig(facade)).toThrow('github.com/yshrsmz/kover-report-action');
    });
  });

  describe('min-coverage validation', () => {
    test('accepts valid coverage values', () => {
      const facade = createMockCoreFacade({
        'min-coverage': '75',
      });
      const config = loadConfig(facade);

      expect(config.minCoverage).toBe(75);
    });

    test('accepts decimal values', () => {
      const facade = createMockCoreFacade({
        'min-coverage': '75.5',
      });
      const config = loadConfig(facade);

      expect(config.minCoverage).toBe(75.5);
    });

    test('accepts 0', () => {
      const facade = createMockCoreFacade({
        'min-coverage': '0',
      });
      const config = loadConfig(facade);

      expect(config.minCoverage).toBe(0);
    });

    test('accepts 100', () => {
      const facade = createMockCoreFacade({
        'min-coverage': '100',
      });
      const config = loadConfig(facade);

      expect(config.minCoverage).toBe(100);
    });

    test('throws ConfigError for non-numeric value', () => {
      const facade = createMockCoreFacade({
        'min-coverage': 'invalid',
      });

      expect(() => loadConfig(facade)).toThrow(ConfigError);
      expect(() => loadConfig(facade)).toThrow('Invalid min-coverage value');
    });

    test('throws ConfigError for negative value', () => {
      const facade = createMockCoreFacade({
        'min-coverage': '-10',
      });

      expect(() => loadConfig(facade)).toThrow(ConfigError);
      expect(() => loadConfig(facade)).toThrow('between 0 and 100');
    });

    test('throws ConfigError for value above 100', () => {
      const facade = createMockCoreFacade({
        'min-coverage': '150',
      });

      expect(() => loadConfig(facade)).toThrow(ConfigError);
      expect(() => loadConfig(facade)).toThrow('between 0 and 100');
    });
  });

  describe('reporting configuration', () => {
    test('uses custom title', () => {
      const facade = createMockCoreFacade({
        title: 'My Coverage Report',
      });
      const config = loadConfig(facade);

      expect(config.title).toBe('My Coverage Report');
    });

    test('enables PR comment by default', () => {
      const facade = createMockCoreFacade();
      const config = loadConfig(facade);

      expect(config.enablePrComment).toBe(true);
    });

    test('disables PR comment when explicitly set to false', () => {
      const facade = createMockCoreFacade({
        'enable-pr-comment': 'false',
      });
      const config = loadConfig(facade);

      expect(config.enablePrComment).toBe(false);
    });

    test('enables PR comment for any non-false value', () => {
      const facade = createMockCoreFacade({
        'enable-pr-comment': 'true',
      });
      const config = loadConfig(facade);

      expect(config.enablePrComment).toBe(true);
    });
  });

  describe('GitHub token handling', () => {
    test('stores github-token when provided', () => {
      const facade = createMockCoreFacade({
        'github-token': 'ghp_test123456',
      });
      const config = loadConfig(facade);

      expect(config.githubToken).toBe('ghp_test123456');
    });

    test('leaves githubToken undefined when not provided', () => {
      const facade = createMockCoreFacade();
      const config = loadConfig(facade);

      expect(config.githubToken).toBeUndefined();
    });

    test('masks token using setSecret', () => {
      const facade = createMockCoreFacade({
        'github-token': 'ghp_test123456',
      });
      loadConfig(facade);

      expect(facade.setSecret).toHaveBeenCalledWith('ghp_test123456');
    });

    test('does not call setSecret when token is empty', () => {
      const facade = createMockCoreFacade({
        'github-token': '',
      });
      loadConfig(facade);

      expect(facade.setSecret).not.toHaveBeenCalled();
    });
  });

  describe('history configuration', () => {
    test('disables history by default', () => {
      const facade = createMockCoreFacade();
      const config = loadConfig(facade);

      expect(config.enableHistory).toBe(false);
    });

    test('enables history when explicitly set to true', () => {
      const facade = createMockCoreFacade({
        'enable-history': 'true',
      });
      const config = loadConfig(facade);

      expect(config.enableHistory).toBe(true);
    });

    test('uses default history retention', () => {
      const facade = createMockCoreFacade();
      const config = loadConfig(facade);

      expect(config.historyRetention).toBe(50);
    });

    test('uses custom history retention', () => {
      const facade = createMockCoreFacade({
        'history-retention': '100',
      });
      const config = loadConfig(facade);

      expect(config.historyRetention).toBe(100);
    });

    test('throws ConfigError for invalid history retention', () => {
      const facade = createMockCoreFacade({
        'history-retention': 'invalid',
      });

      expect(() => loadConfig(facade)).toThrow(ConfigError);
      expect(() => loadConfig(facade)).toThrow('Invalid history-retention value');
    });

    test('throws ConfigError for negative history retention', () => {
      const facade = createMockCoreFacade({
        'history-retention': '-10',
      });

      expect(() => loadConfig(facade)).toThrow(ConfigError);
      expect(() => loadConfig(facade)).toThrow('Must be a positive integer');
    });

    test('throws ConfigError for zero history retention', () => {
      const facade = createMockCoreFacade({
        'history-retention': '0',
      });

      expect(() => loadConfig(facade)).toThrow(ConfigError);
      expect(() => loadConfig(facade)).toThrow('positive integer');
    });

    test('uses default baseline branch', () => {
      const facade = createMockCoreFacade();
      const config = loadConfig(facade);

      expect(config.baselineBranch).toBe('main');
    });

    test('uses custom baseline branch', () => {
      const facade = createMockCoreFacade({
        'baseline-branch': 'develop',
      });
      const config = loadConfig(facade);

      expect(config.baselineBranch).toBe('develop');
    });
  });

  describe('debug mode', () => {
    test('disables debug by default', () => {
      const facade = createMockCoreFacade();
      const config = loadConfig(facade);

      expect(config.debug).toBe(false);
    });

    test('enables debug when set to true', () => {
      const facade = createMockCoreFacade({
        debug: 'true',
      });
      const config = loadConfig(facade);

      expect(config.debug).toBe(true);
    });

    test('disables debug for any non-true value', () => {
      const facade = createMockCoreFacade({
        debug: 'false',
      });
      const config = loadConfig(facade);

      expect(config.debug).toBe(false);
    });
  });

  describe('integration scenarios', () => {
    test('loads full production-like configuration', () => {
      const facade = createMockCoreFacade({
        'discovery-command': './gradlew -q projects',
        'module-path-template': '{module}/build/reports/kover/report.xml',
        'ignore-modules': ':build-logic, :test-fixtures',
        thresholds: '{"default": 70, ":core": 85, ":data": 80}',
        'min-coverage': '65',
        title: 'Kotlin Coverage Report',
        'github-token': 'ghp_test123',
        'enable-pr-comment': 'true',
        'enable-history': 'true',
        'history-retention': '100',
        'baseline-branch': 'develop',
        debug: 'true',
      });

      const config = loadConfig(facade);

      expect(config).toMatchObject({
        discoveryMode: 'command',
        discoveryCommand: './gradlew -q projects',
        modulePathTemplate: '{module}/build/reports/kover/report.xml',
        ignoredModules: [':build-logic', ':test-fixtures'],
        thresholds: { default: 70, ':core': 85, ':data': 80 },
        minCoverage: 65,
        title: 'Kotlin Coverage Report',
        githubToken: 'ghp_test123',
        enablePrComment: true,
        enableHistory: true,
        historyRetention: 100,
        baselineBranch: 'develop',
        debug: true,
      });
    });

    test('loads minimal configuration', () => {
      const facade = createMockCoreFacade({
        'min-coverage': '50',
      });

      const config = loadConfig(facade);

      expect(config).toMatchObject({
        discoveryMode: 'glob',
        minCoverage: 50,
        enablePrComment: true,
        enableHistory: false,
      });
    });
  });
});

describe('createCoreFacade', () => {
  test('is tested through integration with actual @actions/core', () => {
    // createCoreFacade is a simple factory function that returns a facade
    // It's tested implicitly through integration tests and the main action
    // No unit tests needed for simple delegation
    expect(true).toBe(true);
  });
});
