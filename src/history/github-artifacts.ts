import * as github from '@actions/github';
import type { Logger } from '../common/logger';

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
