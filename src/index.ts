import * as core from '@actions/core';
import * as github from '@actions/github';
import { aggregateCoverage, getFailedModules, getMissingCoverageModules } from './aggregator';
import { loadHistoryFromArtifacts, saveHistoryToArtifacts } from './artifacts';
import { discoverModulesFromCommand, discoverModulesFromGlob } from './discovery';
import { postCoverageComment } from './github';
import {
  DEFAULT_BASELINE_BRANCH,
  DEFAULT_HISTORY_RETENTION,
  addHistoryEntry,
  compareWithBaseline,
  createHistoryEntry,
  loadHistory,
  saveHistory,
  trimHistory,
} from './history';
import { normalizeModuleName, resolveModulePath, resolveSecurePath } from './paths';
import { generateMarkdownReport } from './report';
import { parseThresholdsFromJSON } from './threshold';
import { validateMinCoverage, validateModulePathTemplate } from './validation';

/**
 * Main entry point for the GitHub Action
 */
async function run(): Promise<void> {
  try {
    // Get inputs from action.yml
    const discoveryCommand = core.getInput('discovery-command');
    const coverageFiles = core.getInput('coverage-files') || '**/build/reports/kover/report.xml';
    const modulePathTemplate =
      core.getInput('module-path-template') || '{module}/build/reports/kover/report.xml';
    const ignoreModulesInput = core.getInput('ignore-modules') || '';
    const thresholdsInput = core.getInput('thresholds') || '{"default": 60}';
    const minCoverageInput = core.getInput('min-coverage') || '0';
    const title = core.getInput('title') || 'Code Coverage Report';
    const githubToken = core.getInput('github-token');
    const enablePrComment = core.getInput('enable-pr-comment') !== 'false'; // Default true
    const enableHistory = core.getInput('enable-history') === 'true'; // Default false
    const historyRetentionInput =
      core.getInput('history-retention') || String(DEFAULT_HISTORY_RETENTION);
    const baselineBranch = core.getInput('baseline-branch') || DEFAULT_BASELINE_BRANCH;
    const debug = core.getInput('debug') === 'true';

    // Mask sensitive token to prevent exposure in logs
    if (githubToken) {
      core.setSecret(githubToken);
    }

    // Validate min-coverage input
    const minCoverage = validateMinCoverage(minCoverageInput);

    // Validate history retention input
    const historyRetention = Number.parseInt(historyRetentionInput, 10);
    if (Number.isNaN(historyRetention) || historyRetention < 1) {
      throw new Error(
        `Invalid history-retention value: "${historyRetentionInput}". Must be a positive integer.`
      );
    }

    // Parse ignored modules
    const ignoredModules = ignoreModulesInput
      .split(',')
      .map((m) => m.trim())
      .filter((m) => m.length > 0)
      .map((m) => normalizeModuleName(m));

    core.info('📊 Kover Coverage Report Action');
    core.info(`🎯 Minimum coverage requirement: ${minCoverage}%`);
    core.info(`📝 Report title: ${title}`);
    if (enableHistory) {
      core.info(
        `📈 History tracking enabled (baseline: ${baselineBranch}, retention: ${historyRetention})`
      );
    }

    if (debug) {
      core.info('🐛 Debug mode enabled');
      core.debug(`Discovery command: ${discoveryCommand || '(not set)'}`);
      core.debug(`Coverage files pattern: ${coverageFiles}`);
      core.debug(`Module path template: ${modulePathTemplate}`);
      core.debug(
        `Ignored modules: ${ignoredModules.length > 0 ? ignoredModules.join(', ') : '(none)'}`
      );
      core.debug(`Enable PR comment: ${enablePrComment}`);
    }

    // Validate module-path-template when using command-based discovery
    if (discoveryCommand && discoveryCommand.trim().length > 0) {
      validateModulePathTemplate(modulePathTemplate);
    }

    // Parse and validate thresholds
    let thresholds: ReturnType<typeof parseThresholdsFromJSON>;
    try {
      thresholds = parseThresholdsFromJSON(thresholdsInput);
      core.info(`✅ Thresholds configured: ${Object.keys(thresholds).length} rules`);
      if (debug) {
        core.debug(`Threshold rules: ${JSON.stringify(thresholds, null, 2)}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to parse thresholds JSON: ${message}\nExpected format: {"core": 80, "data": 75, ":specific:module": 90, "default": 60}\nSee https://github.com/yshrsmz/kover-report-action#threshold-configuration for examples.`
      );
    }

    // Discover modules
    let modules: Array<{ name: string; filePath: string }> = [];

    if (discoveryCommand && discoveryCommand.trim().length > 0) {
      // Command-based discovery
      core.info(`🔍 Discovering modules using command: ${discoveryCommand}`);
      const moduleNames = await discoverModulesFromCommand(discoveryCommand, ignoredModules);

      if (moduleNames.length === 0) {
        throw new Error(
          `No modules found by discovery command.\nCommand: ${discoveryCommand}\nPossible causes:\n- Command output does not contain "Project \'...\'" patterns\n- All modules are in the ignore-modules list\n- Command failed or returned no output\nTip: Run the command locally to verify its output format.`
        );
      }

      core.info(`Found ${moduleNames.length} modules via command`);
      if (debug) {
        core.debug(`Discovered modules: ${moduleNames.join(', ')}`);
      }

      // Resolve paths using template
      modules = moduleNames.map((name) => ({
        name,
        filePath: resolveModulePath(name, modulePathTemplate),
      }));
    } else {
      // Glob-based discovery
      core.info(`🔍 Discovering modules using glob pattern: ${coverageFiles}`);
      const globResults = await discoverModulesFromGlob(coverageFiles, ignoredModules);

      if (globResults.length === 0) {
        throw new Error(
          `No coverage files found matching pattern.\nPattern: ${coverageFiles}\nPossible causes:\n- Coverage reports not generated (run tests with coverage first)\n- Pattern does not match actual file locations\n- All matching modules are in the ignore-modules list\nTip: Verify files exist by running: ls -la **/build/reports/kover/report.xml`
        );
      }

      // Convert from {module, filePath} to {name, filePath}
      modules = globResults.map(({ module, filePath }) => ({ name: module, filePath }));

      core.info(`Found ${modules.length} modules via glob pattern`);
      if (debug) {
        core.debug(`Discovered modules: ${modules.map((m) => m.name).join(', ')}`);
      }
    }

    if (ignoredModules.length > 0) {
      core.info(`Ignoring ${ignoredModules.length} modules: ${ignoredModules.join(', ')}`);
    }

    // Validate all module paths for security (prevent path traversal)
    const workspace = process.env.GITHUB_WORKSPACE || process.cwd();
    core.debug(`Validating module paths against workspace: ${workspace}`);

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
    core.info('📈 Aggregating coverage...');
    if (debug) {
      core.debug(`Parsing coverage for ${modules.length} modules...`);
      for (const { name, filePath } of modules) {
        core.debug(`  ${name}: ${filePath}`);
      }
    }
    const overall = await aggregateCoverage(modules, thresholds, minCoverage);

    // Set outputs
    core.setOutput('coverage-percentage', overall.percentage.toString());
    core.setOutput('instructions-covered', overall.covered.toString());
    core.setOutput('instructions-total', overall.total.toString());

    // Module coverage JSON
    const moduleCoverageJson: Record<string, number | string> = {};
    for (const { module, coverage } of overall.modules) {
      moduleCoverageJson[module] = coverage?.percentage ?? 'N/A';
    }
    core.setOutput('modules-coverage-json', JSON.stringify(moduleCoverageJson));

    // Modules below threshold
    const failedModules = getFailedModules(overall);
    const missingModules = getMissingCoverageModules(overall);

    core.setOutput('modules-below-threshold', failedModules.join(','));

    // Summary
    core.info('');
    core.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    core.info(`📊 Overall Coverage: ${overall.percentage}%`);
    core.info(`📏 Instructions: ${overall.covered}/${overall.total}`);
    core.info(`✅ Passing modules: ${overall.modules.filter((m) => m.passed).length}`);

    if (failedModules.length > 0) {
      core.info(`❌ Failing modules: ${failedModules.length}`);
      for (const module of failedModules) {
        const moduleCov = overall.modules.find((m) => m.module === module);
        if (moduleCov?.coverage) {
          core.warning(`  ${module}: ${moduleCov.coverage.percentage}% < ${moduleCov.threshold}%`);
        }
      }
    }

    if (missingModules.length > 0) {
      core.info(`⚠️  Missing coverage: ${missingModules.length} modules`);
      if (debug) {
        for (const module of missingModules) {
          core.debug(`  ${module}: No coverage file found`);
        }
      }
    }

    core.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Load and compare with history if enabled
    let comparison: import('./history').HistoryComparison | undefined;
    if (enableHistory) {
      try {
        core.info('📊 Loading coverage history...');
        const historyJson = await loadHistoryFromArtifacts();
        const history = loadHistory(historyJson);

        if (debug) {
          core.debug(`Loaded ${history.length} history entries`);
        }

        if (history.length > 0) {
          // Get current branch and commit
          const currentBranch = github.context.ref.replace('refs/heads/', '');
          const currentCommit = github.context.sha;

          if (debug) {
            core.debug(`Current branch: ${currentBranch}`);
            core.debug(`Current commit: ${currentCommit}`);
            core.debug(`Baseline branch: ${baselineBranch}`);
          }

          // Build module coverage map for comparison
          const currentModuleCoverage: Record<string, number> = {};
          for (const { module, coverage } of overall.modules) {
            if (coverage !== null) {
              currentModuleCoverage[module] = coverage.percentage;
            }
          }

          // Compare with baseline
          const baselineComparison = compareWithBaseline(
            history,
            currentModuleCoverage,
            overall.percentage,
            baselineBranch
          );
          comparison = baselineComparison ?? undefined;

          if (comparison) {
            core.info(`📈 Comparing with baseline (${comparison.baseline.timestamp})`);
            core.info(
              `   Overall change: ${comparison.overallDelta > 0 ? '+' : ''}${comparison.overallDelta.toFixed(1)}%`
            );

            if (debug) {
              const improvements = Object.entries(comparison.moduleDelta).filter(
                ([, delta]) => delta !== null && delta > 0.1
              ).length;
              const regressions = Object.entries(comparison.moduleDelta).filter(
                ([, delta]) => delta !== null && delta < -0.1
              ).length;
              core.debug(`   Modules improved: ${improvements}`);
              core.debug(`   Modules regressed: ${regressions}`);
            }
          } else {
            core.info(`⚠️  No baseline found for branch: ${baselineBranch}`);
          }
        } else {
          core.info('ℹ️  No history data available (first run)');
        }

        // Create new history entry
        const timestamp = new Date().toISOString();
        const currentBranch = github.context.ref.replace('refs/heads/', '');
        const currentCommit = github.context.sha;

        const newEntry = createHistoryEntry(
          timestamp,
          currentBranch,
          currentCommit,
          overall.percentage,
          overall.covered,
          overall.total,
          Object.fromEntries(
            overall.modules
              .filter(
                (m): m is typeof m & { coverage: NonNullable<typeof m.coverage> } =>
                  m.coverage !== null
              )
              .map(({ module, coverage }) => [module, coverage.percentage])
          )
        );

        // Add new entry and trim to retention limit
        const updatedHistory = trimHistory(addHistoryEntry(history, newEntry), historyRetention);

        // Save updated history
        core.info('💾 Saving coverage history...');
        const updatedHistoryJson = saveHistory(updatedHistory);
        await saveHistoryToArtifacts(updatedHistoryJson);

        if (debug) {
          core.debug(`Saved ${updatedHistory.length} history entries`);
        }
      } catch (error) {
        // Log warning but don't fail action
        const message = error instanceof Error ? error.message : String(error);
        core.warning(`Failed to process coverage history: ${message}`);
        if (debug && error instanceof Error && error.stack) {
          core.debug(error.stack);
        }
      }
    }

    // Generate and post PR comment if enabled
    if (enablePrComment) {
      core.info('📝 Generating coverage report...');
      const report = generateMarkdownReport(overall, title, comparison);
      if (debug) {
        core.debug(`Generated report (${report.length} characters)`);
      }

      if (githubToken) {
        core.info('💬 Posting coverage report to PR...');
        await postCoverageComment(githubToken, report);
      } else {
        core.warning(
          '⚠️  Cannot post PR comment: github-token not provided. ' +
            'To enable PR comments, add: github-token: ${{ secrets.GITHUB_TOKEN }}'
        );
      }
    } else {
      core.info('⏭️  PR comment posting disabled');
    }

    // Check minimum coverage threshold
    if (overall.percentage < minCoverage) {
      core.setFailed(
        `❌ Overall coverage ${overall.percentage}% is below minimum required ${minCoverage}%`
      );
      return;
    }

    core.info('✅ Coverage check passed!');
  } catch (error) {
    // Handle errors
    if (error instanceof Error) {
      core.setFailed(`❌ Action failed: ${error.message}`);
      if (error.stack) {
        core.debug(error.stack);
      }
    } else {
      core.setFailed('❌ Action failed with unknown error');
    }
  }
}

// Run the action
run();
