/**
 * Input validation utilities
 */

/**
 * Validate min-coverage input value
 * @param input - The min-coverage input string
 * @returns Validated number
 * @throws Error if validation fails
 */
export function validateMinCoverage(input: string): number {
  const value = Number.parseFloat(input);

  if (Number.isNaN(value)) {
    throw new Error(`Invalid min-coverage value: "${input}". Must be a number between 0 and 100.`);
  }

  if (value < 0 || value > 100) {
    throw new Error(`Invalid min-coverage value: ${value}. Must be between 0 and 100 (inclusive).`);
  }

  return value;
}

/**
 * Validate module-path-template contains {module} placeholder
 * @param template - The module path template
 * @throws Error if validation fails
 */
export function validateModulePathTemplate(template: string): void {
  if (!template.includes('{module}')) {
    throw new Error(
      'module-path-template must contain "{module}" placeholder when using discovery-command. ' +
        'Example: "{module}/build/reports/kover/report.xml"'
    );
  }
}

/**
 * Check if a value is a valid GitHub token format
 * Used for testing purposes to verify token masking behavior
 * @param value - The value to check
 * @returns True if it looks like a token
 */
export function looksLikeToken(value: string): boolean {
  // GitHub tokens typically start with 'ghp_', 'ghs_', 'gho_', 'ghu_', 'github_pat_'
  // or are 40-character hex strings (classic tokens)
  const githubTokenPrefixes = ['ghp_', 'ghs_', 'gho_', 'ghu_', 'github_pat_'];
  const hasGitHubPrefix = githubTokenPrefixes.some((prefix) => value.startsWith(prefix));
  const isClassicToken = /^[a-f0-9]{40}$/i.test(value);

  return hasGitHubPrefix || isClassicToken;
}
