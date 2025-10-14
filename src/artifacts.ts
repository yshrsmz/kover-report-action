/**
 * GitHub Artifacts integration for coverage history storage
 * Handles loading and saving coverage history using GitHub Actions Artifacts API v2
 */

import { DefaultArtifactClient } from '@actions/artifact'
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
 * Default directory for coverage history (temporary)
 */
const HISTORY_TEMP_DIR = '.coverage-history-temp'

/**
 * Load coverage history from GitHub artifacts
 * Returns empty array if artifact doesn't exist or can't be loaded
 * @param artifactName Name of the artifact (default: 'coverage-history')
 * @returns JSON string of history data
 */
export async function loadHistoryFromArtifacts(
  artifactName: string = COVERAGE_HISTORY_ARTIFACT_NAME
): Promise<string> {
  const artifactClient = new DefaultArtifactClient()

  try {
    core.debug(`Looking for artifact: ${artifactName}`)

    // First, get the artifact metadata to obtain its ID
    const artifact = await artifactClient.getArtifact(artifactName)

    if (!artifact || !artifact.artifact) {
      core.debug(`Artifact not found: ${artifactName}`)
      return '[]'
    }

    core.debug(`Found artifact: ${artifact.artifact.name} (ID: ${artifact.artifact.id})`)

    // Create temp directory for download
    const tempDir = join(process.cwd(), HISTORY_TEMP_DIR)
    if (!existsSync(tempDir)) {
      await mkdir(tempDir, { recursive: true })
    }

    // Download artifact using its ID
    const downloadResponse = await artifactClient.downloadArtifact(artifact.artifact.id, {
      path: tempDir
    })

    const downloadPath = downloadResponse.downloadPath || tempDir
    core.debug(`Downloaded artifact to: ${downloadPath}`)

    // Read history file
    const historyPath = join(downloadPath, HISTORY_FILENAME)
    const historyJson = await readFile(historyPath, 'utf-8')

    core.debug(`Loaded history: ${historyJson.length} bytes`)

    return historyJson
  } catch (error) {
    // Artifact might not exist on first run - this is expected
    if (error instanceof Error) {
      core.debug(`Could not load history artifact: ${error.message}`)
    } else {
      core.debug('Could not load history artifact: unknown error')
    }
    return '[]' // Return empty array
  }
}

/**
 * Save coverage history to GitHub artifacts
 * @param historyJson JSON string of history data
 * @param artifactName Name of the artifact (default: 'coverage-history')
 */
export async function saveHistoryToArtifacts(
  historyJson: string,
  artifactName: string = COVERAGE_HISTORY_ARTIFACT_NAME
): Promise<void> {
  const artifactClient = new DefaultArtifactClient()

  try {
    // Create temp directory for upload
    const tempDir = join(process.cwd(), HISTORY_TEMP_DIR)
    if (!existsSync(tempDir)) {
      await mkdir(tempDir, { recursive: true })
    }

    // Write history to temp file
    const historyPath = join(tempDir, HISTORY_FILENAME)
    await writeFile(historyPath, historyJson, 'utf-8')

    core.debug(`Wrote history to: ${historyPath}`)

    // Upload artifact
    // Note: v2 API automatically handles replacing existing artifacts with the same name
    const uploadResponse = await artifactClient.uploadArtifact(
      artifactName,
      [historyPath],
      tempDir,
      {
        retentionDays: 90 // Keep for 90 days
      }
    )

    if (uploadResponse.id) {
      core.info(`💾 Uploaded coverage history artifact (ID: ${uploadResponse.id})`)
    } else {
      core.info('💾 Uploaded coverage history artifact')
    }
  } catch (error) {
    // Log error but don't fail the action
    if (error instanceof Error) {
      core.warning(`Failed to save history artifact: ${error.message}`)
    } else {
      core.warning('Failed to save history artifact: unknown error')
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
