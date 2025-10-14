/**
 * GitHub Artifacts integration for coverage history storage
 * Handles loading and saving coverage history using local file storage
 *
 * Note: Full GitHub Artifacts integration will be added in a future update.
 * For now, history is stored in a local file that can be committed to the repository.
 */

import * as core from '@actions/core'
import { writeFile, readFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { existsSync } from 'node:fs'

/**
 * Default artifact name for coverage history
 */
export const COVERAGE_HISTORY_ARTIFACT_NAME = 'coverage-history'

/**
 * Default filename for history JSON
 */
export const HISTORY_FILENAME = 'coverage-history.json'

/**
 * Default directory for coverage history
 */
export const HISTORY_DIR = '.coverage-history'

/**
 * Load coverage history from local file
 * Returns empty array if file doesn't exist or can't be loaded
 * @param artifactName Name of the artifact (default: 'coverage-history')
 * @returns JSON string of history data
 */
export async function loadHistoryFromArtifacts(
  _artifactName: string = COVERAGE_HISTORY_ARTIFACT_NAME
): Promise<string> {
  try {
    const historyDir = join(process.cwd(), HISTORY_DIR)
    const historyPath = join(historyDir, HISTORY_FILENAME)

    if (!existsSync(historyPath)) {
      core.debug(`History file not found: ${historyPath}`)
      return '[]'
    }

    core.debug(`Loading history from: ${historyPath}`)
    const historyJson = await readFile(historyPath, 'utf-8')

    core.debug(`Loaded history: ${historyJson.length} bytes`)

    return historyJson
  } catch (error) {
    // File might not exist on first run - this is expected
    if (error instanceof Error) {
      core.debug(`Could not load history file: ${error.message}`)
    } else {
      core.debug('Could not load history file: unknown error')
    }
    return '[]' // Return empty array
  }
}

/**
 * Save coverage history to local file
 * @param historyJson JSON string of history data
 * @param artifactName Name of the artifact (default: 'coverage-history')
 */
export async function saveHistoryToArtifacts(
  historyJson: string,
  _artifactName: string = COVERAGE_HISTORY_ARTIFACT_NAME
): Promise<void> {
  try {
    const historyDir = join(process.cwd(), HISTORY_DIR)
    const historyPath = join(historyDir, HISTORY_FILENAME)

    // Create directory if it doesn't exist
    if (!existsSync(historyDir)) {
      await mkdir(historyDir, { recursive: true })
    }

    // Write history to file
    await writeFile(historyPath, historyJson, 'utf-8')

    core.info(`💾 Saved coverage history to: ${historyPath}`)
    core.info(`   (You can commit this file to track history in your repository)`)
  } catch (error) {
    // Log error but don't fail the action
    if (error instanceof Error) {
      core.warning(`Failed to save history file: ${error.message}`)
    } else {
      core.warning('Failed to save history file: unknown error')
    }
  }
}

/**
 * Check if running in GitHub Actions environment
 * @returns true if running in GitHub Actions
 */
export function isGitHubActions(): boolean {
  return !!process.env.GITHUB_ACTIONS
}
