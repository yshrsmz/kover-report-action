import * as core from '@actions/core';
import { type CoverageResult, parseCoverageFile } from './parser';
import { checkThreshold, getThresholdForModule, type ThresholdConfig } from './threshold';

/**
 * Module coverage information with threshold and pass/fail status
 */
export interface ModuleCoverage {
  /** Module name in canonical format (e.g., ':core:common') */
  module: string;
  /** Coverage result (null if file not found) */
  coverage: CoverageResult | null;
  /** Threshold percentage for this module */
  threshold: number;
  /** Whether module meets threshold (false if coverage is null) */
  passed: boolean;
}

/**
 * Overall coverage aggregated from all modules
 */
export interface OverallCoverage {
  /** Overall coverage percentage (weighted by module size) */
  percentage: number;
  /** Total covered instructions across all modules */
  covered: number;
  /** Total instructions across all modules */
  total: number;
  /** Per-module coverage information */
  modules: ModuleCoverage[];
}

/**
 * Module information for aggregation
 */
export interface ModuleInfo {
  /** Module name */
  name: string;
  /** Path to coverage file */
  filePath: string;
}

/**
 * Aggregate coverage from multiple modules
 * Parses coverage files in parallel and calculates overall metrics
 * @param modules List of modules with file paths
 * @param thresholds Threshold configuration
 * @param minCoverage Global minimum coverage (fallback)
 * @returns Overall coverage with per-module breakdown
 */
export async function aggregateCoverage(
  modules: ModuleInfo[],
  thresholds: ThresholdConfig,
  minCoverage: number
): Promise<OverallCoverage> {
  if (modules.length === 0) {
    core.info('No modules to aggregate');
    return {
      percentage: 0,
      covered: 0,
      total: 0,
      modules: [],
    };
  }

  core.info(`Aggregating coverage for ${modules.length} modules`);

  // Parse all coverage files in parallel for performance
  const coveragePromises = modules.map(async ({ name, filePath }) => {
    const coverage = await parseCoverageFile(filePath);
    const threshold = getThresholdForModule(name, thresholds, minCoverage);

    // Module passes only if coverage exists and meets threshold
    const passed = coverage !== null && checkThreshold(coverage.percentage, threshold);

    if (coverage === null) {
      core.warning(`No coverage data found for module ${name}`);
    } else if (!passed) {
      core.warning(`Module ${name} below threshold: ${coverage.percentage}% < ${threshold}%`);
    } else {
      core.info(`Module ${name} meets threshold: ${coverage.percentage}% >= ${threshold}%`);
    }

    return {
      module: name,
      coverage,
      threshold,
      passed,
    } as ModuleCoverage;
  });

  // Wait for all coverage parsing to complete
  const moduleCoverages = await Promise.all(coveragePromises);

  // Calculate overall coverage (exclude modules with null coverage)
  let totalCovered = 0;
  let totalInstructions = 0;

  for (const { coverage } of moduleCoverages) {
    if (coverage !== null) {
      totalCovered += coverage.covered;
      totalInstructions += coverage.total;
    }
  }

  // Calculate overall percentage (handle division by zero)
  const overallPercentage = totalInstructions === 0 ? 0 : (totalCovered / totalInstructions) * 100;

  // Round to 1 decimal place
  const roundedPercentage = Math.round(overallPercentage * 10) / 10;

  core.info(
    `Overall coverage: ${roundedPercentage}% (${totalCovered}/${totalInstructions} instructions)`
  );

  return {
    percentage: roundedPercentage,
    covered: totalCovered,
    total: totalInstructions,
    modules: moduleCoverages,
  };
}

/**
 * Get list of modules that failed threshold check
 * @param overall Overall coverage result
 * @returns Array of module names that failed
 */
export function getFailedModules(overall: OverallCoverage): string[] {
  return overall.modules
    .filter((m) => !m.passed && m.coverage !== null) // Only include modules with coverage that failed
    .map((m) => m.module);
}

/**
 * Get list of modules with missing coverage
 * @param overall Overall coverage result
 * @returns Array of module names with no coverage data
 */
export function getMissingCoverageModules(overall: OverallCoverage): string[] {
  return overall.modules.filter((m) => m.coverage === null).map((m) => m.module);
}
