/**
 * Glob-based module discovery
 *
 * Discovers modules by finding coverage files matching a glob pattern,
 * then extracting module names from the file paths.
 */

import type { Logger } from '../common/logger';
import type { DiscoveryConfig, ModuleDiscovery, ModuleReference } from './index';
import { discoverModulesFromGlob } from './utils';

/**
 * Creates a glob-based discovery function
 *
 * @param logger Logger for output
 * @param pattern - Glob pattern for coverage files (e.g., '** /build/reports/kover/report.xml')
 * @returns Discovery function that can be called with config
 */
export function createGlobDiscovery(logger: Logger, pattern: string): ModuleDiscovery {
  return async (config: DiscoveryConfig): Promise<ModuleReference[]> => {
    const results = await discoverModulesFromGlob(logger, pattern, config.ignoredModules);

    if (results.length === 0) {
      throw new Error(
        `No coverage files found matching pattern.\n` +
          `Pattern: ${pattern}\n` +
          'Possible causes:\n' +
          '- Coverage reports not generated (run tests with coverage first)\n' +
          '- Pattern does not match actual file locations\n' +
          '- All matching modules are in the ignore-modules list\n' +
          'Tip: Verify files exist by running: ls -la **/build/reports/kover/report.xml'
      );
    }

    return results.map(({ module, filePath }) => ({
      name: module,
      filePath,
    }));
  };
}
