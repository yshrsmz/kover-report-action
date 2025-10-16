import { normalize, resolve } from 'node:path';

/**
 * Resolve module path using template
 * Replaces {module} placeholder with the module path (converts :core:common to core/common)
 * @param moduleName Module name in canonical format (e.g., ':core:common')
 * @param template Path template with {module} placeholder
 * @returns Resolved file path
 * @example
 * resolveModulePath(':core:common', '{module}/build/reports/kover/report.xml')
 * // => 'core/common/build/reports/kover/report.xml'
 */
export function resolveModulePath(moduleName: string, template: string): string {
  // Transform module name to path format: :core:common -> core/common
  const modulePath = normalizeModuleForPath(moduleName);

  // Replace {module} placeholder in template
  const resolvedPath = template.replace(/{module}/g, modulePath);

  return resolvedPath;
}

/**
 * Transform module name for use in file paths
 * Converts :core:common to core/common
 * @param moduleName Module name in canonical format
 * @returns Path-friendly string
 */
function normalizeModuleForPath(moduleName: string): string {
  // Remove leading ':'
  let path = moduleName.startsWith(':') ? moduleName.substring(1) : moduleName;

  // Replace remaining ':' with '/'
  path = path.replace(/:/g, '/');

  return path;
}

/**
 * Normalize module name to canonical format
 * Ensures leading colon and no trailing colon
 * @param moduleName Module name (may or may not have leading colon)
 * @returns Normalized module name
 * @throws Error if module name is empty or invalid
 * @example
 * normalizeModuleName('core:common') // => ':core:common'
 * normalizeModuleName(':app:') // => ':app'
 * normalizeModuleName('::core') // => ':core'
 */
export function normalizeModuleName(moduleName: string): string {
  if (!moduleName || moduleName.trim().length === 0) {
    throw new Error('Module name cannot be empty');
  }

  let normalized = moduleName.trim();

  // Check for empty segments (double colons) before normalization
  if (normalized.includes('::')) {
    throw new Error(`Invalid module name format: "${moduleName}" contains empty segments (::)`);
  }

  // Add leading colon if missing
  if (!normalized.startsWith(':')) {
    normalized = `:${normalized}`;
  }

  // Remove trailing colon
  if (normalized.endsWith(':') && normalized.length > 1) {
    normalized = normalized.substring(0, normalized.length - 1);
  }

  return normalized;
}

/**
 * Validate and resolve absolute path, preventing path traversal
 * @param basePath Base directory path
 * @param relativePath Relative path to resolve
 * @returns Absolute path
 * @throws Error if path traversal is detected
 */
export function resolveSecurePath(basePath: string, relativePath: string): string {
  const absoluteBase = resolve(basePath);
  const resolvedPath = normalize(resolve(basePath, relativePath));

  // Security check: ensure resolved path is within base path
  if (!resolvedPath.startsWith(absoluteBase)) {
    throw new Error(`Path traversal detected: ${relativePath} resolves outside workspace`);
  }

  return resolvedPath;
}
