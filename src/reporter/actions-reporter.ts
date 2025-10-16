import { getFailedModules, getMissingCoverageModules } from '../aggregator';
import { postCoverageComment } from '../github';
import type { Logger } from '../logger';
import { generateMarkdownReport } from '../report';
import type { Reporter, ReportResult } from './index';

export interface ActionsReporterOptions {
  logger: Logger;
  core: {
    setOutput(name: string, value: string): void;
    setSecret(secret: string): void;
  };
  githubToken?: string;
  enablePrComment: boolean;
  debug?: boolean;
}

/**
 * Creates a GitHub Actions reporter function
 *
 * @param options - Reporter configuration with logger, core, token, etc.
 * @returns Reporter function that emits coverage reports
 */
export function createActionsReporter(options: ActionsReporterOptions): Reporter {
  return async (result: ReportResult, title: string): Promise<void> => {
    const { overall, comparison } = result;
    const { logger, core, githubToken, enablePrComment, debug } = options;

    // Set GitHub Actions outputs
    core.setOutput('coverage-percentage', overall.percentage.toString());
    core.setOutput('instructions-covered', overall.covered.toString());
    core.setOutput('instructions-total', overall.total.toString());

    const moduleCoverageJson: Record<string, number | string> = {};
    for (const { module, coverage } of overall.modules) {
      moduleCoverageJson[module] = coverage?.percentage ?? 'N/A';
    }
    core.setOutput('modules-coverage-json', JSON.stringify(moduleCoverageJson));

    const failedModules = getFailedModules(overall);
    const missingModules = getMissingCoverageModules(overall);
    core.setOutput('modules-below-threshold', failedModules.join(','));

    // Console summary
    logger.info('');
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logger.info(`📊 Overall Coverage: ${overall.percentage}%`);
    logger.info(`📏 Instructions: ${overall.covered}/${overall.total}`);
    logger.info(`✅ Passing modules: ${overall.modules.filter((m) => m.passed).length}`);

    if (failedModules.length > 0) {
      logger.info(`❌ Failing modules: ${failedModules.length}`);
      for (const module of failedModules) {
        const moduleCov = overall.modules.find((m) => m.module === module);
        if (moduleCov?.coverage) {
          logger.warn(`  ${module}: ${moduleCov.coverage.percentage}% < ${moduleCov.threshold}%`);
        }
      }
    }

    if (missingModules.length > 0) {
      logger.info(`⚠️  Missing coverage: ${missingModules.length} modules`);
      if (debug) {
        for (const module of missingModules) {
          logger.debug(`  ${module}: No coverage file found`);
        }
      }
    }

    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // PR comment
    if (enablePrComment) {
      logger.info('📝 Generating coverage report...');
      const report = generateMarkdownReport(overall, title, comparison);
      if (debug) {
        logger.debug(`Generated report (${report.length} characters)`);
      }

      if (githubToken) {
        logger.info('💬 Posting coverage report to PR...');
        await postCoverageComment(logger, core.setSecret.bind(core), githubToken, report);
      } else {
        logger.warn(
          '⚠️  Cannot post PR comment: github-token not provided. ' +
            `To enable PR comments, add: github-token: \${{ secrets.GITHUB_TOKEN }}`
        );
      }
    } else {
      logger.info('⏭️  PR comment posting disabled');
    }
  };
}
