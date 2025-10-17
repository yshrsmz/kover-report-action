/**
 * Configuration layer for the GitHub Action
 *
 * Extracts all input parsing, validation, and defaults into typed configuration.
 * This separates configuration concerns from business logic and enables testability.
 */

import type * as core from '@actions/core';
import { normalizeModuleName } from '../common/paths';
import { DEFAULT_BASELINE_BRANCH, DEFAULT_HISTORY_RETENTION } from '../history';
import { parseThresholdsFromJSON } from './thresholds';
import { validateMinCoverage, validateModulePathTemplate } from './validation';

/**
 * Facade for @actions/core input methods
 *
 * Abstracts the GitHub Actions core API to enable testing
 * without mocking the entire @actions/core module.
 *
 * Uses actual types from @actions/core to ensure type safety.
 */
export type CoreFacade = {
  getInput: typeof core.getInput;
  setSecret: typeof core.setSecret;
};

/**
 * Input options for getInput method
 * Re-exported from @actions/core for convenience
 */
export type InputOptions = Parameters<typeof core.getInput>[1];

/**
 * Typed action configuration
 *
 * All inputs are parsed, validated, and normalized into this structure
 * before the action workflow begins. This ensures type safety and
 * separates input handling from business logic.
 */
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

/**
 * Configuration validation error
 *
 * Thrown when input validation fails. Contains actionable error messages
 * to help users fix their action.yml configuration.
 */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

/**
 * Wrap a function to convert errors to ConfigError
 *
 * If the error is already a ConfigError, it is rethrown as-is to avoid
 * double-wrapping with duplicate prefixes.
 */
const wrapError = <T>(fn: () => T, errorPrefix?: string): T => {
  try {
    return fn();
  } catch (error) {
    // If already a ConfigError, don't wrap again
    if (error instanceof ConfigError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    const prefix = errorPrefix ? `${errorPrefix}: ` : '';
    throw new ConfigError(`${prefix}${message}`);
  }
};

/**
 * Parse and validate minimum coverage value
 */
const parseMinCoverage = (input: string): number => wrapError(() => validateMinCoverage(input));

/**
 * Parse and validate history retention value
 */
const parseHistoryRetention = (input: string): number => {
  const value = Number.parseInt(input, 10);
  if (Number.isNaN(value) || value < 1) {
    throw new ConfigError(
      `Invalid history-retention value: "${input}". Must be a positive integer.`
    );
  }
  return value;
};

/**
 * Parse and normalize ignored modules list
 */
const parseIgnoredModules = (input: string): string[] =>
  input
    .split(',')
    .map((m) => m.trim())
    .filter((m) => m.length > 0)
    .map((entry) =>
      wrapError(() => normalizeModuleName(entry), 'Invalid module name in ignore-modules')
    );

/**
 * Parse thresholds JSON with helpful error message
 */
const parseThresholds = (input: string): Record<string, number> =>
  wrapError(
    () => parseThresholdsFromJSON(input),
    'Failed to parse thresholds JSON: ' +
      'Expected format: {"core": 80, "data": 75, ":specific:module": 90, "default": 60}\n' +
      'See https://github.com/yshrsmz/kover-report-action#threshold-configuration for examples.'
  );

/**
 * Determine discovery mode from command input
 */
const getDiscoveryMode = (command: string): 'command' | 'glob' =>
  command && command.trim().length > 0 ? 'command' : 'glob';

/**
 * Validate module path template when in command mode
 */
const validateCommandModeTemplate = (mode: 'command' | 'glob', template: string): void => {
  if (mode === 'command') {
    wrapError(() => validateModulePathTemplate(template));
  }
};

/**
 * Mask GitHub token if provided
 */
const maskToken = (facade: CoreFacade, token: string | undefined): void => {
  if (token) {
    facade.setSecret(token);
  }
};

/**
 * Load and validate configuration from GitHub Actions inputs
 *
 * @param facade - Core facade for reading inputs
 * @returns Validated and typed configuration object
 * @throws ConfigError if validation fails
 */
export function loadConfig(facade: CoreFacade): ActionConfig {
  // Read all inputs (pure data extraction)
  const discoveryCommand = facade.getInput('discovery-command');
  const coverageFiles = facade.getInput('coverage-files') || '**/build/reports/kover/report.xml';
  const modulePathTemplate =
    facade.getInput('module-path-template') || '{module}/build/reports/kover/report.xml';
  const ignoreModulesInput = facade.getInput('ignore-modules') || '';
  const thresholdsInput = facade.getInput('thresholds') || '{"default": 60}';
  const minCoverageInput = facade.getInput('min-coverage') || '0';
  const title = facade.getInput('title') || 'Code Coverage Report';
  const githubToken = facade.getInput('github-token');
  const enablePrComment = facade.getInput('enable-pr-comment') !== 'false';
  const enableHistory = facade.getInput('enable-history') === 'true';
  const historyRetentionInput =
    facade.getInput('history-retention') || String(DEFAULT_HISTORY_RETENTION);
  const baselineBranch = facade.getInput('baseline-branch') || DEFAULT_BASELINE_BRANCH;
  const debug = facade.getInput('debug') === 'true';

  // Side effect: mask token
  maskToken(facade, githubToken);

  // Parse and validate (pure transformations)
  const minCoverage = parseMinCoverage(minCoverageInput);
  const historyRetention = parseHistoryRetention(historyRetentionInput);
  const ignoredModules = parseIgnoredModules(ignoreModulesInput);
  const thresholds = parseThresholds(thresholdsInput);
  const discoveryMode = getDiscoveryMode(discoveryCommand);

  // Validate constraints
  validateCommandModeTemplate(discoveryMode, modulePathTemplate);

  // Build and return config object
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
    debug,
  };
}

/**
 * Create a CoreFacade from @actions/core module
 *
 * Since CoreFacade type matches @actions/core's signature, you can also
 * pass core directly to loadConfig without using this factory.
 *
 * @param core - The @actions/core module
 * @returns CoreFacade instance
 */
export function createCoreFacade(core: typeof import('@actions/core')): CoreFacade {
  return {
    getInput: core.getInput.bind(core),
    setSecret: core.setSecret.bind(core),
  };
}
