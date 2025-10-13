import * as core from '@actions/core';
import { exec } from '@actions/exec';
import { glob } from 'glob';
import { isAbsolute, relative, sep } from 'node:path';

// Regex pattern to extract module names from Gradle-style output
const GRADLE_PROJECT_REGEX = /Project '([^']+)'/g;

/**
 * Discover modules by executing a command (e.g., Gradle projects list)
 * @param command Command to execute (shell features not supported for security)
 * @param ignoredModules List of module names to ignore
 * @returns Array of module names
 * @throws Error if command execution fails
 */
export async function discoverModulesFromCommand(
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

  core.debug(`Executing discovery command: ${cmd} ${args.join(' ')}`);

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

  core.debug(`Discovery command output:\n${output}`);

  const modules = parseGradleProjects(output);
  const filtered = filterIgnoredModules(modules, ignoredModules);

  core.debug(`Discovered ${filtered.length} modules: ${filtered.join(', ')}`);

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
  let match: RegExpExecArray | null;
  const regex = new RegExp(GRADLE_PROJECT_REGEX);

  while ((match = regex.exec(output)) !== null) {
    const moduleName = match[1];
    // Filter out Root project entries
    if (!moduleName.includes('Root project')) {
      // Normalize: ensure leading colon
      const normalized = moduleName.startsWith(':') ? moduleName : `:${moduleName}`;
      modules.push(normalized);
    }
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
 * @param pattern Glob pattern for coverage files (e.g., '** /build/reports/kover/report.xml')
 * @param ignoredModules List of module names to ignore
 * @returns Array of module info with name and file path
 * @throws Error if pattern is empty
 */
export async function discoverModulesFromGlob(
  pattern: string,
  ignoredModules: string[] = []
): Promise<Array<{ module: string; filePath: string }>> {
  if (!pattern || pattern.trim().length === 0) {
    throw new Error('Glob pattern cannot be empty');
  }

  core.debug(`Searching for coverage files with pattern: ${pattern}`);

  const files = await glob(pattern, { nodir: true });

  core.debug(`Found ${files.length} coverage files`);

  const normalizedIgnored = ignoredModules.map((m) => (m.startsWith(':') ? m : `:${m}`));

  const modules = files
    .map((filePath) => ({
      module: extractModuleName(filePath),
      filePath,
    }))
    .filter(({ module }) => {
      const isIgnored = normalizedIgnored.includes(module);
      if (isIgnored) {
        core.debug(`Ignoring module: ${module}`);
      }
      return !isIgnored;
    });

  core.debug(`Discovered ${modules.length} modules after filtering`);

  return modules;
}

/**
 * Extract module name from file path by removing common suffixes
 * Supports multiple common Kover report path patterns
 * @param filePath Path to coverage file (e.g., 'core/common/build/reports/kover/report.xml')
 * @returns Normalized module name (e.g., ':core:common')
 * @example
 * extractModuleName('core/common/build/reports/kover/report.xml') // => ':core:common'
 * extractModuleName('app/build/reports/kover/report.xml') // => ':app'
 */
export function extractModuleName(filePath: string): string {
  let modulePath = filePath;

  // If path is absolute, convert to relative from workspace
  if (isAbsolute(modulePath)) {
    const workspace = process.env.GITHUB_WORKSPACE || process.cwd();
    modulePath = relative(workspace, modulePath);

    // If relative path starts with .., it's outside workspace
    if (modulePath.startsWith(`..${sep}`)) {
      core.warning(
        `Coverage file outside workspace: ${filePath}. Using filename only.`
      );
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
