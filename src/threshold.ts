import type { Logger } from './common/logger';
import type { ThresholdConfig } from './config/thresholds';

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
 * @param logger Logger for output
 * @param moduleName Module name (e.g., ':core:testing')
 * @param thresholds Threshold configuration
 * @param minCoverage Global minimum coverage (fallback)
 * @returns Threshold percentage for the module
 */
export function getThresholdForModule(
  logger: Logger,
  moduleName: string,
  thresholds: ThresholdConfig,
  minCoverage: number
): number {
  // 1. Try exact module name match
  if (moduleName in thresholds) {
    logger.debug(`Threshold for ${moduleName}: ${thresholds[moduleName]} (exact match)`);
    return thresholds[moduleName];
  }

  // 2. Try module type match
  const moduleType = getModuleType(moduleName);
  if (moduleType !== 'default' && moduleType in thresholds) {
    logger.debug(
      `Threshold for ${moduleName}: ${thresholds[moduleType]} (type match: ${moduleType})`
    );
    return thresholds[moduleType];
  }

  // 3. Try 'default' key
  if ('default' in thresholds) {
    logger.debug(`Threshold for ${moduleName}: ${thresholds.default} (default)`);
    return thresholds.default;
  }

  // 4. Use minCoverage parameter
  logger.debug(`Threshold for ${moduleName}: ${minCoverage} (min-coverage)`);
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
