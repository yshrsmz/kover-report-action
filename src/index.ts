import * as core from '@actions/core';
import { aggregateCoverage, getFailedModules, getMissingCoverageModules } from './aggregator';
import { discoverModulesFromCommand, discoverModulesFromGlob } from './discovery';
import { postCoverageComment } from './github';
import { normalizeModuleName, resolveModulePath, resolveSecurePath } from './paths';
import { generateMarkdownReport } from './report';
import { parseThresholdsFromJSON } from './threshold';

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
    const minCoverage = Number.parseFloat(core.getInput('min-coverage') || '0');
    const title = core.getInput('title') || 'Code Coverage Report';
    const githubToken = core.getInput('github-token');
    const enablePrComment = core.getInput('enable-pr-comment') !== 'false'; // Default true
    const debug = core.getInput('debug') === 'true';

    // Parse ignored modules
    const ignoredModules = ignoreModulesInput
      .split(',')
      .map((m) => m.trim())
      .filter((m) => m.length > 0)
      .map((m) => normalizeModuleName(m));

    core.info('📊 Kover Coverage Report Action');
    core.info(`🎯 Minimum coverage requirement: ${minCoverage}%`);
    core.info(`📝 Report title: ${title}`);

    if (debug) {
      core.info('🐛 Debug mode enabled');
    }

    // Parse and validate thresholds
    let thresholds: ReturnType<typeof parseThresholdsFromJSON>;
    try {
      thresholds = parseThresholdsFromJSON(thresholdsInput);
      core.info(`✅ Thresholds configured: ${Object.keys(thresholds).length} rules`);
    } catch (error) {
      throw new Error(
        `Failed to parse thresholds: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // Discover modules
    let modules: Array<{ name: string; filePath: string }> = [];

    if (discoveryCommand && discoveryCommand.trim().length > 0) {
      // Command-based discovery
      core.info(`🔍 Discovering modules using command: ${discoveryCommand}`);
      const moduleNames = await discoverModulesFromCommand(discoveryCommand, ignoredModules);

      if (moduleNames.length === 0) {
        throw new Error('No modules found by discovery command');
      }

      core.info(`Found ${moduleNames.length} modules via command`);

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
        throw new Error('No coverage files found matching pattern');
      }

      // Convert from {module, filePath} to {name, filePath}
      modules = globResults.map(({ module, filePath }) => ({ name: module, filePath }));

      core.info(`Found ${modules.length} modules via glob pattern`);
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

    // Generate and post PR comment if enabled
    if (enablePrComment) {
      core.info('📝 Generating coverage report...');
      const report = generateMarkdownReport(overall, title);

      core.info('💬 Posting coverage report to PR...');
      await postCoverageComment(githubToken, report);
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
