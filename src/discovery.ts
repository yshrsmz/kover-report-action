import { isAbsolute, relative, sep } from 'node:path';
import { exec } from '@actions/exec';
import { glob } from 'glob';
import type { Logger } from './logger';

// Regex pattern to extract module names from Gradle-style output
const GRADLE_PROJECT_REGEX = /Project '([^']+)'/g;

/**
 * Discover modules by executing a command (e.g., Gradle projects list)
 * @param logger Logger for output
 * @param command Command to execute (shell features not supported for security)
 * @param ignoredModules List of module names to ignore
 * @returns Array of module names
 * @throws Error if command execution fails
 */
export async function discoverModulesFromCommand(
  logger: Logger,
  command: string,
  ignoredModules: string[] = []
): Promise<string[]> {
  if (!command || command.trim().length === 0) {
    throw new Error('Discovery command cannot be empty');
  }

  let output = '';
  let errorOutput = '';

  // Parse command string into command and args
  // Note: No shell expansion for security (prevents injection)
  const parts = command.trim().split(/\s+/);
  const cmd = parts[0];
  const args = parts.slice(1);

  logger.debug(`Executing discovery command: ${cmd} ${args.join(' ')}`);

  try {
    await exec(cmd, args, {
      listeners: {
        stdout: (data: Buffer) => {
          output += data.toString();
        },
        stderr: (data: Buffer) => {
          errorOutput += data.toString();
        },
      },
    });
  } catch (error) {
    throw new Error(
      `Discovery command failed: ${error instanceof Error ? error.message : String(error)}\nStderr: ${errorOutput}`
    );
  }

  logger.debug(`Discovery command output:\n${output}`);

  const modules = parseGradleProjects(output);
  const filtered = filterIgnoredModules(modules, ignoredModules);

  logger.debug(`Discovered ${filtered.length} modules: ${filtered.join(', ')}`);

  return filtered;
}

/**
 * Parse Gradle projects output to extract module names
 * Filters out "Root project" entries and normalizes module names
 * @param output Raw output from Gradle projects command
 * @returns Array of normalized module names (with leading colon)
 */
export function parseGradleProjects(output: string): string[] {
  if (!output) {
    return [];
  }

  const modules: string[] = [];
  const regex = new RegExp(GRADLE_PROJECT_REGEX);

  let match = regex.exec(output);
  while (match !== null) {
    const moduleName = match[1];
    // Filter out Root project entries
    if (!moduleName.includes('Root project')) {
      // Normalize: ensure leading colon
      const normalized = moduleName.startsWith(':') ? moduleName : `:${moduleName}`;
      modules.push(normalized);
    }
    match = regex.exec(output);
  }

  return modules;
}

/**
 * Filter out ignored modules from the list
 * @param modules List of module names
 * @param ignoredModules List of modules to ignore
 * @returns Filtered list of modules
 */
function filterIgnoredModules(modules: string[], ignoredModules: string[]): string[] {
  // Normalize ignored modules (add leading colon if missing)
  const normalized = ignoredModules.map((m) => (m.startsWith(':') ? m : `:${m}`));
  return modules.filter((m) => !normalized.includes(m));
}

/**
 * Discover modules using glob pattern to find coverage files
 * @param logger Logger for output
 * @param pattern Glob pattern for coverage files (e.g., '** /build/reports/kover/report.xml')
 * @param ignoredModules List of module names to ignore
 * @returns Array of module info with name and file path
 * @throws Error if pattern is empty
 */
export async function discoverModulesFromGlob(
  logger: Logger,
  pattern: string,
  ignoredModules: string[] = []
): Promise<Array<{ module: string; filePath: string }>> {
  if (!pattern || pattern.trim().length === 0) {
    throw new Error('Glob pattern cannot be empty');
  }

  logger.debug(`Searching for coverage files with pattern: ${pattern}`);

  const files = await glob(pattern, { nodir: true });

  logger.debug(`Found ${files.length} coverage files`);

  const normalizedIgnored = ignoredModules.map((m) => (m.startsWith(':') ? m : `:${m}`));

  const modules = files
    .map((filePath) => ({
      module: extractModuleName(logger, filePath),
      filePath,
    }))
    .filter(({ module }) => {
      const isIgnored = normalizedIgnored.includes(module);
      if (isIgnored) {
        logger.debug(`Ignoring module: ${module}`);
      }
      return !isIgnored;
    });

  logger.debug(`Discovered ${modules.length} modules after filtering`);

  return modules;
}

/**
 * Extract module name from file path by removing common suffixes
 * Supports multiple common Kover report path patterns
 * @param logger Logger for output
 * @param filePath Path to coverage file (e.g., 'core/common/build/reports/kover/report.xml')
 * @returns Normalized module name (e.g., ':core:common')
 * @example
 * extractModuleName(logger, 'core/common/build/reports/kover/report.xml') // => ':core:common'
 * extractModuleName(logger, 'app/build/reports/kover/report.xml') // => ':app'
 */
export function extractModuleName(logger: Logger, filePath: string): string {
  let modulePath = filePath;

  // If path is absolute, convert to relative from workspace
  if (isAbsolute(modulePath)) {
    const workspace = process.env.GITHUB_WORKSPACE || process.cwd();
    modulePath = relative(workspace, modulePath);

    // If relative path starts with .., it's outside workspace
    if (modulePath.startsWith(`..${sep}`)) {
      logger.warn(`Coverage file outside workspace: ${filePath}. Using filename only.`);
      // Use just the filename portion as fallback
      modulePath = filePath.split(sep).slice(-4, -3).join(sep) || 'unknown';
    }
  }

  // Normalize path separators to forward slashes for consistent processing
  modulePath = modulePath.replace(/\\/g, '/');

  // Common suffixes to remove, in priority order
  const suffixes = [
    '/build/reports/kover/report.xml',
    '/build/reports/kover/*.xml',
    '/kover/report.xml',
    '/report.xml',
  ];

  for (const suffix of suffixes) {
    // Handle wildcard patterns
    const suffixPattern = suffix.replace('*', '[^/]+');
    const regex = new RegExp(`${suffixPattern}$`);
    if (regex.test(modulePath)) {
      modulePath = modulePath.replace(regex, '');
      break;
    }
  }

  // Convert path to module format: core/common -> :core:common
  const normalized = `:${modulePath.replace(/\//g, ':')}`;
  return normalized;
}
