/**
 * GitHub Artifacts integration for coverage history storage
 * Handles loading and saving coverage history using GitHub Actions Artifacts API v2
 */

import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DefaultArtifactClient } from '@actions/artifact';
import * as toolCache from '@actions/tool-cache';
import { downloadArtifactArchive, findArtifactFromBaseline } from './github';
import type { Logger } from './logger';

/**
 * Default artifact name for coverage history
 */
export const COVERAGE_HISTORY_ARTIFACT_NAME = 'coverage-history';

/**
 * Default filename for history JSON
 */
export const HISTORY_FILENAME = 'coverage-history.json';

/**
 * Default directory for coverage history (temporary)
 */
const HISTORY_TEMP_DIR = '.coverage-history-temp';

/**
 * Load coverage history from GitHub artifacts
 * Returns empty array if artifact doesn't exist or can't be loaded
 *
 * Strategy:
 * 1. If token + baseline branch provided, always load from baseline branch (for comparing against baseline)
 * 2. Otherwise try to load from current run (for same-branch reruns without baseline comparison)
 * 3. Otherwise return empty array
 *
 * @param logger Logger for output
 * @param artifactName Name of the artifact (default: 'coverage-history')
 * @param githubToken Optional GitHub token for cross-run artifact search
 * @param baselineBranch Optional baseline branch to search (e.g., 'main')
 * @returns JSON string of history data
 */
export async function loadHistoryFromArtifacts(
  logger: Logger,
  artifactName: string = COVERAGE_HISTORY_ARTIFACT_NAME,
  githubToken?: string,
  baselineBranch?: string
): Promise<string> {
  const artifactClient = new DefaultArtifactClient();

  try {
    logger.debug(`Looking for artifact: ${artifactName}`);

    let artifactId: number | undefined;
    let artifactNameFound: string | undefined;
    let downloadUrl: string | undefined;
    let isFromBaseline = false;

    // If we have a token + baseline branch, always load from baseline
    // This ensures we compare against the baseline branch history, not current run
    if (githubToken && baselineBranch) {
      logger.debug(`Searching for artifact on baseline branch: ${baselineBranch}`);
      const baselineArtifact = await findArtifactFromBaseline(
        logger,
        githubToken,
        artifactName,
        baselineBranch
      );

      if (baselineArtifact) {
        artifactId = baselineArtifact.id;
        artifactNameFound = baselineArtifact.name;
        downloadUrl = baselineArtifact.archive_download_url;
        isFromBaseline = true;
        logger.debug(
          `Found artifact from baseline branch: ${artifactNameFound} (ID: ${artifactId})`
        );
      }
    } else {
      // No baseline configured, try current run (for same-branch reruns)
      try {
        const artifact = await artifactClient.getArtifact(artifactName);
        if (artifact?.artifact) {
          artifactId = artifact.artifact.id;
          artifactNameFound = artifact.artifact.name;
          logger.debug(`Found artifact in current run: ${artifactNameFound} (ID: ${artifactId})`);
        }
      } catch (error) {
        // Artifact not in current run - this is expected
        const message = error instanceof Error ? error.message : String(error);
        logger.debug(`Artifact not found in current workflow run: ${message}`);
      }
    }

    // If no artifact found, return empty array
    if (!artifactId) {
      logger.debug(`Artifact not found: ${artifactName}`);
      return '[]';
    }

    // Create temp directory for download
    const tempDir = join(process.cwd(), HISTORY_TEMP_DIR);
    if (!existsSync(tempDir)) {
      await mkdir(tempDir, { recursive: true });
    }

    let downloadPath: string;

    // Download artifact - use GitHub API for baseline artifacts, runtime client for current run
    if (isFromBaseline && downloadUrl && githubToken) {
      // Cross-run download requires GitHub API with provided token
      const zipPath = join(tempDir, `${artifactName}.zip`);
      await downloadArtifactArchive(logger, githubToken, downloadUrl, zipPath);

      // Extract the ZIP file using cross-platform tool-cache
      await toolCache.extractZip(zipPath, tempDir);

      downloadPath = tempDir;
      logger.debug(`Extracted baseline artifact to: ${downloadPath}`);
    } else {
      // Current run artifact can use the runtime token
      const downloadResponse = await artifactClient.downloadArtifact(artifactId, {
        path: tempDir,
      });
      downloadPath = downloadResponse.downloadPath || tempDir;
      logger.debug(`Downloaded current run artifact to: ${downloadPath}`);
    }

    // Read history file
    const historyPath = join(downloadPath, HISTORY_FILENAME);
    const historyJson = await readFile(historyPath, 'utf-8');

    logger.debug(`Loaded history: ${historyJson.length} bytes`);

    return historyJson;
  } catch (error) {
    // Artifact might not exist on first run - this is expected
    if (error instanceof Error) {
      logger.debug(`Could not load history artifact: ${error.message}`);
    } else {
      logger.debug('Could not load history artifact: unknown error');
    }
    return '[]'; // Return empty array
  }
}

/**
 * Save coverage history to GitHub artifacts
 * @param logger Logger for output
 * @param historyJson JSON string of history data
 * @param artifactName Name of the artifact (default: 'coverage-history')
 */
export async function saveHistoryToArtifacts(
  logger: Logger,
  historyJson: string,
  artifactName: string = COVERAGE_HISTORY_ARTIFACT_NAME
): Promise<void> {
  const artifactClient = new DefaultArtifactClient();

  try {
    // Create temp directory for upload
    const tempDir = join(process.cwd(), HISTORY_TEMP_DIR);
    if (!existsSync(tempDir)) {
      await mkdir(tempDir, { recursive: true });
    }

    // Write history to temp file
    const historyPath = join(tempDir, HISTORY_FILENAME);
    await writeFile(historyPath, historyJson, 'utf-8');

    logger.debug(`Wrote history to: ${historyPath}`);

    // Upload artifact
    // Note: v2 API automatically handles replacing existing artifacts with the same name
    const uploadResponse = await artifactClient.uploadArtifact(
      artifactName,
      [historyPath],
      tempDir,
      {
        retentionDays: 90, // Keep for 90 days
      }
    );

    if (uploadResponse.id) {
      logger.info(`💾 Uploaded coverage history artifact (ID: ${uploadResponse.id})`);
    } else {
      logger.info('💾 Uploaded coverage history artifact');
    }
  } catch (error) {
    // Log error but don't fail the action
    if (error instanceof Error) {
      logger.warn(`Failed to save history artifact: ${error.message}`);
    } else {
      logger.warn('Failed to save history artifact: unknown error');
    }
  }
}

/**
 * Check if running in GitHub Actions environment
 * @returns true if running in GitHub Actions
 */
export function isGitHubActions(): boolean {
  return !!process.env.GITHUB_ACTIONS;
}
