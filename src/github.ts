import * as github from '@actions/github';
import type { Logger } from './logger';
import { COMMENT_IDENTIFIER } from './report';

/**
 * Type alias for Octokit instance
 */
type Octokit = ReturnType<typeof github.getOctokit>;

/**
 * Post or update coverage report as a PR comment
 *
 * Behavior:
 * - Skips if no token provided (logs info, doesn't fail)
 * - Skips if not in PR context (logs info, doesn't fail)
 * - Finds existing comment by COMMENT_IDENTIFIER
 * - Updates existing comment or creates new one
 * - Errors are logged as warnings (doesn't fail action)
 *
 * Security:
 * - Token is masked in logs via setSecret()
 * - Token never appears in error messages or reports
 *
 * @param logger Logger for output
 * @param setSecret Function to mask secret in logs
 * @param token GitHub token for API access (empty string to skip)
 * @param report Markdown-formatted coverage report with COMMENT_IDENTIFIER
 */
export async function postCoverageComment(
  logger: Logger,
  setSecret: (secret: string) => void,
  token: string,
  report: string
): Promise<void> {
  try {
    // Check if token is provided
    if (!token) {
      logger.info('No GitHub token provided. Skipping PR comment posting.');
      return;
    }

    // Mask token in logs for security
    setSecret(token);

    // Check if running in PR context
    const pullRequest = github.context.payload.pull_request;
    if (!pullRequest) {
      logger.info('Not running in a pull request context. Skipping PR comment.');
      return;
    }

    const octokit = github.getOctokit(token);
    const { owner, repo } = github.context.repo;
    const prNumber = pullRequest.number;

    logger.info(`Posting coverage comment to PR #${prNumber}`);

    // Search for existing comment
    const existingCommentId = await findExistingComment(octokit, owner, repo, prNumber);

    if (existingCommentId) {
      // Update existing comment
      logger.info(`Updating existing comment (ID: ${existingCommentId})`);
      await octokit.rest.issues.updateComment({
        owner,
        repo,
        comment_id: existingCommentId,
        body: report,
      });
      logger.info('Coverage comment updated successfully');
    } else {
      // Create new comment
      logger.info('Creating new coverage comment');
      await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: prNumber,
        body: report,
      });
      logger.info('Coverage comment created successfully');
    }
  } catch (error) {
    // Don't fail the action if comment posting fails
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.warn(`Failed to post coverage comment: ${errorMessage}`);
  }
}

/**
 * Find existing coverage comment by searching for HTML identifier
 *
 * Searches through all PR comments to find one containing COMMENT_IDENTIFIER.
 * This allows us to update the same comment on subsequent runs instead of
 * creating multiple comments.
 *
 * @param octokit Authenticated Octokit instance
 * @param owner Repository owner (e.g., "yshrsmz")
 * @param repo Repository name (e.g., "kover-report-action")
 * @param prNumber Pull request number
 * @returns Comment ID if found, null if no existing comment
 */
async function findExistingComment(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number
): Promise<number | null> {
  const { data: comments } = await octokit.rest.issues.listComments({
    owner,
    repo,
    issue_number: prNumber,
  });

  const existingComment = comments.find((comment) => comment.body?.includes(COMMENT_IDENTIFIER));

  return existingComment?.id ?? null;
}

/**
 * Find artifact from the baseline branch
 *
 * Searches through workflow runs on the baseline branch to find the specified artifact.
 * Paginates through workflow runs until the artifact is found or all runs are exhausted.
 *
 * This is necessary because the Artifact API v2's getArtifact() only searches the current
 * workflow run, not across runs on other branches.
 *
 * @param logger Logger for output
 * @param token GitHub token for API access
 * @param artifactName Name of the artifact to find (e.g., 'coverage-history')
 * @param baselineBranch Branch to search for artifacts (e.g., 'main')
 * @returns Artifact object with download URL if found, null otherwise
 */
export async function findArtifactFromBaseline(
  logger: Logger,
  token: string,
  artifactName: string,
  baselineBranch: string
): Promise<{ id: number; name: string; archive_download_url: string } | null> {
  try {
    const octokit = github.getOctokit(token);
    const { owner, repo } = github.context.repo;

    logger.debug(`Searching for artifact "${artifactName}" on branch "${baselineBranch}"`);

    // Paginate through workflow runs on baseline branch
    let page = 1;
    const perPage = 100; // Check 100 runs at a time (API max)
    const maxPages = 5; // Limit to 500 runs total to avoid excessive API calls

    while (page <= maxPages) {
      logger.debug(`Checking workflow runs page ${page}...`);

      // Get workflow runs for the baseline branch
      const { data: runs } = await octokit.rest.actions.listWorkflowRunsForRepo({
        owner,
        repo,
        branch: baselineBranch,
        status: 'completed',
        per_page: perPage,
        page,
      });

      // If no more runs, we're done
      if (runs.workflow_runs.length === 0) {
        logger.debug('No more workflow runs to check');
        break;
      }

      logger.debug(`Found ${runs.workflow_runs.length} workflow runs on page ${page}`);

      // Check each workflow run for the artifact
      for (const run of runs.workflow_runs) {
        logger.debug(`Checking run #${run.id} (${run.name}, status: ${run.conclusion})`);

        try {
          const { data: artifacts } = await octokit.rest.actions.listWorkflowRunArtifacts({
            owner,
            repo,
            run_id: run.id,
            per_page: 100, // Max artifacts per run
          });

          const artifact = artifacts.artifacts.find((a) => a.name === artifactName);

          if (artifact && !artifact.expired) {
            logger.debug(`Found artifact: ${artifact.name} (ID: ${artifact.id})`);
            return {
              id: artifact.id,
              name: artifact.name,
              archive_download_url: artifact.archive_download_url,
            };
          }
        } catch (error) {
          // Log but continue if we can't get artifacts for a specific run
          const message = error instanceof Error ? error.message : String(error);
          logger.debug(`Could not list artifacts for run #${run.id}: ${message}`);
        }
      }

      page++;
    }

    logger.debug(`Artifact "${artifactName}" not found on baseline branch "${baselineBranch}"`);
    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`Failed to search for baseline artifact: ${message}`);
    return null;
  }
}

/**
 * Download artifact from GitHub using the API
 *
 * Downloads an artifact archive using the GitHub REST API and the provided token.
 * This is necessary for cross-run downloads, as the DefaultArtifactClient uses
 * a runtime token scoped only to the current workflow run.
 *
 * @param logger Logger for output
 * @param token GitHub token with appropriate permissions
 * @param downloadUrl Archive download URL from the artifact metadata
 * @param downloadPath Path to save the downloaded artifact
 * @returns Path to the downloaded file
 */
export async function downloadArtifactArchive(
  logger: Logger,
  token: string,
  downloadUrl: string,
  downloadPath: string
): Promise<string> {
  const octokit = github.getOctokit(token);
  const { owner, repo } = github.context.repo;

  logger.debug(`Downloading artifact from: ${downloadUrl}`);

  // Extract artifact ID from URL
  const match = downloadUrl.match(/\/artifacts\/(\d+)\//);
  if (!match) {
    throw new Error(`Invalid artifact download URL: ${downloadUrl}`);
  }
  const artifactId = Number.parseInt(match[1], 10);

  // Download the artifact archive
  const response = await octokit.rest.actions.downloadArtifact({
    owner,
    repo,
    artifact_id: artifactId,
    archive_format: 'zip',
  });

  // The response data is an ArrayBuffer
  const buffer = Buffer.from(response.data as ArrayBuffer);
  const fs = await import('node:fs/promises');
  await fs.writeFile(downloadPath, buffer);

  logger.debug(`Downloaded artifact to: ${downloadPath} (${buffer.length} bytes)`);

  return downloadPath;
}
