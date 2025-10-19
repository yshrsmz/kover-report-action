import type { Logger } from './common/logger';
import { resolveSecurePath } from './common/paths';
import type { ActionConfig } from './config';
import { aggregateCoverage } from './coverage';
import type { ModuleDiscovery } from './discovery/index';
import type { HistoryComparison } from './history/index';
import type { CoverageSnapshot, HistoryContext, HistoryManager } from './history/manager';
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

/**
 * Run the coverage report action workflow
 *
 * This function orchestrates the entire workflow:
 * 1. Discover modules
 * 2. Validate paths for security
 * 3. Aggregate coverage
 * 4. Compare with history (if enabled)
 * 5. Report results
 * 6. Check thresholds
 *
 * @param config - Action configuration
 * @param deps - Injected dependencies (discovery, history, reporter, logger)
 * @returns RunResult with success status and coverage percentage
 */
export async function runAction(
  config: ActionConfig,
  deps: ActionRunnerDependencies
): Promise<RunResult> {
  const { discovery, history, reporter, logger } = deps;

  // Track coverage percentage outside try block so we can return it even on failure
  let coveragePercentage = 0;

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
    const modules = await discovery({
      ignoredModules: config.ignoredModules,
    });

    logger.info(`Found ${modules.length} modules`);
    if (config.debug) {
      logger.debug(`Modules: ${modules.map((m: { name: string }) => m.name).join(', ')}`);
    }

    if (config.ignoredModules.length > 0) {
      logger.info(
        `Ignoring ${config.ignoredModules.length} modules: ${config.ignoredModules.join(', ')}`
      );
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
    const overall = await aggregateCoverage(logger, modules, config.thresholds, config.minCoverage);

    // Store coverage percentage for error handling
    coveragePercentage = overall.percentage;

    // Handle history
    let comparison: HistoryComparison | undefined;
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
              .map((m) => [m.module, m.coverage?.percentage ?? 0])
          ),
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
          timestamp: new Date().toISOString(),
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
        if (config.debug && error instanceof Error && error.stack) {
          logger.debug(error.stack);
        }
      }
    }

    // Report results
    const reportResult: ReportResult = {
      overall,
      comparison,
      history: history?.getHistory(),
    };
    await reporter(reportResult, config.title);

    // Check threshold
    if (overall.percentage < config.minCoverage) {
      throw new Error(
        `Overall coverage ${overall.percentage}% is below minimum required ${config.minCoverage}%`
      );
    }

    logger.info('✅ Coverage check passed!');
    return {
      success: true,
      coveragePercentage: overall.percentage,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Action failed: ${message}`);

    return {
      success: false,
      coveragePercentage,
      error: message,
    };
  }
}
