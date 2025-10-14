import * as core from '@actions/core';

/**
 * Threshold configuration object
 * Keys can be:
 * - Module type (e.g., "core", "data", "feature")
 * - Full module name (e.g., ":core:testing")
 * - "default" for fallback
 */
export interface ThresholdConfig {
  [key: string]: number;
}

/**
 * Get module type from module name
 * Extracts the first segment after the leading colon
 * @param moduleName Module name (e.g., ':core:testing')
 * @returns Module type (e.g., 'core') or 'default' if cannot extract
 * @example
 * getModuleType(':core:testing') // => 'core'
 * getModuleType(':app') // => 'app'
 * getModuleType('') // => 'default'
 */
export function getModuleType(moduleName: string): string {
  if (!moduleName || moduleName.trim().length === 0) {
    return 'default';
  }

  // Split by ':' and filter out empty strings
  const parts = moduleName.split(':').filter(Boolean);

  // Return first part if exists, otherwise 'default'
  return parts.length > 0 ? parts[0] : 'default';
}

/**
 * Get threshold for a specific module
 * Priority order:
 * 1. Exact module name match (e.g., ':core:testing')
 * 2. Module type match (e.g., 'core')
 * 3. 'default' key in thresholds
 * 4. minCoverage parameter
 * 5. Hard default: 0
 * @param moduleName Module name (e.g., ':core:testing')
 * @param thresholds Threshold configuration
 * @param minCoverage Global minimum coverage (fallback)
 * @returns Threshold percentage for the module
 */
export function getThresholdForModule(
  moduleName: string,
  thresholds: ThresholdConfig,
  minCoverage: number
): number {
  // 1. Try exact module name match
  if (moduleName in thresholds) {
    core.debug(`Threshold for ${moduleName}: ${thresholds[moduleName]} (exact match)`);
    return thresholds[moduleName];
  }

  // 2. Try module type match
  const moduleType = getModuleType(moduleName);
  if (moduleType !== 'default' && moduleType in thresholds) {
    core.debug(
      `Threshold for ${moduleName}: ${thresholds[moduleType]} (type match: ${moduleType})`
    );
    return thresholds[moduleType];
  }

  // 3. Try 'default' key
  if ('default' in thresholds) {
    core.debug(`Threshold for ${moduleName}: ${thresholds.default} (default)`);
    return thresholds.default;
  }

  // 4. Use minCoverage parameter
  core.debug(`Threshold for ${moduleName}: ${minCoverage} (min-coverage)`);
  return minCoverage;
}

/**
 * Check if coverage meets or exceeds threshold
 * @param coverage Coverage percentage
 * @param threshold Threshold percentage
 * @returns true if coverage >= threshold
 */
export function checkThreshold(coverage: number, threshold: number): boolean {
  return coverage >= threshold;
}

/**
 * Validate thresholds configuration
 * Ensures all values are numbers within 0-100 range
 * @param thresholds Threshold configuration object
 * @throws Error if validation fails
 */
export function validateThresholds(thresholds: ThresholdConfig): void {
  for (const [key, value] of Object.entries(thresholds)) {
    // Validate key format
    if (key !== 'default') {
      // Key must be either:
      // 1. Module type (no leading colon): e.g., "core", "data", "feature"
      // 2. Full module name (with leading colon): e.g., ":core:testing"

      if (key.startsWith(':')) {
        // Full module name - must not contain empty segments
        if (key.includes('::')) {
          throw new Error(
            `Threshold key '${key}' is invalid: module names cannot contain empty segments (::)`
          );
        }
        // Must have at least one segment after the colon
        if (key.length === 1 || key.endsWith(':')) {
          throw new Error(`Threshold key '${key}' is invalid: incomplete module name`);
        }
      } else {
        // Module type - must not contain colons
        if (key.includes(':')) {
          throw new Error(
            `Threshold key '${key}' is invalid: module types cannot contain colons (use leading colon for full module names)`
          );
        }
        // Must not be empty
        if (key.trim().length === 0) {
          throw new Error('Threshold key cannot be empty');
        }
      }
    }

    // Check if value is a number
    if (typeof value !== 'number' || Number.isNaN(value)) {
      throw new Error(`Threshold value for '${key}' must be a number, got: ${typeof value}`);
    }

    // Check if value is within range
    if (value < 0 || value > 100) {
      throw new Error(`Threshold value for '${key}' must be between 0 and 100, got: ${value}`);
    }
  }
}

/**
 * Parse threshold configuration from JSON string
 * @param jsonString JSON string containing thresholds
 * @returns Parsed and validated threshold configuration
 * @throws Error if JSON is invalid or validation fails
 */
export function parseThresholdsFromJSON(jsonString: string): ThresholdConfig {
  if (!jsonString || jsonString.trim().length === 0) {
    return {};
  }

  try {
    const parsed = JSON.parse(jsonString);

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error('Thresholds must be a JSON object');
    }

    // Validate the parsed thresholds
    validateThresholds(parsed);

    return parsed;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid threshold JSON: ${error.message}`);
    }
    throw error;
  }
}
