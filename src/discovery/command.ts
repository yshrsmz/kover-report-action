/**
 * Command-based module discovery
 *
 * Discovers modules by executing a command (e.g., Gradle projects list)
 * and resolving their coverage file paths using a template.
 */

import type { Logger } from '../common/logger';
import { resolveModulePath } from '../common/paths';
import type { DiscoveryConfig, ModuleDiscovery, ModuleReference } from './index';
import { discoverModulesFromCommand } from './utils';

/**
 * Creates a command-based discovery function
 *
 * @param logger Logger for output
 * @param command - Command to execute (e.g., './gradlew -q projects')
 * @param pathTemplate - Path template with {module} placeholder
 * @returns Discovery function that can be called with config
 */
export function createCommandDiscovery(
  logger: Logger,
  command: string,
  pathTemplate: string
): ModuleDiscovery {
  return async (config: DiscoveryConfig): Promise<ModuleReference[]> => {
    const moduleNames = await discoverModulesFromCommand(logger, command, config.ignoredModules);

    if (moduleNames.length === 0) {
      throw new Error(
        `No modules found by discovery command.\n` +
          `Command: ${command}\n` +
          'Possible causes:\n' +
          '- Command output does not contain "Project \'...\'" patterns\n' +
          '- All modules are in the ignore-modules list\n' +
          '- Command failed or returned no output\n' +
          'Tip: Run the command locally to verify its output format.'
      );
    }

    return moduleNames.map((name) => ({
      name,
      filePath: resolveModulePath(name, pathTemplate),
    }));
  };
}
