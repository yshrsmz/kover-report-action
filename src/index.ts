import * as core from '@actions/core';
import { runAction } from './action-runner';
import { loadHistoryFromArtifacts, saveHistoryToArtifacts } from './artifacts';
import { createCoreFacade, loadConfig } from './config';
import { createCommandDiscovery, createGlobDiscovery } from './discovery/index';
import { DefaultHistoryManager } from './history/manager';
import { createLogger } from './logger';
import { createActionsReporter } from './reporter/actions-reporter';

/**
 * Main entry point for the GitHub Action
 *
 * This is the slim entrypoint that wires up all dependencies and delegates
 * to the action runner for orchestration.
 */
async function run(): Promise<void> {
  // Create logger
  const logger = createLogger(core);

  // Hoist config for error handling
  let config: ReturnType<typeof loadConfig> | undefined;

  try {
    // Load configuration
    const facade = createCoreFacade(core);
    config = loadConfig(facade);

    // Create discovery function based on mode
    const discovery =
      config.discoveryMode === 'command' && config.discoveryCommand
        ? createCommandDiscovery(config.discoveryCommand, config.modulePathTemplate)
        : createGlobDiscovery(config.coverageFilesPattern);

    // Create history manager (if enabled)
    const history = config.enableHistory
      ? new DefaultHistoryManager(
          {
            load: () =>
              loadHistoryFromArtifacts(
                logger,
                undefined, // Use default artifact name
                config?.githubToken,
                config?.baselineBranch
              ),
            save: (data) => saveHistoryToArtifacts(logger, data),
          },
          config.historyRetention,
          config.baselineBranch
        )
      : undefined;

    // Create reporter function
    const reporter = createActionsReporter({
      logger,
      core,
      githubToken: config.githubToken,
      enablePrComment: config.enablePrComment,
      debug: config.debug,
    });

    // Run action workflow
    const result = await runAction(config, {
      discovery,
      history,
      reporter,
      logger,
    });

    // Handle workflow control (setFailed) at the entrypoint
    if (!result.success) {
      core.setFailed(`❌ ${result.error || 'Action failed'}`);
    }
  } catch (error) {
    // Catch any unhandled errors and mark action as failed
    if (error instanceof Error) {
      core.setFailed(`❌ Action failed: ${error.message}`);
      if (config?.debug && error.stack) {
        logger.debug(error.stack);
      }
    } else {
      core.setFailed('❌ Action failed with unknown error');
    }
  }
}

// Run the action
run();
