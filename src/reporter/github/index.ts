import * as github from '@actions/github';
import type { Logger } from '../../common/logger';
import { COMMENT_IDENTIFIER } from '../report';

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
